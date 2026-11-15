import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@libsql/client';
import { attachEhsProcedure, ehsDigest, ehsStartBlocker, getEhsConfig, getEhsProcedureView, initEhsAttachments, validateEhsEnvelope } from '../lib/ehs-procedures.ts';

const mapping = { customerId: 'customer-a', ehsInstanceId: 'ehs-a', cmmsInstanceId: 'cmms-a', ehsSiteId: 'site-ehs', cmmsSiteId: 'site-cmms' };
const config = { mapping, token: 'synthetic-token-only-not-a-secret-12345', origin: 'https://ehs.example.test' };
const revision = { schemaVersion: 1, mapping, id: 'revision-a', documentId: 'sop', sequence: 1, number: 'SOP-TEST', title: 'Synthetic procedure', revision: 'A', content: 'Complete synthetic A', approvedBy: 'approver', approvedAt: '2026-01-01T00:00:00.000Z' };
const envelope = { revision, digest: ehsDigest(revision), latest: { id: revision.id, revision: 'A', sequence: 1 }, sourceState: 'current' };
const expectedContext = ehsDigest(['wo', '2026-01-01', 'site-cmms', 'asset', 'Synthetic work', 'Scope', 'Crew', 'corrective']);

async function fixture() {
  const db = createClient({ url: ':memory:' });
  await db.executeMultiple(`
    CREATE TABLE users(id INTEGER PRIMARY KEY, username TEXT, role TEXT, active INTEGER, force_password_change INTEGER);
    INSERT INTO users VALUES(1,'planner','manager',1,0),(2,'reader','viewer',1,0);
    CREATE TABLE sites(id TEXT PRIMARY KEY); INSERT INTO sites VALUES('site-cmms');
    CREATE TABLE assets(id TEXT PRIMARY KEY,site_id TEXT); INSERT INTO assets VALUES('asset','site-cmms');
    CREATE TABLE work_orders(id TEXT PRIMARY KEY, site_id TEXT, asset_id TEXT, title TEXT, description TEXT, assigned_to TEXT, type TEXT, created_at TEXT, status TEXT);
    INSERT INTO work_orders VALUES('wo','site-cmms','asset','Synthetic work','Scope','Crew','corrective','2026-01-01','open');
    CREATE TABLE audit_log(user_id INTEGER, username TEXT, action TEXT, entity_type TEXT, entity_id TEXT, details TEXT);
  `);
  await initEhsAttachments(db);
  return db;
}

test('configuration is opt-in and rejects unsafe origins', () => {
  assert.throws(() => getEhsConfig({}));
  const env = { OPS_PROCEDURE_PILOT_ENABLED: '1', OPS_PROCEDURE_DEDICATED_CUSTOMER_CONFIRMED: '1', OPS_PROCEDURE_PILOT_MAPPING: JSON.stringify(mapping), OPS_PROCEDURE_READ_TOKEN: config.token, OPS_EHS_PROCEDURE_ORIGIN: 'http://remote.example.test', NODE_ENV: 'production' };
  assert.throws(() => getEhsConfig(env));
  assert.throws(() => getEhsConfig({ ...env, OPS_EHS_PROCEDURE_ORIGIN: 'https://user:password@ehs.example.test' }));
  assert.equal(getEhsConfig({ ...env, OPS_EHS_PROCEDURE_ORIGIN: config.origin }).origin, config.origin);
});

test('response contract rejects wrong identity, digest and revision history', () => {
  assert.deepEqual(validateEhsEnvelope(envelope, config, revision.id), envelope);
  assert.throws(() => validateEhsEnvelope(envelope, config, 'wrong'));
  for (const key of Object.keys(mapping)) assert.throws(() => validateEhsEnvelope(envelope, { ...config, mapping: { ...mapping, [key]: 'wrong' } }));
  assert.throws(() => validateEhsEnvelope({ ...envelope, digest: '0'.repeat(64) }, config));
  assert.throws(() => validateEhsEnvelope({ ...envelope, latest: { ...envelope.latest, id: 'wrong' } }, config));
});

test('attachment pins A, reports B and outages, warns on scope changes without changing status', async context => {
  const db = await fixture();
  let response = envelope;
  context.mock.method(globalThis, 'fetch', async (_url, options) => {
    assert.equal(options.redirect, 'error');
    assert.equal(options.cache, 'no-store');
    if (!response) throw new Error('Synthetic offline');
    return Response.json(response);
  });
  try {
    await assert.rejects(attachEhsProcedure(db, config, 1, 'wo', revision.id, 'stale-preview'));
    await attachEhsProcedure(db, config, 1, 'wo', revision.id, expectedContext);
    await attachEhsProcedure(db, config, 1, 'wo', revision.id, expectedContext);
    response = { ...envelope, latest: { id: 'revision-b', revision: 'B', sequence: 2 } };
    const view = await getEhsProcedureView(db, config, 2, 'wo');
    assert.deepEqual(view.attachment.revision, revision);
    assert.equal(view.source.latest.revision, 'B');
    assert.equal(view.canAttach, false);
    await assert.rejects(attachEhsProcedure(db, config, 1, 'wo', 'revision-b', expectedContext));
    response = null;
    const offline = await getEhsProcedureView(db, config, 2, 'wo');
    assert.deepEqual(offline.attachment.revision, revision);
    assert.equal(offline.source, null);
    assert.equal(offline.checkedAt, null);
    assert.match(offline.warning, /unavailable/);
    await db.execute("UPDATE work_orders SET assigned_to='Other crew'");
    assert.equal((await getEhsProcedureView(db, config, 1, 'wo')).attachment.contextChanged, true);
    assert.equal((await db.execute('SELECT status FROM work_orders')).rows[0].status, 'open');
    assert.equal((await db.execute('SELECT COUNT(*) AS total FROM audit_log')).rows[0].total, 1);
    await assert.rejects(db.execute('DELETE FROM wo_ehs_procedure_attachments'));
    await assert.rejects(db.execute("UPDATE wo_ehs_procedure_attachments SET digest='wrong'"));
  } finally { db.close(); }
});

