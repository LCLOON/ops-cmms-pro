import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getUsers, upsertUser, deleteUser, logAudit } from '@/lib/operations';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ users: await getUsers() });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const body = await request.json();
    await upsertUser(body);
    await logAudit({
      userId: session.userId, username: session.username,
      action: 'user.upsert', entityType: 'user', entityId: String(body.username || ''),
      details: `role=${body.role ?? '?'} active=${body.active ?? '?'} passwordReset=${body.password ? 'yes' : 'no'}`,
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    await deleteUser(id);
    await logAudit({ userId: session.userId, username: session.username, action: 'user.delete', entityType: 'user', entityId: String(id), details: '' });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
