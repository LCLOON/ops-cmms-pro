import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@libsql/client';
import { contractorStartBlocker, gateMode, companyBlockers, workOrderContractorContext, contractorContextDigest } from '../lib/contractor-evidence.ts';

const mapping = { customerId: 'customer-a', sourceInstanceId: 'contractors-a', consumerInstanceId: 'cmms-a', consumerApp: 'cmms', consumerSiteId: 'site-cmms' };
const row = { id: 'wo', created_at: '2026-01-01', site_id: 'site-cmms', asset_id: 'asset', title: 'Synthetic work', description: 'Scope', assigned_to: 'Acme', type: 'corrective' };
const digest = workOrderContractorContext(row);
const env = {
  OPS_CONTRACTOR_EVIDENCE_ENABLED: '1', OPS_CONTRACTOR_DEDICATED_CUSTOMER_CONFIRMED: '1',
  OPS_CONTRACTOR_EVIDENCE_ORIGIN: 'https://source.invalid', OPS_CONTRACTOR_EVIDENCE_TOKEN: 'c'.repeat(40),
  OPS_CONTRACTOR_EVIDENCE_MAPPING: JSON.stringify(mapping),
  OPS_CONTRACTOR_EVIDENCE_BINDINGS: JSON.stringify([{ recordId: 'wo', contractorId: 'C-1', contextDigest: digest }]),
  NODE_ENV: 'production',
};

const evidence = (overrides = {}) => ({
  schemaVersion: 1, mapping, contractorId: 'C-1', requestId: 'PLACEHOLDER',
  observedAt: new Date().toISOString(), scope: 'company-only', workAuthorization: 'not-established',
  companyName: 'Acme Contracting', status: 'approved', approvalBasis: 'clean',
  approvalExpiry: '2099-01-01', insuranceExpiry: '2099-01-01', orientationRecorded: true,
  namedWorkers: { active: 3, expired: 0 }, issues: [], ...overrides,
});

async function fixture() {
  const db = createClient({ url: ':memory:' });
  await db.executeMultiple(`
    CREATE TABLE work_orders(id TEXT PRIMARY KEY, site_id TEXT, asset_id TEXT, title TEXT, description TEXT, assigned_to TEXT, type TEXT, created_at TEXT);
    INSERT INTO work_orders VALUES('wo','site-cmms','asset','Synthetic work','Scope','Acme','corrective','2026-01-01');
    INSERT INTO work_orders VALUES('other','site-cmms','asset','Other','Scope','Acme','corrective','2026-01-01');
  `);
  return db;
}

const okFetch = async (input) => {
  const requestId = new URL(String(input)).searchParams.get('requestId');
  return Response.json(evidence({ requestId }));
};

test('gate mode defaults to enforce and only yields when set explicitly', () => {
  assert.equal(gateMode({}), 'enforce');
  assert.equal(gateMode({ OPS_CONTRACTOR_GATE_MODE: 'advisory' }), 'advisory');
  assert.equal(gateMode({ OPS_CONTRACTOR_GATE_MODE: 'yes' }), 'enforce');
});

test('company blockers name what is actually wrong', () => {
  assert.deepEqual(companyBlockers({ status: 'approved', approvalBasis: 'clean', approvalExpiry: '2099-01-01', insuranceExpiry: '2099-01-01' }), []);
  assert.ok(companyBlockers({ status: 'disqualified', approvalBasis: 'clean', approvalExpiry: '2099-01-01', insuranceExpiry: '2099-01-01' }).some(reason => /disqualified/.test(reason)));
  assert.ok(companyBlockers({ status: 'approved', approvalBasis: 'override', approvalExpiry: '2099-01-01', insuranceExpiry: '2099-01-01' }).some(reason => /override/.test(reason)));
  assert.ok(companyBlockers({ status: 'approved', approvalBasis: 'unknown', approvalExpiry: '2099-01-01', insuranceExpiry: '2099-01-01' }).some(reason => /basis/.test(reason)));
  assert.ok(companyBlockers({ status: 'approved', approvalBasis: 'clean', approvalExpiry: null, insuranceExpiry: null }).length === 2);
});

