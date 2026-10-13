import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getWorkOrders, getWorkOrder, upsertWorkOrder, deleteWorkOrder, getCompletionBlockers } from '@/lib/operations';
import { workOrderSchema } from '@/lib/validations';

// Both POST (which upserts by id) and PUT write the status column directly, so
// the checklist completion gate lives here too — route handlers are the only
// real control; the form's status dropdown is not.
async function completionBlocker(id: string, nextStatus: string, currentStatus: string): Promise<string | null> {
  if (nextStatus !== 'completed' || currentStatus === 'completed') return null;
  const blockers = await getCompletionBlockers(id);
  return blockers.length > 0 ? `Cannot complete: ${blockers.join('; ')}` : null;
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
    // The seed work orders are inserted with a status, so only an existing row
    // that is *becoming* completed can be blocked.
    const priorRow = await getWorkOrder(id);
    const blocked = await completionBlocker(id, parsed.data.status, priorRow?.status ?? '');
    if (blocked) return NextResponse.json({ error: blocked }, { status: 400 });

    const now = new Date().toISOString();
    // This handler upserts by id, so preserve the audit fields of an existing
    // record instead of blanking them — PUT already does this, and otherwise a
    // re-save through the form would erase the original completion date.
    const wo = {
      ...parsed.data,
      id,
      completedDate: priorRow?.completedDate ?? '',
      createdAt: priorRow?.createdAt ?? now,
      updatedAt: now,
    };
    await upsertWorkOrder(wo);
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
    const blocked = await completionBlocker(body.id, parsed.data.status, existing.status);
    if (blocked) return NextResponse.json({ error: blocked }, { status: 400 });

    await upsertWorkOrder({ ...parsed.data, id: body.id, completedDate: existing.completedDate, createdAt: existing.createdAt, updatedAt: new Date().toISOString() });
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
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
