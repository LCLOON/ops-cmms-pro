import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getCriticalityRegister, upsertCriticality, logAudit } from '@/lib/operations';
import type { CriticalityInput } from '@/lib/criticality';

const REDUNDANCY = ['none', 'partial', 'full'];
const DETECTABILITY = ['sudden', 'gradual', 'monitored'];
const PROCUREMENT = ['off_the_shelf', 'configured', 'custom', 'sole_source_obsolete'];

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const rows = await getCriticalityRegister();
    return NextResponse.json({ rows, assessed: rows.filter(r => r.assessed).length, total: rows.length });
  } catch (err) {
    console.error('[api/criticality GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role === 'viewer') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body || typeof body.assetId !== 'string' || !body.assetId) {
      return NextResponse.json({ error: 'assetId required' }, { status: 400 });
    }
    if (typeof body.redundancy === 'string' && !REDUNDANCY.includes(body.redundancy)) {
      return NextResponse.json({ error: 'Invalid redundancy value' }, { status: 400 });
    }
    if (typeof body.detectability === 'string' && !DETECTABILITY.includes(body.detectability)) {
      return NextResponse.json({ error: 'Invalid detectability value' }, { status: 400 });
    }
    if (typeof body.procurement === 'string' && !PROCUREMENT.includes(body.procurement)) {
      return NextResponse.json({ error: 'Invalid procurement value' }, { status: 400 });
    }

    const asNumber = (v: unknown, fallback = 0) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : fallback;
    };
    const input: CriticalityInput = {
      safetyImpact: asNumber(body.safetyImpact, 1),
      environmentalImpact: asNumber(body.environmentalImpact, 1),
      productionImpact: asNumber(body.productionImpact, 1),
      redundancy: (body.redundancy as CriticalityInput['redundancy']) ?? 'none',
      detectability: (body.detectability as CriticalityInput['detectability']) ?? 'gradual',
      condition: asNumber(body.condition, 1),
      // These two are derived, not supplied by the assessor.
      failureCount12m: asNumber(body.failureCount12m, 0),
      ageYears: body.ageYears === null || body.ageYears === undefined ? null : asNumber(body.ageYears, 0),
      usefulLifeYears: asNumber(body.usefulLifeYears, 0),
      leadTimeDays: asNumber(body.leadTimeDays, 0),
      procurement: (body.procurement as CriticalityInput['procurement']) ?? 'off_the_shelf',
      unitCost: asNumber(body.unitCost, 0),
      criticalSpareOnSite: body.criticalSpareOnSite === true,
    };

    const notes = typeof body.notes === 'string' ? body.notes : '';
    const saved = await upsertCriticality(body.assetId, input, session.displayName, notes);
    if (!saved) return NextResponse.json({ error: 'Asset not found' }, { status: 404 });

    await logAudit({
      userId: session.userId, username: session.username,
      action: 'criticality.assess', entityType: 'asset', entityId: body.assetId,
      details: `band ${saved.result.band} (risk ${saved.result.riskScore}/25, C${saved.result.consequence} x L${saved.result.likelihood})`,
    });

    return NextResponse.json(saved);
  } catch (err) {
    console.error('[api/criticality POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
