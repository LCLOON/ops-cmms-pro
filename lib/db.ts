import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

function resolveDbPath(): string {
  if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
    return path.join('/tmp', 'ops-cmms-pro.db');
  }
  return path.join(process.cwd(), 'data', 'ops-cmms-pro.db');
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
  `);
}
