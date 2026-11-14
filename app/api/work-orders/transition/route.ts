import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { transitionWorkOrderStatus, getValidStatusTransitions, getWorkOrder, logAudit } from '@/lib/operations';

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role === 'viewer') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id, status } = await request.json();
    if (!id || !status) return NextResponse.json({ error: 'id and status required' }, { status: 400 });

    // Read the prior status BEFORE transitioning — reading afterwards records
    // the new value twice and loses the before/after pair.
    const prior = await getWorkOrder(id);

    const result = await transitionWorkOrderStatus(id, status);
    if (!result.ok) return NextResponse.json({ error: result.error || 'Invalid status transition' }, { status: 400 });

    // Status changes are the compliance-critical work-order events, so record
    // the before/after rather than just the new value.
    await logAudit({
      userId: session.userId, username: session.username,
      action: 'work_order.transition', entityType: 'work_order', entityId: id,
      details: `${prior?.status ?? '?'} -> ${status}`,
    });

    return NextResponse.json({ success: true, validTransitions: getValidStatusTransitions(status) });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    if (!status) return NextResponse.json({ error: 'status required' }, { status: 400 });
    const transitions = getValidStatusTransitions(status);
    return NextResponse.json({ transitions });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
