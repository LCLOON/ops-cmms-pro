import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getAsset, getSafetyPermits, getWorkOrders, deleteSafetyPermit, logAudit, upsertSafetyPermit } from '@/lib/operations';
import { safetyPermitSchema } from '@/lib/validations';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json(await getSafetyPermits());
  } catch (error) {
    console.error('[api/safety GET]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role === 'viewer') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const body: unknown = await request.json();
    const parsed = safetyPermitSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

    const workOrders = await getWorkOrders();
    const workOrder = parsed.data.workOrderId
      ? workOrders.find(item => item.id === parsed.data.workOrderId)
      : undefined;
    if (parsed.data.workOrderId && !workOrder) return NextResponse.json({ error: 'Work order not found' }, { status: 400 });
    if (workOrder?.assetId && parsed.data.assetId && workOrder.assetId !== parsed.data.assetId) {
      return NextResponse.json({ error: 'Permit asset must match its linked work order' }, { status: 400 });
    }

    const assetId = parsed.data.assetId || workOrder?.assetId || '';
    const asset = assetId ? await getAsset(assetId) : null;
    if (assetId && !asset) return NextResponse.json({ error: 'Asset not found' }, { status: 400 });
    if (workOrder?.siteId && asset?.siteId && workOrder.siteId !== asset.siteId) {
      return NextResponse.json({ error: 'Permit asset must belong to the work order site' }, { status: 400 });
    }

    const requestedId = typeof body === 'object' && body !== null && 'id' in body ? body.id : undefined;
    const id = typeof requestedId === 'string' && requestedId.trim() ? requestedId : 'SP-' + Date.now().toString(36).toUpperCase();
    const permit = {
      ...parsed.data,
      assetId,
      id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await upsertSafetyPermit(permit);
    await logAudit({
      userId: session.userId, username: session.username,
      action: requestedId ? 'safety_permit.update' : 'safety_permit.create',
      entityType: 'safety_permit', entityId: id,
      details: `${permit.permitType} ${permit.permitNumber} (${permit.status})`,
    });
    return NextResponse.json(permit);
  } catch (error) {
    console.error('[api/safety POST]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
    await deleteSafetyPermit(id);
    await logAudit({ userId: session.userId, username: session.username, action: 'safety_permit.delete', entityType: 'safety_permit', entityId: id, details: '' });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[api/safety DELETE]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

