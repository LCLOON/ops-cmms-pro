import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getPmSchedules, upsertPmSchedule, deletePmSchedule } from '@/lib/operations';
import { pmScheduleSchema } from '@/lib/validations';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json(await getPmSchedules());
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
    const parsed = pmScheduleSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

    const id = body.id || 'PM-' + Date.now().toString(36).toUpperCase();
    const pm = { ...parsed.data, id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    await upsertPmSchedule(pm);
    return NextResponse.json(pm);
  } catch (err) {
    console.error('[api/pm-tasks POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role === 'viewer') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    if (!body.id) return NextResponse.json({ error: 'PM ID required' }, { status: 400 });
    const existing = (await getPmSchedules()).find(p => p.id === body.id);
    if (!existing) return NextResponse.json({ error: 'PM schedule not found' }, { status: 404 });

    const updated = { ...existing, ...body, updatedAt: new Date().toISOString() };
    await upsertPmSchedule(updated);
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
    await deletePmSchedule(id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
