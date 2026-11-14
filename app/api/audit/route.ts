import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getAuditLog } from '@/lib/operations';

// Read-only view of the audit trail. Admin-only: the log records who changed
// what across work orders, procedures, assets, users and settings.
export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const limitParam = new URL(request.url).searchParams.get('limit');
    const limit = limitParam ? Number(limitParam) : 100;
    return NextResponse.json({ entries: await getAuditLog(limit) });
  } catch (err) {
    console.error('[api/audit GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
