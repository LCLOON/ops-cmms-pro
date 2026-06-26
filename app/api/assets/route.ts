import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getAssets, upsertAsset, deleteAsset, getAsset } from '@/lib/operations';
import { assetSchema } from '@/lib/validations';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json(getAssets());
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
    const parsed = assetSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

    const id = body.id || 'AST-' + Date.now().toString(36).toUpperCase();
    const asset = { ...parsed.data, id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    upsertAsset(asset);
    return NextResponse.json(asset);
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
    if (!body.id) return NextResponse.json({ error: 'Asset ID required' }, { status: 400 });
    const existing = getAsset(body.id);
    if (!existing) return NextResponse.json({ error: 'Asset not found' }, { status: 404 });

    const updated = { ...existing, ...body, updatedAt: new Date().toISOString() };
    upsertAsset(updated);
    return NextResponse.json(updated);
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
    deleteAsset(id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
