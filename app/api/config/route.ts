import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getSiteConfig, getDashboardStats, getSites, upsertSite } from '@/lib/operations';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { searchParams } = new URL(request.url);
    if (searchParams.get('type') === 'sites') return NextResponse.json({ sites: await getSites() });
    return NextResponse.json({ config: await getSiteConfig(), stats: await getDashboardStats() });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const body = await request.json();
    if (body.site) { await upsertSite(body.site); return NextResponse.json({ success: true }); }
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
