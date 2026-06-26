import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getWorkOrders, upsertWorkOrder, deleteWorkOrder } from '@/lib/operations';
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

    const body = await request.json();
    const parsed = workOrderSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

    const id = body.id || 'WO-' + Date.now().toString(36).toUpperCase();
    const wo = { ...parsed.data, id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
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

    const body = await request.json();
    if (!body.id) return NextResponse.json({ error: 'Work order ID required' }, { status: 400 });
    upsertWorkOrder({ ...body, updatedAt: new Date().toISOString() });
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
