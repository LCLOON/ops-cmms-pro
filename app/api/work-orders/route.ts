import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  getWorkOrders, getWorkOrder, getAsset, getSites, getPmSchedules, getTestingRecords,
  getInspections, getOilAnalysisRecords, upsertWorkOrder, deleteWorkOrder, getCompletionBlockers, logAudit,
} from '@/lib/operations';
import { workOrderSchema } from '@/lib/validations';

// Both POST (which upserts by id) and PUT write the status column directly, so
// the checklist completion gate lives here too — route handlers are the only
// real control; the form's status dropdown is not.
async function completionBlocker(id: string, nextStatus: string, currentStatus: string): Promise<string | null> {
  if (nextStatus !== 'completed' || currentStatus === 'completed') return null;
  const blockers = await getCompletionBlockers(id);
  return blockers.length > 0 ? `Cannot complete: ${blockers.join('; ')}` : null;
}

async function validateWorkOrderLinks(workOrder: {
  assetId: string; siteId: string; pmScheduleId: string;
  sourceTestingRecordId: string; sourceInspectionId: string; sourceOilAnalysisId: string;
}): Promise<string | null> {
  const asset = workOrder.assetId ? await getAsset(workOrder.assetId) : null;
  if (workOrder.assetId && !asset) return 'Asset not found';

  const [sites, pmSchedules, tests, inspections, oilAnalysisRecords] = await Promise.all([
    getSites(),
    getPmSchedules(),
    getTestingRecords(),
    getInspections(),
    getOilAnalysisRecords(),
  ]);
  if (workOrder.siteId && !sites.some(site => site.id === workOrder.siteId)) return 'Site not found';
  if (asset?.siteId && workOrder.siteId && asset.siteId !== workOrder.siteId) {
    return 'Work order site must match the selected asset';
  }
  if (workOrder.pmScheduleId) {
    const pm = pmSchedules.find(row => row.id === workOrder.pmScheduleId);
    if (!pm) return 'PM schedule not found';
    if (asset && pm.assetId && pm.assetId !== asset.id) return 'PM schedule belongs to a different asset';
  }
  if (workOrder.sourceTestingRecordId) {
    const test = tests.find(row => row.id === workOrder.sourceTestingRecordId);
    if (!test) return 'Testing record not found';
    if (asset && test.assetId && test.assetId !== asset.id) return 'Testing record belongs to a different asset';
  }
  if (workOrder.sourceInspectionId) {
    const inspection = inspections.find(row => row.id === workOrder.sourceInspectionId);
    if (!inspection) return 'Inspection not found';
    if (asset && inspection.assetId && inspection.assetId !== asset.id) return 'Inspection belongs to a different asset';
  }
  if (workOrder.sourceOilAnalysisId) {
    const record = oilAnalysisRecords.find(row => row.id === workOrder.sourceOilAnalysisId);
    if (!record) return 'Oil analysis record not found';
    if (asset && record.assetId !== asset.id) return 'Oil analysis record belongs to a different asset';
  }
  return null;
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json(await getWorkOrders());
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role === 'viewer') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body: unknown = await request.json();
    const parsed = workOrderSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

    const requestedId = typeof body === 'object' && body !== null && 'id' in body ? body.id : undefined;
    const id = typeof requestedId === 'string' && requestedId.trim() ? requestedId : 'WO-' + Date.now().toString(36).toUpperCase();
    const now = new Date().toISOString();
    // The seed work orders are inserted with a status, so only an existing row
    // that is *becoming* completed can be blocked.
    const priorRow = await getWorkOrder(id);
    const wo = {
      ...parsed.data,
      siteId: parsed.data.siteId || (parsed.data.assetId ? '' : priorRow?.siteId || ''),
      pmScheduleId: parsed.data.pmScheduleId || priorRow?.pmScheduleId || '',
      sourceTestingRecordId: parsed.data.sourceTestingRecordId || priorRow?.sourceTestingRecordId || '',
      sourceInspectionId: parsed.data.sourceInspectionId || priorRow?.sourceInspectionId || '',
      sourceOilAnalysisId: parsed.data.sourceOilAnalysisId || priorRow?.sourceOilAnalysisId || '',
      id,
      completedDate: priorRow?.completedDate ?? '',
      createdAt: priorRow?.createdAt ?? now,
      updatedAt: now,
    };
    const linkError = await validateWorkOrderLinks(wo);
    if (linkError) return NextResponse.json({ error: linkError }, { status: 400 });
    const blocked = await completionBlocker(id, parsed.data.status, priorRow?.status ?? '');
    if (blocked) return NextResponse.json({ error: blocked }, { status: 400 });

    // This handler upserts by id, so preserve the audit fields of an existing
    // record instead of blanking them — PUT already does this, and otherwise a
    // re-save through the form would erase the original completion date.
    await upsertWorkOrder(wo);
    await logAudit({
      userId: session.userId, username: session.username,
      action: priorRow ? 'work_order.update' : 'work_order.create',
      entityType: 'work_order', entityId: id,
      details: `${wo.title} (${wo.status})`,
    });
    return NextResponse.json(wo);
  } catch {
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
      return NextResponse.json({ error: 'Work order ID required' }, { status: 400 });
    }
    const parsed = workOrderSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
    const existing = await getWorkOrder(body.id);
    if (!existing) return NextResponse.json({ error: 'Work order not found' }, { status: 404 });
    const links = {
      ...parsed.data,
      siteId: parsed.data.siteId || (parsed.data.assetId ? '' : existing.siteId || ''),
      pmScheduleId: parsed.data.pmScheduleId || existing.pmScheduleId || '',
      sourceTestingRecordId: parsed.data.sourceTestingRecordId || existing.sourceTestingRecordId || '',
      sourceInspectionId: parsed.data.sourceInspectionId || existing.sourceInspectionId || '',
      sourceOilAnalysisId: parsed.data.sourceOilAnalysisId || existing.sourceOilAnalysisId || '',
    };
    const linkError = await validateWorkOrderLinks(links);
    if (linkError) return NextResponse.json({ error: linkError }, { status: 400 });
    const blocked = await completionBlocker(body.id, parsed.data.status, existing.status);
    if (blocked) return NextResponse.json({ error: blocked }, { status: 400 });

    await upsertWorkOrder({ ...links, id: body.id, completedDate: existing.completedDate, createdAt: existing.createdAt, updatedAt: new Date().toISOString() });
    await logAudit({
      userId: session.userId, username: session.username,
      action: 'work_order.update', entityType: 'work_order', entityId: body.id,
      details: `${parsed.data.title} (${existing.status} -> ${parsed.data.status})`,
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role === 'viewer') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
    await deleteWorkOrder(id);
    await logAudit({ userId: session.userId, username: session.username, action: 'work_order.delete', entityType: 'work_order', entityId: id, details: '' });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
