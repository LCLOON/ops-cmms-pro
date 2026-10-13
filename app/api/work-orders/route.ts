import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getWorkOrders, getWorkOrder, upsertWorkOrder, deleteWorkOrder } from '@/lib/operations';
import { workOrderSchema } from '@/lib/validations';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json(getWorkOrders());
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
    const wo = { ...parsed.data, id, completedDate: '', createdAt: now, updatedAt: now };
    upsertWorkOrder(wo);
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
    const existing = getWorkOrder(body.id);
    if (!existing) return NextResponse.json({ error: 'Work order not found' }, { status: 404 });
    upsertWorkOrder({ ...parsed.data, id: body.id, completedDate: existing.completedDate, createdAt: existing.createdAt, updatedAt: new Date().toISOString() });
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
    deleteWorkOrder(id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
