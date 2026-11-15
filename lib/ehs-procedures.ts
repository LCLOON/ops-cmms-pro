import { createHash } from 'node:crypto';
import type { Client, Transaction } from '@libsql/client';
import { z } from 'zod';

const identifier = z.string().trim().min(1).max(128);
const mappingSchema = z.object({
  customerId: identifier, ehsInstanceId: identifier, cmmsInstanceId: identifier,
  ehsSiteId: identifier, cmmsSiteId: identifier,
}).strict();
type Mapping = z.infer<typeof mappingSchema>;
export interface EhsConfig { mapping: Mapping; token: string; origin: string }
export class EhsProcedureError extends Error {
  status: number;
  constructor(message: string, status = 409) { super(message); this.status = status; }
}

const approvedRevisionSchema = z.object({
  schemaVersion: z.literal(1), mapping: mappingSchema, id: identifier, documentId: identifier,
  sequence: z.number().int().positive(), number: z.string().min(1).max(200),
  title: z.string().min(1).max(1000), revision: identifier, content: z.string().min(1).max(200000),
  approvedBy: z.string().min(1).max(200), approvedAt: z.string().datetime(),
}).strict();
const envelopeSchema = z.object({
  revision: approvedRevisionSchema, digest: z.string().regex(/^[a-f0-9]{64}$/),
  latest: z.object({ id: identifier, revision: identifier, sequence: z.number().int().positive() }).strict(),
  sourceState: z.enum(['current', 'changed', 'withdrawn', 'missing']),
}).strict();
export type EhsRevision = z.infer<typeof approvedRevisionSchema>;
export type EhsEnvelope = z.infer<typeof envelopeSchema>;
export interface EhsAttachment { revision: EhsRevision; digest: string; selectedBy: string; selectedAt: string; contextChanged: boolean }
export interface EhsProcedureView {
  enabled: boolean; attachment: EhsAttachment | null; options: EhsEnvelope[];
  canAttach: boolean; source: EhsEnvelope | null; checkedAt: string | null; warning: string | null;
  contextDigest: string; workOrder: { title: string; description: string; assetId: string; assignedTo: string };
}

export function ehsDigest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
function mappingKey(mapping: Mapping) { return JSON.stringify(mappingSchema.parse(mapping)); }

export function getEhsConfig(env: Record<string, string | undefined> = process.env): EhsConfig {
  if (env.OPS_PROCEDURE_PILOT_ENABLED !== '1' || env.OPS_PROCEDURE_DEDICATED_CUSTOMER_CONFIRMED !== '1') throw new EhsProcedureError('Procedure integration is disabled', 503);
  try {
    const mapping = mappingSchema.parse(JSON.parse(env.OPS_PROCEDURE_PILOT_MAPPING || ''));
    const token = z.string().min(32).max(512).parse(env.OPS_PROCEDURE_READ_TOKEN);
    const url = new URL(env.OPS_EHS_PROCEDURE_ORIGIN || '');
    const localTest = env.NODE_ENV !== 'production' && url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if ((url.protocol !== 'https:' && !localTest) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('Invalid origin');
    return { mapping, token, origin: url.origin };
  } catch { throw new EhsProcedureError('Procedure integration configuration is invalid', 503); }
}

export function validateEhsEnvelope(raw: unknown, config: EhsConfig, revisionId?: string): EhsEnvelope {
  const parsed = envelopeSchema.safeParse(raw);
  if (!parsed.success) throw new EhsProcedureError('Invalid procedure response', 502);
  const result = parsed.data;
  if (mappingKey(result.revision.mapping) !== mappingKey(config.mapping)) throw new EhsProcedureError('Source mapping mismatch', 502);
  if (revisionId && result.revision.id !== revisionId) throw new EhsProcedureError('Source revision mismatch', 502);
  if (ehsDigest(result.revision) !== result.digest) throw new EhsProcedureError('Source integrity check failed', 502);
  if (result.latest.sequence < result.revision.sequence || (result.latest.sequence === result.revision.sequence && (result.latest.id !== result.revision.id || result.latest.revision !== result.revision.revision)) || (result.latest.sequence > result.revision.sequence && (result.latest.id === result.revision.id || result.latest.revision === result.revision.revision))) {
    throw new EhsProcedureError('Inconsistent source revision history', 502);
  }
  return result;
}

async function requestSource(config: EhsConfig, revisionId?: string): Promise<unknown> {
  const url = new URL('/api/integrations/procedure-revisions', config.origin);
  for (const [key, value] of Object.entries(config.mapping)) url.searchParams.set(key, value);
  if (revisionId) url.searchParams.set('revisionId', revisionId);
  try {
    const response = await fetch(url, { headers: { Authorization: `Bearer ${config.token}`, Accept: 'application/json' }, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(7000) });
    if (!response.ok) throw new EhsProcedureError(`EHS source rejected the check (${response.status})`, 502);
    if (!response.headers.get('content-type')?.includes('application/json')) throw new EhsProcedureError('Invalid source response type', 502);
    const reader = response.body?.getReader();
    if (!reader) throw new EhsProcedureError('Empty source response', 502);
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > 25000000) { await reader.cancel(); throw new EhsProcedureError('Source response too large', 502); }
        chunks.push(chunk.value);
      }
    } finally { reader.releaseLock(); }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch (error) {
    if (error instanceof EhsProcedureError) throw error;
    throw new EhsProcedureError('EHS source unavailable; current status is unverified', 502);
  }
}

