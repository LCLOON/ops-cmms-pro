import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { JobStatusError, authorizeJobStatusRequest, buildWorkOrderStatus, getJobStatusConfig } from '@/lib/job-status';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };

/** Service-authenticated read of one work order. Adds no access to ordinary business APIs. */
export async function GET(request: Request) {
  try {
    const config = getJobStatusConfig();
    const scope = authorizeJobStatusRequest(request, config);
    const db = await getDb();
    const row = (await db.execute({ sql: 'SELECT * FROM work_orders WHERE id=?', args: [scope.workOrderId] })).rows[0];
    return NextResponse.json(buildWorkOrderStatus(row as Record<string, unknown> | undefined, scope), { headers });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof JobStatusError ? error.message : 'Work order status unavailable' },
      { status: error instanceof JobStatusError ? error.status : 503, headers },
    );
  }
}
