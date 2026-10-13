import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { transitionWorkOrderStatus, getValidStatusTransitions } from '@/lib/operations';

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role === 'viewer') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id, status } = await request.json();
    if (!id || !status) return NextResponse.json({ error: 'id and status required' }, { status: 400 });

    const ok = transitionWorkOrderStatus(id, status);
    if (!ok) return NextResponse.json({ error: 'Invalid status transition' }, { status: 400 });

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
