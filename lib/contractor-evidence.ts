import { createHash, randomUUID } from 'node:crypto';
import type { Client } from '@libsql/client';
import { z } from 'zod';

const identifier = z.string().min(1).max(128).refine(value => value === value.trim());
const mappingSchema = z.object({
  customerId: identifier, sourceInstanceId: identifier, consumerInstanceId: identifier,
  consumerApp: z.enum(['ehs', 'loto', 'cmms']), consumerSiteId: identifier,
}).strict();
const bindingSchema = z.object({
  recordId: identifier,
  contractorId: identifier,
  contextDigest: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();

const evidenceSchema = z.object({
  schemaVersion: z.literal(1), mapping: mappingSchema, contractorId: identifier,
  requestId: z.string().uuid(), observedAt: z.string().datetime(), scope: z.literal('company-only'),
  workAuthorization: z.literal('not-established'), companyName: z.string().min(1).max(500),
  status: z.enum(['pending', 'approved', 'suspended', 'expired', 'disqualified']),
  approvalBasis: z.enum(['clean', 'override', 'unknown']),
  approvalExpiry: z.string().date().nullable(), insuranceExpiry: z.string().date().nullable(),
  orientationRecorded: z.boolean(),
  namedWorkers: z.object({ active: z.number().int().min(0), expired: z.number().int().min(0) }).strict().optional(),
  issues: z.array(z.string().min(1).max(500)).max(20),
}).strict();
export type ContractorEvidence = z.infer<typeof evidenceSchema>;

export class ContractorEvidenceError extends Error {
  status: number;
  constructor(message: string, status = 503) { super(message); this.status = status; }
}

export function getContractorEvidenceConfig(
  consumerApp: 'ehs' | 'loto' | 'cmms',
  env: Record<string, string | undefined> = process.env,
) {
  if (env.OPS_CONTRACTOR_EVIDENCE_ENABLED !== '1' || env.OPS_CONTRACTOR_DEDICATED_CUSTOMER_CONFIRMED !== '1') {
    throw new ContractorEvidenceError('Contractor evidence is disabled');
  }
  try {
    const mapping = mappingSchema.parse(JSON.parse(env.OPS_CONTRACTOR_EVIDENCE_MAPPING || ''));
    const bindings = z.array(bindingSchema).min(1).max(1000).parse(JSON.parse(env.OPS_CONTRACTOR_EVIDENCE_BINDINGS || ''));
    if (mapping.consumerApp !== consumerApp) throw new Error();
    if (new Set(bindings.map(binding => binding.recordId)).size !== bindings.length) throw new Error();
    const origin = new URL(env.OPS_CONTRACTOR_EVIDENCE_ORIGIN || '');
    if (origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash ||
      (origin.protocol !== 'https:' && !(env.NODE_ENV !== 'production' && origin.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname)))) throw new Error();
    const token = z.string().min(32).max(512).parse(env.OPS_CONTRACTOR_EVIDENCE_TOKEN);
    return { mapping, bindings, origin: origin.origin, token };
  } catch {
    throw new ContractorEvidenceError('Invalid contractor evidence configuration');
  }
}
export type ContractorEvidenceConfig = ReturnType<typeof getContractorEvidenceConfig>;

export function contractorContextDigest(context: unknown): string {
  return createHash('sha256').update(JSON.stringify(context)).digest('hex');
}

/** Throws 403 when no binding exists for this record, 409 when its context moved. */
export function resolveContractorBinding(
  config: ContractorEvidenceConfig,
  recordId: string,
  siteId: string,
  context: unknown,
) {
  const binding = config.bindings.find(candidate => candidate.recordId === recordId);
  if (siteId !== config.mapping.consumerSiteId || !binding) {
    throw new ContractorEvidenceError('No contractor binding for this record and site', 403);
  }
  if (binding.contextDigest !== contractorContextDigest(context)) {
    throw new ContractorEvidenceError('Record context changed; contractor binding needs review', 409);
  }
  return binding;
}

export function validateContractorEvidence(
  raw: unknown,
  config: ContractorEvidenceConfig,
  contractorId: string,
  requestId: string,
  now = Date.now(),
): ContractorEvidence {
  const parsed = evidenceSchema.safeParse(raw);
  if (!parsed.success) throw new ContractorEvidenceError('Invalid contractor evidence response', 502);
  const value = parsed.data;
  const age = now - Date.parse(value.observedAt);
  if (JSON.stringify(value.mapping) !== JSON.stringify(config.mapping) ||
    value.contractorId !== contractorId || value.requestId !== requestId ||
    age < -5000 || age > 60000) {
    throw new ContractorEvidenceError('Contractor evidence identity or freshness check failed', 502);
  }
  const issues = new Set(value.issues);
  if (value.status !== 'approved') issues.add(`Company status: ${value.status}`);
  if (value.approvalBasis === 'override') issues.add('Company approval was granted with an override of blocking findings');
  if (value.approvalBasis === 'unknown') issues.add('Company approval basis could not be verified');
  const today = new Date(now).toISOString().slice(0, 10);
  if (!value.approvalExpiry || value.approvalExpiry < today) issues.add('Company approval is expired or its expiry is unknown');
  if (!value.insuranceExpiry || value.insuranceExpiry < today) issues.add('Insurance is expired or its expiry is unknown');
  if (!value.orientationRecorded) issues.add('Company orientation evidence is missing or incomplete');
  return { ...value, issues: [...issues] };
}

export async function fetchContractorEvidence(
  config: ContractorEvidenceConfig,
  contractorId: string,
  fetcher: typeof fetch = fetch,
): Promise<ContractorEvidence> {
  const requestId = randomUUID();
  const url = new URL('/api/integrations/contractor-evidence', config.origin);
  url.search = new URLSearchParams({ ...config.mapping, contractorId, requestId }).toString();
  try {
    const response = await fetcher(url, {
      headers: { Authorization: `Bearer ${config.token}`, Accept: 'application/json' },
      cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(7000),
    });
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json') || !response.body) throw new Error();
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 32768) { await reader.cancel(); throw new Error(); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    return validateContractorEvidence(JSON.parse(Buffer.concat(chunks).toString('utf8')), config, contractorId, requestId);
  } catch (error) {
    if (error instanceof ContractorEvidenceError) throw error;
    throw new ContractorEvidenceError('Contractor source unavailable; no current evidence established');
  }
}

/**
 * Pre-start contractor check.
 *
 * The procedure gate can only prove what it already knows locally. This one asks the
 * app that owns the company record, because "is this contractor cleared?" is not a
 * question CMMS can answer from its own tables.
 *
 * Two deliberate choices:
 *
 * - **Unknown blocks.** An outage, a rejected credential or an unreadable response is
 *   not evidence of clearance. `OPS_CONTRACTOR_GATE_MODE=advisory` exists for a planned
 *   outage or a staged rollout, and it is a configuration change an owner makes
 *   knowingly — not a bypass a user can click through.
 * - **Only bound jobs are affected.** A work order with no contractor binding is never
 *   gated, so enabling this cannot surprise a site that has not configured it.
 */
export type GateMode = 'enforce' | 'advisory';

export function gateMode(env: Record<string, string | undefined> = process.env): GateMode {
  return env.OPS_CONTRACTOR_GATE_MODE === 'advisory' ? 'advisory' : 'enforce';
}

/** Reasons that mean the company record itself is not currently clear. */
export function companyBlockers(
  evidence: {
    status: string;
    approvalBasis: string;
    approvalExpiry: string | null;
    insuranceExpiry: string | null;
  },
  today = new Date().toISOString().slice(0, 10),
): string[] {
  const reasons: string[] = [];
  if (evidence.status !== 'approved') reasons.push(`company status is ${evidence.status}`);
  if (evidence.approvalBasis === 'override') reasons.push('approval was granted with an override of blocking findings');
  if (evidence.approvalBasis === 'unknown') reasons.push('approval basis could not be verified');
  if (!evidence.approvalExpiry) reasons.push('company approval expiry is unknown');
  else if (evidence.approvalExpiry < today) reasons.push(`company approval expired on ${evidence.approvalExpiry}`);
  if (!evidence.insuranceExpiry) reasons.push('insurance expiry is unknown');
  else if (evidence.insuranceExpiry < today) reasons.push(`insurance expired on ${evidence.insuranceExpiry}`);
  return reasons;
}

export async function contractorStartBlocker(
  db: Client,
  workOrderId: string,
  env: Record<string, string | undefined> = process.env,
  fetcher: typeof fetch = fetch,
): Promise<string | null> {
  let config: ContractorEvidenceConfig;
  try { config = getContractorEvidenceConfig('cmms', env); } catch { return null; }

  const row = (await db.execute({ sql: 'SELECT * FROM work_orders WHERE id=?', args: [workOrderId] })).rows[0];
  if (!row) return null;

  // Same field order as the EHS procedure digest, so an operator computes one value.
  const context = [row.id, row.created_at, row.site_id, row.asset_id, row.title, row.description, row.assigned_to, row.type];
  let binding: { contractorId: string };
  try {
    binding = resolveContractorBinding(config, workOrderId, String(row.site_id ?? ''), context);
  } catch (error) {
    // No binding for this job is "not applicable", not a refusal. A changed context is a
    // refusal: the clearance was granted for a job that no longer exists.
    if (error instanceof Error && error.message.includes('No contractor binding')) return null;
    return 'Cannot start: this work order no longer matches the scope its contractor clearance was reviewed against. Re-review the assignment before starting.';
  }

  const mode = gateMode(env);
  try {
    const evidence = await fetchContractorEvidence(config, binding.contractorId, fetcher);
    const reasons = companyBlockers(evidence);
    if (reasons.length === 0) return null;
    const message = `Cannot start: contractor ${evidence.companyName} is not clear — ${reasons.join('; ')}. Review the source record before starting work.`;
    if (mode === 'advisory') { console.warn(`[contractor-gate] ${workOrderId}: ${message}`); return null; }
    return message;
  } catch (error) {
    console.warn(`[contractor-gate] ${workOrderId}: ${error instanceof Error ? error.message : String(error)}`);
    const message = 'Cannot start: contractor clearance could not be verified, so no current evidence is established. Retry when the contractor system is reachable, or record the outage with an administrator.';
    if (mode === 'advisory') { console.warn(`[contractor-gate] ${workOrderId}: ${message}`); return null; }
    return message;
  }
}

/** Exported for tests: the digest an operator must review, from a work-order row. */
export function workOrderContractorContext(row: Record<string, unknown>): string {
  return contractorContextDigest([row.id, row.created_at, row.site_id, row.asset_id, row.title, row.description, row.assigned_to, row.type]);
}
