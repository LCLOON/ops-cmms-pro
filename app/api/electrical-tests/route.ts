import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { deleteTestingRecord, getTestingRecords, logAudit, upsertTestingRecord } from '@/lib/operations';
import { equipmentTestSchema } from '@/lib/validations';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json(await getTestingRecords());
  } catch (error) {
    console.error('[api/electrical-tests GET]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role === 'viewer') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body: unknown = await request.json();
    const parsed = equipmentTestSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

    const requestedId = typeof body === 'object' && body !== null && 'id' in body ? body.id : undefined;
    const id = typeof requestedId === 'string' && requestedId.trim() ? requestedId : 'TEST-' + Date.now().toString(36).toUpperCase();
    const record = { ...parsed.data, id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    await upsertTestingRecord(record);
    await logAudit({
      userId: session.userId, username: session.username,
      action: requestedId ? 'testing.update' : 'testing.create',
      entityType: 'equipment_test', entityId: id,
      details: `${record.discipline} ${record.testType} (${record.status})`,
    });
    return NextResponse.json(record);
  } catch (error) {
    console.error('[api/electrical-tests POST]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id } = await request.json();
    if (typeof id !== 'string' || !id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
    await deleteTestingRecord(id);
    await logAudit({ userId: session.userId, username: session.username, action: 'testing.delete', entityType: 'equipment_test', entityId: id, details: '' });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[api/electrical-tests DELETE]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