test('pre-start gate refuses only when pinned evidence no longer matches the work', async context => {
  const db = await fixture();
  const env = {
    OPS_PROCEDURE_PILOT_ENABLED: '1', OPS_PROCEDURE_DEDICATED_CUSTOMER_CONFIRMED: '1',
    OPS_PROCEDURE_PILOT_MAPPING: JSON.stringify(mapping), OPS_PROCEDURE_READ_TOKEN: config.token,
    OPS_EHS_PROCEDURE_ORIGIN: config.origin, NODE_ENV: 'production',
  };
  context.mock.method(globalThis, 'fetch', async () => Response.json(envelope));
  try {
    await db.execute("INSERT INTO work_orders VALUES('wo2','site-cmms','asset','Second job','Scope','Crew','corrective','2026-01-01','open')");
    await db.execute("INSERT INTO work_orders VALUES('wo3','site-other','asset','Elsewhere','Scope','Crew','corrective','2026-01-01','open')");
    // No pilot configured: the gate must stay out of the way.
    assert.equal(await ehsStartBlocker(db, 'wo', {}), null);
    // A job with no pinned procedure has no contradiction to raise.
    assert.equal(await ehsStartBlocker(db, 'wo2', env), null);
    // Outside the configured site the pilot does not apply.
    assert.equal(await ehsStartBlocker(db, 'wo3', env), null);
    await attachEhsProcedure(db, config, 1, 'wo', revision.id, expectedContext);
    assert.equal(await ehsStartBlocker(db, 'wo', env), null);
    // Crew substitution is the case a paper procedure never catches.
    await db.execute("UPDATE work_orders SET assigned_to='Substitute crew' WHERE id='wo'");
    const refusal = await ehsStartBlocker(db, 'wo', env);
    assert.match(refusal, /Cannot start/);
    assert.match(refusal, /SOP-TEST/);
    // The check reports; it never edits the job it is judging.
    assert.equal((await db.execute("SELECT status FROM work_orders WHERE id='wo'")).rows[0].status, 'open');
  } finally { db.close(); }
});

test('wrong site, stale users and remapped databases cannot read or attach', async context => {
  const db = await fixture();
  context.mock.method(globalThis, 'fetch', async () => Response.json(envelope));
  try {
    await assert.rejects(attachEhsProcedure(db, config, 2, 'wo', revision.id, expectedContext));
    await assert.rejects(getEhsProcedureView(db, { ...config, mapping: { ...mapping, cmmsSiteId: 'wrong' } }, 1, 'wo'));
    await attachEhsProcedure(db, config, 1, 'wo', revision.id, expectedContext);
    await assert.rejects(getEhsProcedureView(db, { ...config, mapping: { ...mapping, customerId: 'other' } }, 1, 'wo'));
    await db.execute('UPDATE users SET active=0 WHERE id=1');
    await assert.rejects(getEhsProcedureView(db, config, 1, 'wo'));
    await db.execute("UPDATE work_orders SET site_id='other'");
    await assert.rejects(getEhsProcedureView(db, config, 2, 'wo'));
  } finally { db.close(); }
});

test('a scope change during source retrieval cannot create an attachment', async context => {
  const db = await fixture();
  context.mock.method(globalThis, 'fetch', async () => {
    await db.execute("UPDATE work_orders SET description='Changed scope'");
    return Response.json(envelope);
  });
  try {
    await assert.rejects(attachEhsProcedure(db, config, 1, 'wo', revision.id, expectedContext));
    assert.equal((await db.execute('SELECT COUNT(*) AS total FROM wo_ehs_procedure_attachments')).rows[0].total, 0);
  } finally { db.close(); }
});

test('an audit failure rolls back both attachment and database binding', async context => {
  const db = await fixture();
  context.mock.method(globalThis, 'fetch', async () => Response.json(envelope));
  try {
    await db.execute('DROP TABLE audit_log');
    await assert.rejects(attachEhsProcedure(db, config, 1, 'wo', revision.id, expectedContext));
    assert.equal((await db.execute('SELECT COUNT(*) AS total FROM wo_ehs_procedure_attachments')).rows[0].total, 0);
    assert.equal((await db.execute('SELECT COUNT(*) AS total FROM ehs_procedure_binding')).rows[0].total, 0);
  } finally { db.close(); }
});