import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { generateWorkOrderFromPm } from '@/lib/operations';

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role === 'viewer') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { pmId } = await request.json();
    if (!pmId) return NextResponse.json({ error: 'pmId required' }, { status: 400 });

    const woId = await generateWorkOrderFromPm(pmId, session.userId, session.displayName);
    if (!woId) return NextResponse.json({ error: 'PM schedule not found' }, { status: 404 });

    return NextResponse.json({ success: true, workOrderId: woId });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
