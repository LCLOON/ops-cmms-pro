import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getWoLabor, addWoLabor, deleteWoLabor } from '@/lib/operations';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { searchParams } = new URL(request.url);
    const woId = searchParams.get('woId');
    if (!woId) return NextResponse.json({ error: 'woId required' }, { status: 400 });
    return NextResponse.json(getWoLabor(woId));
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
    if (!body.workOrderId) return NextResponse.json({ error: 'workOrderId required' }, { status: 400 });

    const entry = addWoLabor({
      workOrderId: body.workOrderId,
      userId: body.userId || session.userId,
      username: body.username || session.displayName,
      hours: body.hours || 0,
      loggedDate: body.loggedDate || new Date().toISOString().slice(0, 10),
      notes: body.notes || '',
    });
    return NextResponse.json(entry);
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
    deleteWoLabor(id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
