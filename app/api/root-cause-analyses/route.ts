import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  deleteRootCauseAnalysis, getAsset, getRootCauseAnalyses, getRootCauseAnalysis,
  getWorkOrder, logAudit, upsertRootCauseAnalysis,
} from '@/lib/operations';
import { rootCauseAnalysisSchema } from '@/lib/validations';

async function validateLinks(assetId: string, workOrderId: string): Promise<string | null> {
  if (!await getAsset(assetId)) return 'Asset not found';
  if (!workOrderId) return null;
  const workOrder = await getWorkOrder(workOrderId);
  if (!workOrder) return 'Linked work order not found';
  if (workOrder.assetId && workOrder.assetId !== assetId) return 'Linked work order belongs to a different asset';
  return null;
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json(await getRootCauseAnalyses());
  } catch (error) {
    console.error('[api/root-cause-analyses GET]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role === 'viewer') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body: unknown = await request.json();
    const parsed = rootCauseAnalysisSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
    const invalidLink = await validateLinks(parsed.data.assetId, parsed.data.workOrderId);
    if (invalidLink) return NextResponse.json({ error: invalidLink }, { status: 400 });

    const now = new Date().toISOString();
    const analysis = {
      ...parsed.data,
      id: 'RCA-' + Date.now().toString(36).toUpperCase(),
      createdBy: session.displayName,
      createdAt: now,
      updatedAt: now,
    };
    await upsertRootCauseAnalysis(analysis);
    await logAudit({
      userId: session.userId, username: session.username,
      action: 'root_cause.create', entityType: 'root_cause_analysis',
      entityId: analysis.id, details: `${analysis.failureMode || 'Equipment failure'} (${analysis.status})`,
    });
    return NextResponse.json(analysis);
  } catch (error) {
    console.error('[api/root-cause-analyses POST]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role === 'viewer') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body: unknown = await request.json();
    if (typeof body !== 'object' || body === null || !('id' in body) || typeof body.id !== 'string' || !body.id) {
      return NextResponse.json({ error: 'Analysis ID required' }, { status: 400 });
    }
    const existing = await getRootCauseAnalysis(body.id);
    if (!existing) return NextResponse.json({ error: 'Analysis not found' }, { status: 404 });
    const parsed = rootCauseAnalysisSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
    const invalidLink = await validateLinks(parsed.data.assetId, parsed.data.workOrderId);
    if (invalidLink) return NextResponse.json({ error: invalidLink }, { status: 400 });

    const analysis = { ...parsed.data, id: existing.id, createdBy: existing.createdBy, createdAt: existing.createdAt, updatedAt: new Date().toISOString() };
    await upsertRootCauseAnalysis(analysis);
    await logAudit({
      userId: session.userId, username: session.username,
      action: 'root_cause.update', entityType: 'root_cause_analysis',
      entityId: analysis.id, details: `${analysis.failureMode || 'Equipment failure'} (${analysis.status})`,
    });
    return NextResponse.json(analysis);
  } catch (error) {
    console.error('[api/root-cause-analyses PUT]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id } = await request.json();
    if (typeof id !== 'string' || !id) return NextResponse.json({ error: 'Analysis ID required' }, { status: 400 });
    const existing = await getRootCauseAnalysis(id);
    if (!existing) return NextResponse.json({ error: 'Analysis not found' }, { status: 404 });
    await deleteRootCauseAnalysis(id);
    await logAudit({ userId: session.userId, username: session.username, action: 'root_cause.delete', entityType: 'root_cause_analysis', entityId: id, details: existing.failureMode });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[api/root-cause-analyses DELETE]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
