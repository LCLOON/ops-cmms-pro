import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getPurchaseOrders, upsertPurchaseOrder, deletePurchaseOrder } from '@/lib/operations';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json(await getPurchaseOrders());
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
    const id = body.id || 'PO-' + Date.now().toString(36).toUpperCase();
    const po = { ...body, id, createdBy: body.createdBy || session.displayName, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    await upsertPurchaseOrder(po);
    return NextResponse.json(po);
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
    if (!body.id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
    const existing = (await getPurchaseOrders()).find(p => p.id === body.id);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const updated = { ...existing, ...body, updatedAt: new Date().toISOString() };
    await upsertPurchaseOrder(updated);
    return NextResponse.json(updated);
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
    await deletePurchaseOrder(id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
