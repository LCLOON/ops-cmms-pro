import { createClient, type Client } from '@libsql/client';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Resolve the database target:
//  - TURSO_DATABASE_URL (+ TURSO_AUTH_TOKEN) -> remote libSQL/Turso (durable, serverless-safe)
//  - OPS_CMMS_DB_PATH -> explicit local file override
//  - Vercel without Turso env -> /tmp file (works, but ephemeral per instance)
//  - otherwise -> persistent per-user data dir (self-hosted default)
function resolveDbConfig(): { url: string; authToken?: string } {
  if (process.env.TURSO_DATABASE_URL) {
    return { url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN };
  }
  if (process.env.OPS_CMMS_DB_PATH) {
    return { url: localUrl(process.env.OPS_CMMS_DB_PATH) };
  }
  if (process.env.VERCEL) {
    return { url: localUrl(path.join(os.tmpdir(), 'ops-cmms-pro.db')) };
  }
  // Self-hosted (dev or `next start`): keep the database OUTSIDE the project
  // tree so the dev server's file watcher never trips on SQLite WAL/SHM
  // churn, but in a persistent per-user directory so data survives reboots,
  // OS temp cleanups, and dependency reinstalls.
  const base = process.platform === 'win32'
    ? process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local')
    : process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share');
  return { url: localUrl(path.join(base, 'ops-cmms-pro', 'ops-cmms-pro.db')) };
}

function localUrl(filePath: string): string {
  // libSQL local URLs need forward slashes, including on Windows.
  return 'file:' + filePath.replace(/\\/g, '/');
}

let _ready: Promise<Client> | null = null;

export function getDb(): Promise<Client> {
  if (!_ready) {
    _ready = initClient().catch(err => {
      _ready = null; // allow a retry after a failed init
      throw err;
    });
  }
  return _ready;
}

async function initClient(): Promise<Client> {
  const cfg = resolveDbConfig();
  const isFile = cfg.url.startsWith('file:');
  if (!isFile && !cfg.authToken) {
    throw new Error('TURSO_AUTH_TOKEN is required when TURSO_DATABASE_URL points to a remote database');
  }
  if (isFile) {
    const dir = path.dirname(cfg.url.slice('file:'.length));
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }
  const client = createClient(cfg);
  if (isFile) {
    // Local file mode: keep WAL and FK enforcement to match previous behavior.
    // Remote Turso manages journaling server-side; these pragmas are local-only.
    await client.execute('PRAGMA journal_mode = WAL').catch(() => {});
    await client.execute('PRAGMA foreign_keys = ON').catch(() => {});
  }
  await initSchema(client);
  return client;
}

async function tableHasColumn(db: Client, table: string, column: string): Promise<boolean> {
  const rs = await db.execute(`PRAGMA table_info(${table})`);
  return rs.rows.some(r => (r as unknown as { name: string }).name === column);
}

