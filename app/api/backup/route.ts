import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getDb } from '@/lib/db';

const backupTables = [
  'users', 'site_config', 'assets', 'work_orders', 'pm_schedules', 'inventory',
  'vendors', 'purchase_orders', 'po_items', 'wo_parts', 'wo_labor', 'meter_readings',
  'audit_log', 'sites', 'compliance_obligations', 'inspections', 'documents',
  'safety_permits', 'testing_records', 'root_cause_analyses', 'procedures',
  'procedure_steps', 'procedure_revisions', 'wo_checklist_items', 'asset_downtime',
  'asset_criticality',
] as const;

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const db = await getDb();
    const backup: Record<string, unknown[]> = {};

    for (const table of backupTables) {
      backup[table] = (await db.execute(`SELECT * FROM ${table}`)).rows as unknown[];
    }

    const exportedAt = new Date().toISOString();
    const filename = `ops-cmms-backup-${exportedAt.replace(/[:.]/g, '-')}.json`;
    return NextResponse.json({
      exportedAt,
      version: '2.0',
      tables: backupTables,
      data: backup,
    }, { headers: { 'Content-Disposition': `attachment; filename="${filename}"` } });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
