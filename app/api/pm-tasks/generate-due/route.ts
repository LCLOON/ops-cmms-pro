import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { generateDueWorkOrders } from '@/lib/operations';

// Turns every due PM into a work order. Callable two ways:
//  - by a signed-in editor from the app
//  - by a scheduler (Vercel cron / Task Scheduler / curl) presenting the shared
//    token, so PMs no longer depend on somebody remembering to press a button.
function schedulerToken(request: Request): string {
  const header = request.headers.get('authorization') || '';
  if (header.toLowerCase().startsWith('bearer ')) return header.slice(7).trim();
  return (request.headers.get('x-cron-token') || '').trim();
}

function isScheduler(request: Request): boolean {
  const expected = (process.env.OPS_CMMS_CRON_TOKEN || process.env.CRON_SECRET || '').trim();
  if (!expected) return false;
  const provided = schedulerToken(request);
  return provided.length > 0 && provided === expected;
}

async function run(request: Request) {
  try {
    if (isScheduler(request)) {
      const result = await generateDueWorkOrders(0, 'scheduler');
      return NextResponse.json({ success: true, triggeredBy: 'scheduler', ...result });
    }
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role === 'viewer') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const result = await generateDueWorkOrders(session.userId, session.displayName);
    return NextResponse.json({ success: true, triggeredBy: session.username, ...result });
  } catch (err) {
    console.error('[api/pm-tasks/generate-due]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Vercel cron issues GET requests; a session-authenticated client may use either.
export async function GET(request: Request) {
  if (!isScheduler(request)) {
    return NextResponse.json({ error: 'Scheduler token required' }, { status: 401 });
  }
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}