test('an unconfigured or unbound job is never gated', async () => {
  const db = await fixture();
  try {
    assert.equal(await contractorStartBlocker(db, 'wo', {}, okFetch), null);
    // Configured, but this work order has no binding.
    assert.equal(await contractorStartBlocker(db, 'other', env, okFetch), null);
    // Binding exists but the recorded context has moved.
    await db.execute("UPDATE work_orders SET assigned_to='Different crew' WHERE id='wo'");
    const moved = await contractorStartBlocker(db, 'wo', env, okFetch);
    assert.match(moved ?? '', /no longer matches the scope/);
  } finally { db.close(); }
});

test('a clear company lets work start; a blocked company does not', async () => {
  const db = await fixture();
  try {
    assert.equal(await contractorStartBlocker(db, 'wo', env, okFetch), null);
    for (const [overrides, expectation] of [
      [{ status: 'suspended' }, /suspended/],
      [{ status: 'disqualified' }, /disqualified/],
      [{ approvalBasis: 'override' }, /override/],
      [{ approvalBasis: 'unknown' }, /basis/],
      [{ approvalExpiry: null }, /approval expiry/],
      [{ insuranceExpiry: '2020-01-01' }, /insurance/],
    ]) {
      const fetchBlocked = async (input) => {
        const requestId = new URL(String(input)).searchParams.get('requestId');
        return Response.json(evidence({ ...overrides, requestId }));
      };
      assert.match((await contractorStartBlocker(db, 'wo', env, fetchBlocked)) ?? '', expectation);
    }
  } finally { db.close(); }
});

test('a clear company does not excuse an unready job crew', async () => {
  const db = await fixture();
  const crewFetch = async (input) => {
    const requestId = new URL(String(input)).searchParams.get('requestId');
    const jobRef = new URL(String(input)).searchParams.get('jobRef');
    return Response.json(evidence({
      requestId,
      jobWorkers: { ready: false, assigned: 1, acknowledged: 0, reasons: ['Alex Kim has not acknowledged this job'] },
    }));
  };
  try {
    // The work order id travels as the job reference, so nothing has to be typed in.
    const refusal = await contractorStartBlocker(db, 'wo', env, crewFetch);
    assert.match(refusal ?? '', /Alex Kim has not acknowledged this job/);
    // The company itself is clean, so the refusal must be about the crew, not the company.
    assert.doesNotMatch(refusal ?? '', /company status/);
  } finally { db.close(); }
});

test('an outage blocks by default and only advisory mode waves it through', async () => {
  const db = await fixture();
  const offline = async () => { throw new Error('offline'); };
  try {
    assert.match((await contractorStartBlocker(db, 'wo', env, offline)) ?? '', /could not be verified/);
    assert.equal(await contractorStartBlocker(db, 'wo', { ...env, OPS_CONTRACTOR_GATE_MODE: 'advisory' }, offline), null);
    const unauthorized = async () => Response.json({ error: 'Unauthorized' }, { status: 401 });
    assert.match((await contractorStartBlocker(db, 'wo', env, unauthorized)) ?? '', /could not be verified/);
  } finally { db.close(); }
});

test('a moved context is refused even when the fast path would allow it', async () => {
  const db = await fixture();
  try {
    const changed = contractorContextDigest(['wo', '2026-01-01', 'site-cmms', 'asset', 'Synthetic work', 'Different scope', 'Acme', 'corrective']);
    const wrongBinding = { ...env, OPS_CONTRACTOR_EVIDENCE_BINDINGS: JSON.stringify([{ recordId: 'wo', contractorId: 'C-1', contextDigest: changed }]) };
    assert.match((await contractorStartBlocker(db, 'wo', wrongBinding, okFetch)) ?? '', /no longer matches the scope/);
  } finally { db.close(); }
});
