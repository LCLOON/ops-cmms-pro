import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createFollowUpWorkOrder } from '@/lib/operations';

// Raise a corrective work order from a failed checklist step and link it back.
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role === 'viewer') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    if (!body.checklistItemId) return NextResponse.json({ error: 'checklistItemId required' }, { status: 400 });

    const woId = await createFollowUpWorkOrder(Number(body.checklistItemId), session.displayName);
    if (!woId) return NextResponse.json({ error: 'Checklist step not found' }, { status: 404 });
    return NextResponse.json({ success: true, workOrderId: woId });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
