import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { attachEhsProcedure, EhsProcedureError, getEhsConfig, getEhsProcedureView } from '@/lib/ehs-procedures';

export const runtime = 'nodejs';
const headers = { 'Cache-Control': 'private, no-store' };
const id = z.string().min(1).max(128);
const selectionSchema = z.object({ workOrderId: id, revisionId: id, contextDigest: z.string().regex(/^[a-f0-9]{64}$/) }).strict();

function failure(error: unknown) {
  return Response.json({ error: error instanceof EhsProcedureError ? error.message : 'Procedure check failed; reload before retrying' }, { status: error instanceof EhsProcedureError ? error.status : 503, headers });
}

export async function GET(request: Request) {
  try {
    const config = getEhsConfig();
    const session = await getSession();
    if (!session || session.forcePasswordChange) throw new EhsProcedureError('Sign-in required', 401);
    const params = new URL(request.url).searchParams;
    if ([...params.keys()].some(key => key !== 'workOrderId') || params.getAll('workOrderId').length !== 1) throw new EhsProcedureError('Invalid work-order request', 400);
    const workOrderId = id.safeParse(params.get('workOrderId'));
    if (!workOrderId.success) throw new EhsProcedureError('Work-order ID required', 400);
    return Response.json(await getEhsProcedureView(await getDb(), config, session.userId, workOrderId.data), { headers });
  } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  try {
    const config = getEhsConfig();
    const url = new URL(request.url);
    const origin = `${url.protocol}//${request.headers.get('host') || url.host}`;
    if (request.headers.get('origin') !== origin) throw new EhsProcedureError('Same-origin request required', 403);
    const session = await getSession();
    if (!session || session.forcePasswordChange) throw new EhsProcedureError('Sign-in required', 401);
    const raw = await request.text();
    if (raw.length > 1000) throw new EhsProcedureError('Selection payload too large', 413);
    let body: unknown;
    try { body = JSON.parse(raw); } catch { throw new EhsProcedureError('Invalid request', 400); }
    const parsed = selectionSchema.safeParse(body);
    if (!parsed.success) throw new EhsProcedureError('Work-order and revision IDs required', 400);
    await attachEhsProcedure(await getDb(), config, session.userId, parsed.data.workOrderId, parsed.data.revisionId, parsed.data.contextDigest);
    return Response.json({ attached: true }, { headers });
  } catch (error) { return failure(error); }
}