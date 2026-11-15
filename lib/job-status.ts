import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

/**
 * CMMS becomes the source of truth for "does this job exist, and is it still open?".
 * Lockout records a reference to it; this module answers for exactly one work order.
 *
 * Deliberately narrow: no description, no costs, no customer data — a work-order
 * reference is all Lockout needs to decide whether a job sharing an isolation is done.
 */

const identifier = z.string().min(1).max(128).refine(value => value === value.trim());
export const jobMappingSchema = z.object({
  customerId: identifier,
  cmmsInstanceId: identifier,
  consumerInstanceId: identifier,
  consumerApp: z.literal('loto'),
  consumerSiteId: identifier,
}).strict();
export type JobMapping = z.infer<typeof jobMappingSchema>;

export const workOrderStatusSchema = z.object({
  schemaVersion: z.literal(1),
  mapping: jobMappingSchema,
  workOrderId: identifier,
  requestId: z.string().uuid(),
  observedAt: z.string().datetime(),
  title: z.string().max(500),
  status: z.enum(['open', 'in_progress', 'on_hold', 'completed', 'cancelled']),
  assetId: z.string().max(128),
  siteId: identifier,
  assignedTo: z.string().max(200),
}).strict();
export type WorkOrderStatus = z.infer<typeof workOrderStatusSchema>;

export class JobStatusError extends Error {
  status: number;
  constructor(message: string, status = 503) { super(message); this.status = status; }
}

export interface JobStatusConfig { mapping: JobMapping; token: string }

export function getJobStatusConfig(env: Record<string, string | undefined> = process.env): JobStatusConfig {
  if (env.OPS_CMMS_JOB_STATUS_ENABLED !== '1') throw new JobStatusError('Job status endpoint is disabled');
  try {
    const mapping = jobMappingSchema.parse(JSON.parse(env.OPS_CMMS_JOB_STATUS_MAPPING || ''));
    const token = z.string().min(32).max(512).parse(env.OPS_CMMS_JOB_STATUS_TOKEN);
    return { mapping, token };
  } catch {
    throw new JobStatusError('Invalid job status configuration');
  }
}

const QUERY_KEYS = [...Object.keys(jobMappingSchema.shape), 'workOrderId', 'requestId'] as const;

/** Every scope field exactly once, plus the work order and a replay nonce. */
export function authorizeJobStatusRequest(request: Request, config: JobStatusConfig) {
  const query = new URL(request.url).searchParams;
  if ([...query.keys()].some(key => !(QUERY_KEYS as readonly string[]).includes(key)) ||
    QUERY_KEYS.some(key => query.getAll(key).length !== 1)) {
    throw new JobStatusError('Exact work-order scope is required', 403);
  }
  const supplied = Buffer.from(request.headers.get('authorization') || '');
  const expected = Buffer.from(`Bearer ${config.token}`);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    throw new JobStatusError('Unauthorized', 401);
  }
  const mapping = jobMappingSchema.safeParse(
    Object.fromEntries(Object.keys(jobMappingSchema.shape).map(key => [key, query.get(key)])),
  );
  const workOrderId = identifier.safeParse(query.get('workOrderId'));
  const requestId = z.string().uuid().safeParse(query.get('requestId'));
  if (!mapping.success || !workOrderId.success || !requestId.success) throw new JobStatusError('Invalid job status request', 400);
  if (JSON.stringify(mapping.data) !== JSON.stringify(config.mapping)) throw new JobStatusError('Scope rejected', 403);
  return { mapping: mapping.data, workOrderId: workOrderId.data, requestId: requestId.data };
}

/** Pure: builds the response from a work-order row, refusing anything out of scope. */
export function buildWorkOrderStatus(
  row: Record<string, unknown> | undefined,
  scope: ReturnType<typeof authorizeJobStatusRequest>,
  now = new Date(),
): WorkOrderStatus {
  if (!row) throw new JobStatusError('Work order not found', 404);
  if (String(row.site_id ?? '') !== scope.mapping.consumerSiteId) {
    throw new JobStatusError('Work order is outside the configured site', 403);
  }
  return {
    schemaVersion: 1,
    mapping: scope.mapping,
    workOrderId: scope.workOrderId,
    requestId: scope.requestId,
    observedAt: now.toISOString(),
    title: String(row.title ?? '').slice(0, 500),
    status: workOrderStatusSchema.shape.status.parse(String(row.status ?? 'open')),
    assetId: String(row.asset_id ?? '').slice(0, 128),
    siteId: scope.mapping.consumerSiteId,
    assignedTo: String(row.assigned_to ?? '').slice(0, 200),
  };
}
