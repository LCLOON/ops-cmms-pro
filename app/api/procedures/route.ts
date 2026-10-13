import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getProcedures, getProcedure, upsertProcedure, deleteProcedure, approveProcedure, retireProcedure, getProcedureRevisions } from '@/lib/operations';
import { procedureSchema } from '@/lib/validations';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const params = new URL(request.url).searchParams;
    const id = params.get('id');
    if (id) {
      if (params.get('revisions') === '1') {
        return NextResponse.json(await getProcedureRevisions(id));
      }
      const procedure = await getProcedure(id);
      if (!procedure) return NextResponse.json({ error: 'Procedure not found' }, { status: 404 });
      return NextResponse.json(procedure);
    }
    // Optional asset scope: returns procedures for that asset plus generic ones.
    return NextResponse.json(await getProcedures(params.get('assetId') || undefined));
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
    await upsertProcedure(procedure, session.displayName, 'Created');
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
    // Editing an approved procedure drops it back to draft so it must be
    // re-approved — the previous approved revision stays in the audit log.
    if (existing.status === 'approved' && procedure.status === 'approved') {
      procedure.status = 'draft';
      procedure.approvedBy = '';
      procedure.approvedAt = '';
    }
    const changeNote = typeof body === 'object' && body !== null && 'changeNote' in body && typeof body.changeNote === 'string' ? body.changeNote : '';
    await upsertProcedure(procedure, session.displayName, changeNote || `Edited to v${procedure.version}`);
    return NextResponse.json(procedure);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Governance actions: approve or retire a procedure (managers/admins only).
export async function PATCH(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role !== 'admin' && session.role !== 'manager') {
      return NextResponse.json({ error: 'Only managers and admins can approve or retire procedures' }, { status: 403 });
    }
    const body = await request.json();
    const { id, action, changeNote } = body as { id?: string; action?: string; changeNote?: string };
    if (!id || !action) return NextResponse.json({ error: 'id and action required' }, { status: 400 });
    if (action === 'approve') {
      const result = await approveProcedure(id, session.displayName, changeNote || '');
      if (!result) return NextResponse.json({ error: 'Procedure not found' }, { status: 404 });
      return NextResponse.json(result);
    }
    if (action === 'retire') {
      const result = await retireProcedure(id, session.displayName);
      if (!result) return NextResponse.json({ error: 'Procedure not found' }, { status: 404 });
      return NextResponse.json(result);
    }
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
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
