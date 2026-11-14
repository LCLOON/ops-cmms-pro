import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getWoParts, addWoPart, deleteWoPart, StockError } from '@/lib/operations';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { searchParams } = new URL(request.url);
    const woId = searchParams.get('woId');
    if (!woId) return NextResponse.json({ error: 'woId required' }, { status: 400 });
    return NextResponse.json(await getWoParts(woId));
  } catch (err) {
    console.error('[api/work-orders/parts GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role === 'viewer') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    if (!body.workOrderId || !body.inventoryItemId) return NextResponse.json({ error: 'workOrderId and inventoryItemId required' }, { status: 400 });

    const part = await addWoPart(body);
    return NextResponse.json(part);
  } catch (err) {
    // Stock problems are user-fixable, not server faults.
    if (err instanceof StockError) return NextResponse.json({ error: err.message }, { status: 400 });
    console.error('[api/work-orders/parts POST]', err);
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
    await deleteWoPart(Number(id));
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[api/work-orders/parts DELETE]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
