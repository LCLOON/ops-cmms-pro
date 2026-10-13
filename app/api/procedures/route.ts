import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getProcedures, getProcedure, upsertProcedure, deleteProcedure } from '@/lib/operations';
import { procedureSchema } from '@/lib/validations';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const id = new URL(request.url).searchParams.get('id');
    if (id) {
      const procedure = await getProcedure(id);
      if (!procedure) return NextResponse.json({ error: 'Procedure not found' }, { status: 404 });
      return NextResponse.json(procedure);
    }
    return NextResponse.json(await getProcedures());
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role === 'viewer') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body: unknown = await request.json();
    const parsed = procedureSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

    const requestedId = typeof body === 'object' && body !== null && 'id' in body ? body.id : undefined;
    const id = typeof requestedId === 'string' && requestedId.trim() ? requestedId : 'SOP-' + Date.now().toString(36).toUpperCase();
    const now = new Date().toISOString();
    const procedure = { ...parsed.data, id, createdAt: now, updatedAt: now, steps: parsed.data.steps.map((s, i) => ({ ...s, id: 0, procedureId: id, stepOrder: s.stepOrder || i + 1 })) };
    await upsertProcedure(procedure);
    return NextResponse.json(procedure);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role === 'viewer') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body: unknown = await request.json();
    if (typeof body !== 'object' || body === null || !('id' in body) || typeof body.id !== 'string' || !body.id) {
      return NextResponse.json({ error: 'Procedure ID required' }, { status: 400 });
    }
    const existing = await getProcedure(body.id);
    if (!existing) return NextResponse.json({ error: 'Procedure not found' }, { status: 404 });

    const parsed = procedureSchema.safeParse({ ...existing, ...body });
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

    const procedure = {
      ...parsed.data,
      id: body.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
      steps: parsed.data.steps.map((s, i) => ({ ...s, id: 0, procedureId: body.id as string, stepOrder: s.stepOrder || i + 1 })),
    };
    await upsertProcedure(procedure);
    return NextResponse.json(procedure);
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
    await deleteProcedure(id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
