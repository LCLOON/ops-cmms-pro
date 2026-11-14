import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getSiteConfig, getDashboardStats, getSites, upsertSite, updateSiteConfig, logAudit } from '@/lib/operations';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { searchParams } = new URL(request.url);
    if (searchParams.get('type') === 'sites') return NextResponse.json({ sites: await getSites() });
    return NextResponse.json({ config: await getSiteConfig(), stats: await getDashboardStats() });
  } catch (err) {
    console.error('[api/config GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const body = await request.json();

    // Organisation settings, including the labour rate that drives every cost
    // figure. Partial updates are allowed so the UI can send just what changed.
    if (body.config) {
      const raw = body.config as Record<string, unknown>;
      const num = Number(raw.laborRate);
      if (raw.laborRate !== undefined && (!Number.isFinite(num) || num < 0)) {
        return NextResponse.json({ error: 'Labor rate must be a non-negative number' }, { status: 400 });
      }
      const updated = await updateSiteConfig({
        ...(typeof raw.companyName === 'string' ? { companyName: raw.companyName } : {}),
        ...(typeof raw.siteName === 'string' ? { siteName: raw.siteName } : {}),
        ...(typeof raw.siteAddress === 'string' ? { siteAddress: raw.siteAddress } : {}),
        ...(typeof raw.managerName === 'string' ? { managerName: raw.managerName } : {}),
        ...(typeof raw.managerEmail === 'string' ? { managerEmail: raw.managerEmail } : {}),
        ...(typeof raw.managerPhone === 'string' ? { managerPhone: raw.managerPhone } : {}),
        ...(raw.laborRate !== undefined ? { laborRate: num } : {}),
      });
      await logAudit({
        userId: session.userId, username: session.username,
        action: 'config.update', entityType: 'site_config', entityId: '1',
        details: raw.laborRate !== undefined ? `labor rate = ${updated.laborRate}` : 'organisation settings updated',
      });
      return NextResponse.json({ success: true, config: updated });
    }

    if (body.site) {
      await upsertSite(body.site);
      await logAudit({ userId: session.userId, username: session.username, action: 'site.upsert', entityType: 'site', entityId: String(body.site.id || ''), details: String(body.site.name || '') });
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  } catch (err) {
    console.error('[api/config POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
