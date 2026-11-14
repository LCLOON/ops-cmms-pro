import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { deleteOilAnalysisRecord, getAsset, getOilAnalysisRecords, logAudit, upsertOilAnalysisRecord } from '@/lib/operations';
import { oilAnalysisSchema } from '@/lib/validations';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json(await getOilAnalysisRecords());
  } catch (error) {
    console.error('[api/oil-analysis GET]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role === 'viewer') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body: unknown = await request.json();
    const parsed = oilAnalysisSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
    if (!(await getAsset(parsed.data.assetId))) return NextResponse.json({ error: 'Asset not found' }, { status: 400 });

    const requestedId = typeof body === 'object' && body !== null && 'id' in body ? body.id : undefined;
    const id = typeof requestedId === 'string' && requestedId.trim()
      ? requestedId
      : 'OIL-' + Date.now().toString(36).toUpperCase();
    const now = new Date().toISOString();
    const record = { ...parsed.data, id, createdAt: now, updatedAt: now };
    await upsertOilAnalysisRecord(record);
    await logAudit({
      userId: session.userId, username: session.username,
      action: requestedId ? 'oil_analysis.update' : 'oil_analysis.create',
      entityType: 'oil_analysis', entityId: id,
      details: `${record.sampleType} sample for ${record.assetId} (${record.assessment})`,
    });
    return NextResponse.json(record);
  } catch (error) {
    console.error('[api/oil-analysis POST]', error);
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
    await deleteOilAnalysisRecord(id);
    await logAudit({ userId: session.userId, username: session.username, action: 'oil_analysis.delete', entityType: 'oil_analysis', entityId: id, details: '' });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[api/oil-analysis DELETE]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
