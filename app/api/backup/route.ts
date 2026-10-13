import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const db = await getDb();
    // Export all data as JSON
    const tables = ['users', 'site_config', 'assets', 'work_orders', 'pm_schedules', 'inventory', 'vendors', 'purchase_orders', 'po_items', 'wo_parts', 'wo_labor', 'meter_readings', 'audit_log'];
    const backup: Record<string, unknown[]> = {};

    for (const table of tables) {
      try {
        backup[table] = (await db.execute(`SELECT * FROM ${table}`)).rows as unknown[];
      } catch { /* table may not exist */ }
    }

    return NextResponse.json({
      exportedAt: new Date().toISOString(),
      version: '1.0',
      data: backup,
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
