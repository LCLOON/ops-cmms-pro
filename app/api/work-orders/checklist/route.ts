import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getWoChecklist, applyProcedureToWorkOrder, updateWoChecklistItem, deleteWoChecklistItem } from '@/lib/operations';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const woId = new URL(request.url).searchParams.get('woId');
    if (!woId) return NextResponse.json({ error: 'woId required' }, { status: 400 });
    return NextResponse.json(await getWoChecklist(woId));
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
    if (!body.workOrderId || !body.procedureId) {
      return NextResponse.json({ error: 'workOrderId and procedureId required' }, { status: 400 });
    }
    const items = await applyProcedureToWorkOrder(body.workOrderId, body.procedureId, session.displayName);
    return NextResponse.json(items);
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
    await updateWoChecklistItem({
      id: Number(body.id),
      completed: !!body.completed,
      resultValue: body.resultValue || '',
      resultStatus: body.resultStatus || '',
      notes: body.notes || '',
      completedBy: session.displayName,
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
    await deleteWoChecklistItem(Number(id));
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
