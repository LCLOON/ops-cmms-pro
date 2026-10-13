import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getComplianceObligations, deleteComplianceObligation, upsertComplianceObligation } from '@/lib/operations';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json(await getComplianceObligations());
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
    if (!body.title) return NextResponse.json({ error: 'Title required' }, { status: 400 });
    const id = body.id || 'COMP-' + Date.now().toString(36).toUpperCase();
    const obligation = { ...body, id, updatedAt: new Date().toISOString() };
    await upsertComplianceObligation(obligation);
    return NextResponse.json(obligation);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
    await deleteComplianceObligation(id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

