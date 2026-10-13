import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import os from 'os';

function resolveDbPath(): string {
  // Always use system temp directory to avoid Turbopack file-watcher
  // contention with SQLite WAL/SHM files on Windows.
  if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
    return path.join('/tmp', 'ops-cmms-pro.db');
  }
  return path.join(os.tmpdir(), 'ops-cmms-pro.db');
}

const DB_PATH = resolveDbPath();
let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
    initSchema(_db);
  }
  return _db;
}

function tableHasColumn(db: Database.Database, table: string, column: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return rows.some(r => r.name === column);
}

function initSchema(db: Database.Database): void {
  db.exec(`
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
    ${tableHasColumn(db, 'assets', 'parent_id') ? '' : 'ALTER TABLE assets ADD COLUMN parent_id TEXT NOT NULL DEFAULT \'\';'}
    -- Add area / system to assets for hydro plant organization (skip if exists)
    ${tableHasColumn(db, 'assets', 'area') ? '' : 'ALTER TABLE assets ADD COLUMN area TEXT NOT NULL DEFAULT \'\';'}
    ${tableHasColumn(db, 'assets', 'system') ? '' : 'ALTER TABLE assets ADD COLUMN system TEXT NOT NULL DEFAULT \'\';'}
    -- Add OT / cyber asset fields (skip if exists)
    ${tableHasColumn(db, 'assets', 'ot_asset_type') ? '' : 'ALTER TABLE assets ADD COLUMN ot_asset_type TEXT NOT NULL DEFAULT \'\';'}
    ${tableHasColumn(db, 'assets', 'ip_address') ? '' : 'ALTER TABLE assets ADD COLUMN ip_address TEXT NOT NULL DEFAULT \'\';'}
    ${tableHasColumn(db, 'assets', 'firmware_version') ? '' : 'ALTER TABLE assets ADD COLUMN firmware_version TEXT NOT NULL DEFAULT \'\';'}
    ${tableHasColumn(db, 'assets', 'config_backup_date') ? '' : 'ALTER TABLE assets ADD COLUMN config_backup_date TEXT NOT NULL DEFAULT \'\';'}
    ${tableHasColumn(db, 'assets', 'patch_status') ? '' : 'ALTER TABLE assets ADD COLUMN patch_status TEXT NOT NULL DEFAULT \'\';'}
    ${tableHasColumn(db, 'assets', 'network_zone') ? '' : 'ALTER TABLE assets ADD COLUMN network_zone TEXT NOT NULL DEFAULT \'\';'}
    ${tableHasColumn(db, 'assets', 'regulatory_driver') ? '' : 'ALTER TABLE assets ADD COLUMN regulatory_driver TEXT NOT NULL DEFAULT \'\';'}
    -- Add replacement cost, failure mode, component flag (skip if exists)
    ${tableHasColumn(db, 'assets', 'replacement_cost') ? '' : 'ALTER TABLE assets ADD COLUMN replacement_cost REAL NOT NULL DEFAULT 0;'}
    ${tableHasColumn(db, 'assets', 'failure_mode') ? '' : 'ALTER TABLE assets ADD COLUMN failure_mode TEXT NOT NULL DEFAULT \'\';'}
    ${tableHasColumn(db, 'assets', 'is_component') ? '' : 'ALTER TABLE assets ADD COLUMN is_component INTEGER NOT NULL DEFAULT 0;'}
    -- Add PM deferral fields (skip if exists)
    ${tableHasColumn(db, 'pm_schedules', 'deferral_reason') ? '' : 'ALTER TABLE pm_schedules ADD COLUMN deferral_reason TEXT NOT NULL DEFAULT \'\';'}
    ${tableHasColumn(db, 'pm_schedules', 'deferral_approved_by') ? '' : 'ALTER TABLE pm_schedules ADD COLUMN deferral_approved_by TEXT NOT NULL DEFAULT \'\';'}

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
  `);
}
