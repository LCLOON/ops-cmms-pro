import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { upsertAsset, upsertInventoryItem, logAudit } from '@/lib/operations';
import type { Asset, InventoryItem } from '@/lib/types';
import { convertCmmsRow, parseDelimited, type CmmsSource, type RawRow } from '@/lib/cmms-import';

const CMMS_SOURCES: CmmsSource[] = ['generic', 'sap', 'maximo', 'fiix', 'maintainx', 'emaint', 'limble', 'upkeep'];
const MAX_ROWS = 2000;

function isSource(value: unknown): value is CmmsSource {
  return typeof value === 'string' && (CMMS_SOURCES as string[]).includes(value);
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role === 'viewer') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json().catch(() => null) as {
      type?: unknown;
      data?: unknown;
      source?: unknown;
      csv?: unknown;
      preview?: unknown;
    } | null;

    if (!body || typeof body.type !== 'string') {
      return NextResponse.json({ error: 'type required' }, { status: 400 });
    }

    const now = new Date().toISOString();

    // CMMS conversion: preview maps a foreign export; commit persists it.
    if (body.type === 'cmms') {
      if (!isSource(body.source)) {
        return NextResponse.json({ error: `source must be one of: ${CMMS_SOURCES.join(', ')}` }, { status: 400 });
      }

      let rows: RawRow[] = [];
      if (typeof body.csv === 'string' && body.csv.trim()) rows = parseDelimited(body.csv);
      else if (Array.isArray(body.data)) rows = body.data as RawRow[];
      if (rows.length === 0) return NextResponse.json({ error: 'csv text or data array required' }, { status: 400 });
      if (rows.length > MAX_ROWS) return NextResponse.json({ error: `too many rows (max ${MAX_ROWS})` }, { status: 400 });

      const converted = rows.map((row, i) => convertCmmsRow(body.source as CmmsSource, row, i, now));
      const warnings = converted.flatMap(c => c.warnings);

      if (body.preview === true) {
        return NextResponse.json({
          preview: true,
          source: body.source,
          count: converted.length,
          warnings,
          assets: converted.map(c => c.asset),
        });
      }

      for (const { asset } of converted) await upsertAsset(asset);
      await logAudit({
        userId: session.userId,
        username: session.username,
        action: 'import',
        entityType: 'asset',
        entityId: `cmms:${body.source}`,
        details: `Converted ${converted.length} ${body.source} rows into assets (${warnings.length} warnings)`,
      });
      return NextResponse.json({ success: true, imported: converted.length, warnings });
    }

    if (!Array.isArray(body.data)) {
      return NextResponse.json({ error: 'type and data array required' }, { status: 400 });
    }
    if (body.data.length > MAX_ROWS) return NextResponse.json({ error: `too many rows (max ${MAX_ROWS})` }, { status: 400 });

    const { type, data } = body;
    let imported = 0;

    if (type === 'assets') {
      for (const row of data) {
        const id = 'AST-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5);
        const asset: Asset = {
          id, name: row.name || 'Untitled', category: row.category || 'other',
          location: row.location || '', department: row.department || '',
          manufacturer: row.manufacturer || '', model: row.model || '',
          serialNumber: row.serialNumber || '', installDate: row.installDate || '',
          warrantyExpiry: row.warrantyExpiry || '', status: row.status || 'operational',
          criticality: row.criticality || 'low', notes: row.notes || '',
          parentId: '', createdAt: now, updatedAt: now,
        };
        await upsertAsset(asset);
        imported++;
      }
    } else if (type === 'inventory') {
      for (const row of data) {
        const id = 'INV-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5);
        const item: InventoryItem = {
          id, name: row.name || 'Untitled', partNumber: row.partNumber || '',
          category: row.category || 'general', quantityOnHand: Number(row.quantityOnHand) || 0,
          minQuantity: Number(row.minQuantity) || 0, unitCost: Number(row.unitCost) || 0,
          supplier: row.supplier || '', location: row.location || '',
          notes: row.notes || '', createdAt: now, updatedAt: now,
        };
        await upsertInventoryItem(item);
        imported++;
      }
    } else {
      return NextResponse.json({ error: 'type must be "assets" or "inventory"' }, { status: 400 });
    }

    return NextResponse.json({ success: true, imported });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