async function initSchema(db: Client): Promise<void> {
  // Conditional ALTERs: append any columns that are missing from older databases.
  const assetCols: Array<[string, string]> = [
    ['parent_id', "ALTER TABLE assets ADD COLUMN parent_id TEXT NOT NULL DEFAULT ''"],
    ['area', "ALTER TABLE assets ADD COLUMN area TEXT NOT NULL DEFAULT ''"],
    ['system', "ALTER TABLE assets ADD COLUMN system TEXT NOT NULL DEFAULT ''"],
    ['ot_asset_type', "ALTER TABLE assets ADD COLUMN ot_asset_type TEXT NOT NULL DEFAULT ''"],
    ['ip_address', "ALTER TABLE assets ADD COLUMN ip_address TEXT NOT NULL DEFAULT ''"],
    ['firmware_version', "ALTER TABLE assets ADD COLUMN firmware_version TEXT NOT NULL DEFAULT ''"],
    ['config_backup_date', "ALTER TABLE assets ADD COLUMN config_backup_date TEXT NOT NULL DEFAULT ''"],
    ['patch_status', "ALTER TABLE assets ADD COLUMN patch_status TEXT NOT NULL DEFAULT ''"],
    ['network_zone', "ALTER TABLE assets ADD COLUMN network_zone TEXT NOT NULL DEFAULT ''"],
    ['regulatory_driver', "ALTER TABLE assets ADD COLUMN regulatory_driver TEXT NOT NULL DEFAULT ''"],
    ['replacement_cost', 'ALTER TABLE assets ADD COLUMN replacement_cost REAL NOT NULL DEFAULT 0'],
    ['failure_mode', "ALTER TABLE assets ADD COLUMN failure_mode TEXT NOT NULL DEFAULT ''"],
    ['is_component', 'ALTER TABLE assets ADD COLUMN is_component INTEGER NOT NULL DEFAULT 0'],
  ];
  const pmCols: Array<[string, string]> = [
    ['deferral_reason', "ALTER TABLE pm_schedules ADD COLUMN deferral_reason TEXT NOT NULL DEFAULT ''"],
    ['deferral_approved_by', "ALTER TABLE pm_schedules ADD COLUMN deferral_approved_by TEXT NOT NULL DEFAULT ''"],
    ['procedure_id', "ALTER TABLE pm_schedules ADD COLUMN procedure_id TEXT NOT NULL DEFAULT ''"],
  ];
  let alters = '';
  for (const [col, ddl] of assetCols) {
    if (!(await tableHasColumn(db, 'assets', col))) alters += '    ' + ddl + ';\n';
  }
  for (const [col, ddl] of pmCols) {
    if (!(await tableHasColumn(db, 'pm_schedules', col))) alters += '    ' + ddl + ';\n';
  }

  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'technician' CHECK(role IN ('admin','manager','technician','viewer')),
      active INTEGER NOT NULL DEFAULT 1,
      force_password_change INTEGER NOT NULL DEFAULT 0,
      last_login_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS site_config (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      company_name TEXT NOT NULL DEFAULT '',
      site_name TEXT NOT NULL DEFAULT '',
      site_address TEXT NOT NULL DEFAULT '',
      manager_name TEXT NOT NULL DEFAULT '',
      manager_email TEXT NOT NULL DEFAULT '',
      manager_phone TEXT NOT NULL DEFAULT '',
      setup_complete INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'other' CHECK(category IN ('mechanical','electrical','hvac','plumbing','structural','vehicle','it','safety','other')),
      location TEXT NOT NULL DEFAULT '',
      department TEXT NOT NULL DEFAULT '',
      manufacturer TEXT NOT NULL DEFAULT '',
      model TEXT NOT NULL DEFAULT '',
      serial_number TEXT NOT NULL DEFAULT '',
      install_date TEXT NOT NULL DEFAULT '',
      warranty_expiry TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'operational' CHECK(status IN ('operational','down','maintenance','retired')),
      criticality TEXT NOT NULL DEFAULT 'low' CHECK(criticality IN ('critical','high','medium','low')),
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS work_orders (
      id TEXT PRIMARY KEY,
      asset_id TEXT REFERENCES assets(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      type TEXT NOT NULL DEFAULT 'corrective' CHECK(type IN ('corrective','preventive','predictive','emergency','inspection')),
      priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('critical','high','medium','low')),
      status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','in_progress','on_hold','completed','cancelled')),
      assigned_to TEXT NOT NULL DEFAULT '',
      requested_by TEXT NOT NULL DEFAULT '',
      due_date TEXT NOT NULL DEFAULT '',
      completed_date TEXT NOT NULL DEFAULT '',
      labor_hours REAL NOT NULL DEFAULT 0,
      parts_cost REAL NOT NULL DEFAULT 0,
      resolution TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS pm_schedules (
      id TEXT PRIMARY KEY,
      asset_id TEXT REFERENCES assets(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      frequency_type TEXT NOT NULL DEFAULT 'weekly' CHECK(frequency_type IN ('daily','weekly','monthly','quarterly','semi_annual','annual','runtime_hours')),
      frequency_value INTEGER NOT NULL DEFAULT 1,
      last_completed TEXT NOT NULL DEFAULT '',
      next_due TEXT NOT NULL DEFAULT '',
      assigned_to TEXT NOT NULL DEFAULT '',
      estimated_hours REAL NOT NULL DEFAULT 1,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS inventory (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      part_number TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT 'general' CHECK(category IN ('mechanical','electrical','hvac','plumbing','safety','consumable','general')),
      quantity_on_hand INTEGER NOT NULL DEFAULT 0,
      min_quantity INTEGER NOT NULL DEFAULT 0,
      unit_cost REAL NOT NULL DEFAULT 0,
      supplier TEXT NOT NULL DEFAULT '',
      location TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS wo_parts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      work_order_id TEXT NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
      inventory_item_id TEXT NOT NULL REFERENCES inventory(id) ON DELETE RESTRICT,
      quantity INTEGER NOT NULL DEFAULT 1,
      unit_cost REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS wo_labor (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      work_order_id TEXT NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      username TEXT NOT NULL DEFAULT '',
      hours REAL NOT NULL DEFAULT 0,
      logged_date TEXT NOT NULL DEFAULT (date('now')),
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Add parent_id to assets for hierarchy (skip if exists)
    ${alters}

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      username TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL DEFAULT '',
      details TEXT NOT NULL DEFAULT '',
      changes TEXT NOT NULL DEFAULT '',
      ip_address TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS vendors (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      contact_name TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      website TEXT NOT NULL DEFAULT '',
      payment_terms TEXT NOT NULL DEFAULT 'Net 30',
      notes TEXT NOT NULL DEFAULT '',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS purchase_orders (
      id TEXT PRIMARY KEY,
      vendor_id TEXT REFERENCES vendors(id) ON DELETE SET NULL,
      po_number TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','sent','received','cancelled')),
      order_date TEXT NOT NULL DEFAULT (date('now')),
      expected_date TEXT NOT NULL DEFAULT '',
      received_date TEXT NOT NULL DEFAULT '',
      total_cost REAL NOT NULL DEFAULT 0,
      notes TEXT NOT NULL DEFAULT '',
      created_by TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS po_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      po_id TEXT NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
      inventory_item_id TEXT NOT NULL DEFAULT '',
      item_name TEXT NOT NULL DEFAULT '',
      quantity INTEGER NOT NULL DEFAULT 1,
      unit_cost REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS meter_readings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
      reading_type TEXT NOT NULL DEFAULT 'runtime_hours' CHECK(reading_type IN ('runtime_hours','cycles','mileage','pressure','temperature','custom')),
      value REAL NOT NULL DEFAULT 0,
      unit TEXT NOT NULL DEFAULT '',
      reading_date TEXT NOT NULL DEFAULT (date('now')),
      recorded_by TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sites (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      ferc_no TEXT NOT NULL DEFAULT '',
      river_system TEXT NOT NULL DEFAULT 'Kennebec River',
      river_mile REAL NOT NULL DEFAULT 0,
      capacity_mw TEXT NOT NULL DEFAULT '',
      county TEXT NOT NULL DEFAULT '',
      state TEXT NOT NULL DEFAULT 'ME',
      operator TEXT NOT NULL DEFAULT '',
      year_built INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'operational' CHECK(status IN ('operational','standby','decommissioned','construction')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS compliance_obligations (
      id TEXT PRIMARY KEY,
      site_id TEXT REFERENCES sites(id) ON DELETE CASCADE,
      obligation_type TEXT NOT NULL DEFAULT 'other' CHECK(obligation_type IN ('dam_safety','ferc_license','fish_passage','environmental','water_quality','public_safety','eap','dssmp','nerc','ot_cyber','other')),
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      regulation_ref TEXT NOT NULL DEFAULT '',
      frequency TEXT NOT NULL DEFAULT 'annual' CHECK(frequency IN ('daily','weekly','monthly','quarterly','semi_annual','annual','5-year','seasonal','as-needed')),
      last_completed TEXT NOT NULL DEFAULT '',
      next_due TEXT NOT NULL DEFAULT '',
      owner_role TEXT NOT NULL DEFAULT '',
      evidence_required TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','in_progress','completed','overdue','waived')),
      priority TEXT NOT NULL DEFAULT 'high' CHECK(priority IN ('critical','high','medium','low')),
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS inspections (
      id TEXT PRIMARY KEY,
      asset_id TEXT REFERENCES assets(id) ON DELETE SET NULL,
      compliance_obligation_id TEXT REFERENCES compliance_obligations(id) ON DELETE SET NULL,
      inspection_type TEXT NOT NULL DEFAULT 'visual' CHECK(inspection_type IN ('visual','detailed','regulatory','dam_safety','fish_passage','substation','safety','other')),
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      scheduled_date TEXT NOT NULL DEFAULT '',
      completed_date TEXT NOT NULL DEFAULT '',
      inspector TEXT NOT NULL DEFAULT '',
      findings TEXT NOT NULL DEFAULT '',
      recommendations TEXT NOT NULL DEFAULT '',
      corrective_actions TEXT NOT NULL DEFAULT '',
      readings TEXT NOT NULL DEFAULT '',
      photos TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled','in_progress','completed','deficient','overdue')),
      priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('critical','high','medium','low')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      asset_id TEXT REFERENCES assets(id) ON DELETE SET NULL,
      document_type TEXT NOT NULL DEFAULT 'other' CHECK(document_type IN ('om_manual','drawing','one_line','relay_settings','plc_backup','sop','eap','loto','inspection_report','test_report','photo','certification','other')),
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      file_path TEXT NOT NULL DEFAULT '',
      file_url TEXT NOT NULL DEFAULT '',
      version TEXT NOT NULL DEFAULT '1.0',
      uploaded_by TEXT NOT NULL DEFAULT '',
      upload_date TEXT NOT NULL DEFAULT (date('now')),
      review_due_date TEXT NOT NULL DEFAULT '',
      tags TEXT NOT NULL DEFAULT '',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS safety_permits (
      id TEXT PRIMARY KEY,
      work_order_id TEXT REFERENCES work_orders(id) ON DELETE SET NULL,
      asset_id TEXT REFERENCES assets(id) ON DELETE SET NULL,
      permit_type TEXT NOT NULL DEFAULT 'other' CHECK(permit_type IN ('loto','confined_space','hot_work','excavation','diving','crane','working_at_heights','other')),
      permit_number TEXT NOT NULL DEFAULT '',
      issued_by TEXT NOT NULL DEFAULT '',
      issued_date TEXT NOT NULL DEFAULT (date('now')),
      expiry_date TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','issued','active','closed','expired','cancelled')),
      description TEXT NOT NULL DEFAULT '',
      hazards TEXT NOT NULL DEFAULT '',
      precautions TEXT NOT NULL DEFAULT '',
      approved_by TEXT NOT NULL DEFAULT '',
      attachments TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS electrical_tests (
      id TEXT PRIMARY KEY,
      asset_id TEXT REFERENCES assets(id) ON DELETE CASCADE,
      test_type TEXT NOT NULL DEFAULT 'other' CHECK(test_type IN ('transformer_oil','dga','breaker_timing','relay_test','battery_test','charger_test','ir_scan','ground_test','cable_test','protection_settings','other')),
      test_date TEXT NOT NULL DEFAULT (date('now')),
      results TEXT NOT NULL DEFAULT '',
      next_due TEXT NOT NULL DEFAULT '',
      tested_by TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','passed','failed','attention')),
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Reusable procedure library (the SOP), separate from one-off work order notes.
    CREATE TABLE IF NOT EXISTS procedures (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT 'other' CHECK(category IN ('mechanical','electrical','hvac','plumbing','structural','safety','inspection','other')),
      asset_id TEXT NOT NULL DEFAULT '',
      version TEXT NOT NULL DEFAULT '1.0',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS procedure_steps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      procedure_id TEXT NOT NULL REFERENCES procedures(id) ON DELETE CASCADE,
      step_order INTEGER NOT NULL DEFAULT 1,
      instruction TEXT NOT NULL,
      expected_result TEXT NOT NULL DEFAULT '',
      response_type TEXT NOT NULL DEFAULT 'checkbox' CHECK(response_type IN ('checkbox','reading','pass_fail','text')),
      unit TEXT NOT NULL DEFAULT '',
      safety_note TEXT NOT NULL DEFAULT ''
    );

    -- Snapshot copied onto a work order when a procedure is applied.
    CREATE TABLE IF NOT EXISTS wo_checklist_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      work_order_id TEXT NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
      procedure_id TEXT NOT NULL DEFAULT '',
      step_order INTEGER NOT NULL DEFAULT 1,
      instruction TEXT NOT NULL,
      expected_result TEXT NOT NULL DEFAULT '',
      response_type TEXT NOT NULL DEFAULT 'checkbox',
      unit TEXT NOT NULL DEFAULT '',
      safety_note TEXT NOT NULL DEFAULT '',
      completed INTEGER NOT NULL DEFAULT 0,
      result_value TEXT NOT NULL DEFAULT '',
      result_status TEXT NOT NULL DEFAULT '' CHECK(result_status IN ('','pass','fail','na')),
      notes TEXT NOT NULL DEFAULT '',
      completed_by TEXT NOT NULL DEFAULT '',
      completed_at TEXT NOT NULL DEFAULT ''
    );
  `);
}