export async function fetchEhsRevision(config: EhsConfig, revisionId: string): Promise<EhsEnvelope> {
  return validateEhsEnvelope(await requestSource(config, revisionId), config, revisionId);
}

export async function initEhsAttachments(db: Client): Promise<void> {
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS ehs_procedure_binding(id INTEGER PRIMARY KEY CHECK(id=1), mapping TEXT NOT NULL);
    CREATE TRIGGER IF NOT EXISTS ehs_binding_no_update BEFORE UPDATE ON ehs_procedure_binding BEGIN SELECT RAISE(ABORT,'Pilot mapping is immutable'); END;
    CREATE TRIGGER IF NOT EXISTS ehs_binding_no_delete BEFORE DELETE ON ehs_procedure_binding BEGIN SELECT RAISE(ABORT,'Pilot mapping is immutable'); END;
    CREATE TABLE IF NOT EXISTS wo_ehs_procedure_attachments(
      work_order_id TEXT PRIMARY KEY, mapping TEXT NOT NULL, revision_id TEXT NOT NULL,
      payload TEXT NOT NULL, digest TEXT NOT NULL, context_digest TEXT NOT NULL,
      selected_by TEXT NOT NULL, selected_at TEXT NOT NULL
    );
    CREATE TRIGGER IF NOT EXISTS ehs_attachment_no_update BEFORE UPDATE ON wo_ehs_procedure_attachments BEGIN SELECT RAISE(ABORT,'Procedure attachment is immutable'); END;
    CREATE TRIGGER IF NOT EXISTS ehs_attachment_no_delete BEFORE DELETE ON wo_ehs_procedure_attachments BEGIN SELECT RAISE(ABORT,'Procedure attachment is immutable'); END;
  `);
}

export async function currentProcedureUser(db: Client | Transaction, userId: number) {
  const user = (await db.execute({ sql: 'SELECT id,username,role,active,force_password_change FROM users WHERE id=?', args: [userId] })).rows[0];
  if (!user || !user.active || user.force_password_change) throw new EhsProcedureError('Current sign-in required', 401);
  return { userId: Number(user.id), username: String(user.username), canAttach: ['admin', 'manager'].includes(String(user.role)) };
}

async function scopedWorkOrder(db: Client | Transaction, config: EhsConfig, workOrderId: string) {
  const binding = (await db.execute('SELECT mapping FROM ehs_procedure_binding WHERE id=1')).rows[0];
  if (binding && binding.mapping !== mappingKey(config.mapping)) throw new EhsProcedureError('Database mapping mismatch', 403);
  const workOrder = (await db.execute({ sql: 'SELECT * FROM work_orders WHERE id=?', args: [workOrderId] })).rows[0];
  if (!workOrder || workOrder.site_id !== config.mapping.cmmsSiteId) throw new EhsProcedureError('Work order outside configured site', 403);
  const site = await db.execute({ sql: 'SELECT id FROM sites WHERE id=?', args: [config.mapping.cmmsSiteId] });
  if (!site.rows.length) throw new EhsProcedureError('Configured CMMS site does not exist', 403);
  if (workOrder.asset_id) {
    const asset = (await db.execute({ sql: 'SELECT site_id FROM assets WHERE id=?', args: [workOrder.asset_id] })).rows[0];
    if (!asset || asset.site_id !== workOrder.site_id) throw new EhsProcedureError('Asset and work-order site mismatch', 403);
  }
  const contextDigest = ehsDigest([workOrder.id, workOrder.created_at, workOrder.site_id, workOrder.asset_id, workOrder.title, workOrder.description, workOrder.assigned_to, workOrder.type]);
  return { workOrder, contextDigest };
}

async function readAttachment(db: Client | Transaction, config: EhsConfig, workOrderId: string, contextDigest: string): Promise<EhsAttachment | null> {
  const row = (await db.execute({ sql: 'SELECT * FROM wo_ehs_procedure_attachments WHERE work_order_id=?', args: [workOrderId] })).rows[0];
  if (!row) return null;
  const parsed = approvedRevisionSchema.safeParse(JSON.parse(String(row.payload)));
  if (!parsed.success || row.mapping !== mappingKey(config.mapping) || mappingKey(parsed.data.mapping) !== mappingKey(config.mapping) || parsed.data.id !== row.revision_id || ehsDigest(parsed.data) !== row.digest) throw new EhsProcedureError('Stored attachment integrity check failed', 502);
  return { revision: parsed.data, digest: String(row.digest), selectedBy: String(row.selected_by), selectedAt: String(row.selected_at), contextChanged: row.context_digest !== contextDigest };
}

export async function attachEhsProcedure(db: Client, config: EhsConfig, userId: number, workOrderId: string, revisionId: string, expectedContext: string): Promise<void> {
  const user = await currentProcedureUser(db, userId);
  if (!user.canAttach) throw new EhsProcedureError('Planner permission required', 403);
  const initial = await scopedWorkOrder(db, config, workOrderId);
  if (initial.contextDigest !== expectedContext) throw new EhsProcedureError('Work order changed since preview. Reload and review.');
  const existing = await readAttachment(db, config, workOrderId, initial.contextDigest);
  if (existing) {
    if (existing.revision.id === revisionId) return;
    throw new EhsProcedureError('A revision is already attached. Automatic replacement is prohibited.');
  }
  const source = await fetchEhsRevision(config, revisionId);
  if (source.sourceState !== 'current' || source.latest.id !== source.revision.id) throw new EhsProcedureError('Only the current published revision can be newly attached');
  const tx = await db.transaction('write');
  try {
    const actor = await currentProcedureUser(tx, userId);
    if (!actor.canAttach) throw new EhsProcedureError('Planner permission required', 403);
    const current = await scopedWorkOrder(tx, config, workOrderId);
    if (current.contextDigest !== initial.contextDigest) throw new EhsProcedureError('Work order changed during selection. Reload and review.');
    const concurrent = await readAttachment(tx, config, workOrderId, current.contextDigest);
    if (concurrent) {
      if (concurrent.revision.id !== revisionId) throw new EhsProcedureError('Another revision was attached concurrently');
      await tx.commit();
      return;
    }
    await tx.execute({ sql: 'INSERT OR IGNORE INTO ehs_procedure_binding(id,mapping) VALUES(1,?)', args: [mappingKey(config.mapping)] });
    await tx.execute({ sql: 'INSERT INTO wo_ehs_procedure_attachments(work_order_id,mapping,revision_id,payload,digest,context_digest,selected_by,selected_at) VALUES(?,?,?,?,?,?,?,?)', args: [workOrderId, mappingKey(config.mapping), revisionId, JSON.stringify(source.revision), source.digest, current.contextDigest, actor.username, new Date().toISOString()] });
    await tx.execute({ sql: 'INSERT INTO audit_log(user_id,username,action,entity_type,entity_id,details) VALUES(?,?,?,?,?,?)', args: [userId, actor.username, 'ehs_procedure.attach', 'work_order', workOrderId, JSON.stringify({ revisionId, digest: source.digest, mapping: config.mapping })] });
    await tx.commit();
  } catch (error) { await tx.rollback(); throw error; }
  finally { tx.close(); }
}

export async function getEhsProcedureView(db: Client, config: EhsConfig, userId: number, workOrderId: string): Promise<EhsProcedureView> {
  const user = await currentProcedureUser(db, userId);
  const { contextDigest, workOrder } = await scopedWorkOrder(db, config, workOrderId);
  const attachment = await readAttachment(db, config, workOrderId, contextDigest);
  const view: EhsProcedureView = {
    enabled: true, attachment, options: [], canAttach: user.canAttach && !attachment,
    source: null, checkedAt: null, warning: null, contextDigest,
    workOrder: { title: String(workOrder.title), description: String(workOrder.description), assetId: String(workOrder.asset_id || ''), assignedTo: String(workOrder.assigned_to || '') },
  };
  try {
    if (attachment) {
      const source = await fetchEhsRevision(config, attachment.revision.id);
      if (source.digest !== attachment.digest) throw new EhsProcedureError('Source no longer matches the retained revision', 502);
      view.source = source;
    } else if (user.canAttach) {
      const list = z.object({ items: z.array(z.unknown()).max(100) }).strict().parse(await requestSource(config));
      view.options = list.items.map(item => validateEhsEnvelope(item, config));
      if (view.options.some(item => item.sourceState !== 'current' || item.latest.id !== item.revision.id) || new Set(view.options.map(item => item.revision.documentId)).size !== view.options.length) throw new EhsProcedureError('Inconsistent source catalogue', 502);
    }
    view.checkedAt = new Date().toISOString();
  } catch (error) {
    view.options = [];
    view.warning = error instanceof EhsProcedureError ? error.message : 'EHS source response is invalid';
  }
  await currentProcedureUser(db, userId);
  const final = await scopedWorkOrder(db, config, workOrderId);
  if (final.contextDigest !== contextDigest) { view.canAttach = false; view.warning = 'Work order changed during the check. Reload and review.'; }
  if (attachment) attachment.contextChanged ||= final.contextDigest !== contextDigest;
  return view;
}