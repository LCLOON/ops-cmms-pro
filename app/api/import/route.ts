import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { upsertAsset, upsertInventoryItem } from '@/lib/operations';
import type { Asset, InventoryItem } from '@/lib/types';

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role === 'viewer') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { type, data } = await request.json();
    if (!type || !data || !Array.isArray(data)) {
      return NextResponse.json({ error: 'type and data array required' }, { status: 400 });
    }

    let imported = 0;
    const now = new Date().toISOString();

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
