import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getAsset, getComplianceObligations, getInspections, getSites, deleteInspection, upsertInspection } from '@/lib/operations';
import { inspectionSchema } from '@/lib/validations';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json(await getInspections());
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
    const parsed = inspectionSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
    const asset = parsed.data.assetId ? await getAsset(parsed.data.assetId) : null;
    if (parsed.data.assetId && !asset) return NextResponse.json({ error: 'Asset not found' }, { status: 400 });
    const [sites, obligations, inspections] = await Promise.all([getSites(), getComplianceObligations(), getInspections()]);
    const obligation = parsed.data.complianceObligationId
      ? obligations.find(item => item.id === parsed.data.complianceObligationId)
      : undefined;
    if (parsed.data.complianceObligationId && !obligation) {
      return NextResponse.json({ error: 'Compliance obligation not found' }, { status: 400 });
    }
    if (parsed.data.siteId && !sites.some(site => site.id === parsed.data.siteId)) {
      return NextResponse.json({ error: 'Site not found' }, { status: 400 });
    }
    const linkedSiteIds = [asset?.siteId, obligation?.siteId].filter((siteId): siteId is string => Boolean(siteId));
    if (new Set(linkedSiteIds).size > 1) {
      return NextResponse.json({ error: 'Asset and compliance obligation belong to different sites' }, { status: 400 });
    }
    const linkedSiteId = linkedSiteIds[0] ?? '';
    if (parsed.data.siteId && linkedSiteId && parsed.data.siteId !== linkedSiteId) {
      return NextResponse.json({ error: 'Inspection site must match its linked asset or compliance obligation' }, { status: 400 });
    }
    const requestedId = typeof body === 'object' && body !== null && 'id' in body ? body.id : undefined;
    const id = typeof requestedId === 'string' && requestedId.trim() ? requestedId : 'INSP-' + Date.now().toString(36).toUpperCase();
    const prior = inspections.find(item => item.id === id);
    const inspection = {
      ...parsed.data,
      siteId: linkedSiteId || parsed.data.siteId,
      workOrderId: prior?.workOrderId ?? '',
      id,
      createdAt: prior?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await upsertInspection(inspection);
    return NextResponse.json(inspection);
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
    await deleteInspection(id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

