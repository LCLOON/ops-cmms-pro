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

async function tableExists(db: Client, table: string): Promise<boolean> {
  const rs = await db.execute({ sql: "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?", args: [table] });
  return rs.rows.length > 0;
}

async function initSchema(db: Client): Promise<void> {
  // Conditional ALTERs: append any columns that are missing from older databases.
  const assetCols: Array<[string, string]> = [
    ['site_id', 'ALTER TABLE assets ADD COLUMN site_id TEXT REFERENCES sites(id) ON DELETE SET NULL'],
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
  const workOrderCols: Array<[string, string]> = [
    ['site_id', 'ALTER TABLE work_orders ADD COLUMN site_id TEXT REFERENCES sites(id) ON DELETE SET NULL'],
    ['pm_schedule_id', 'ALTER TABLE work_orders ADD COLUMN pm_schedule_id TEXT REFERENCES pm_schedules(id) ON DELETE SET NULL'],
    ['source_testing_record_id', 'ALTER TABLE work_orders ADD COLUMN source_testing_record_id TEXT REFERENCES testing_records(id) ON DELETE SET NULL'],
    ['source_inspection_id', 'ALTER TABLE work_orders ADD COLUMN source_inspection_id TEXT REFERENCES inspections(id) ON DELETE SET NULL'],
    ['source_oil_analysis_id', 'ALTER TABLE work_orders ADD COLUMN source_oil_analysis_id TEXT REFERENCES oil_analysis_records(id) ON DELETE SET NULL'],
  ];
  const inspectionCols: Array<[string, string]> = [
    ['site_id', 'ALTER TABLE inspections ADD COLUMN site_id TEXT REFERENCES sites(id) ON DELETE SET NULL'],
  ];
  // Governance columns for the SOP library: lifecycle status plus who signed off.
  const procedureCols: Array<[string, string]> = [
    ['status', "ALTER TABLE procedures ADD COLUMN status TEXT NOT NULL DEFAULT 'draft'"],
    ['approved_by', "ALTER TABLE procedures ADD COLUMN approved_by TEXT NOT NULL DEFAULT ''"],
    ['approved_at', "ALTER TABLE procedures ADD COLUMN approved_at TEXT NOT NULL DEFAULT ''"],
  ];
  // Links a failed checklist step to the corrective work order it spawned.
  const checklistCols: Array<[string, string]> = [
    ['follow_up_wo_id', "ALTER TABLE wo_checklist_items ADD COLUMN follow_up_wo_id TEXT NOT NULL DEFAULT ''"],
    ['source_version', "ALTER TABLE wo_checklist_items ADD COLUMN source_version TEXT NOT NULL DEFAULT ''"],
  ];
  // ALTERs exist to migrate databases created before a column was introduced.
  // They must only be emitted for tables that already exist: on a fresh database
  // the CREATE TABLE statements below define every column, and emitting an ALTER
  // for a table that is not there yet aborts the entire batch with
  // "no such table: <name>". That failure is self-perpetuating — a database
  // missing `procedures` could never create it, because the ALTER for it ran
  // before its CREATE in the same batch. Skipping missing tables breaks the loop.
  const alterGroups: Array<[string, Array<[string, string]>]> = [
    ['assets', assetCols],
    ['work_orders', workOrderCols],
    ['inspections', inspectionCols],
    ['pm_schedules', pmCols],
    ['procedures', procedureCols],
    ['wo_checklist_items', checklistCols],
    // Every cost figure is labour hours x rate, so the rate is a first-class
    // setting rather than a constant baked into the queries.
    ['site_config', [['labor_rate', 'ALTER TABLE site_config ADD COLUMN labor_rate REAL NOT NULL DEFAULT 75']]],
  ];

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
      labor_rate REAL NOT NULL DEFAULT 75,
      setup_complete INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY,
      site_id TEXT REFERENCES sites(id) ON DELETE SET NULL,
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
      site_id TEXT REFERENCES sites(id) ON DELETE SET NULL,
      pm_schedule_id TEXT REFERENCES pm_schedules(id) ON DELETE SET NULL,
      source_testing_record_id TEXT REFERENCES testing_records(id) ON DELETE SET NULL,
      source_inspection_id TEXT REFERENCES inspections(id) ON DELETE SET NULL,
      source_oil_analysis_id TEXT REFERENCES oil_analysis_records(id) ON DELETE SET NULL,
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
      site_id TEXT REFERENCES sites(id) ON DELETE SET NULL,
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

    CREATE TABLE IF NOT EXISTS testing_records (
      id TEXT PRIMARY KEY,
      asset_id TEXT REFERENCES assets(id) ON DELETE CASCADE,
      discipline TEXT NOT NULL DEFAULT 'electrical' CHECK(discipline IN ('electrical','mechanical')),
      test_type TEXT NOT NULL DEFAULT 'other',
      test_date TEXT NOT NULL DEFAULT (date('now')),
      results TEXT NOT NULL DEFAULT '',
      next_due TEXT NOT NULL DEFAULT '',
      tested_by TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','passed','failed','attention')),
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS oil_analysis_records (
      id TEXT PRIMARY KEY,
      asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
      sample_type TEXT NOT NULL CHECK(sample_type IN ('bearing','transformer')),
      sample_date TEXT NOT NULL DEFAULT (date('now')),
      sample_point TEXT NOT NULL DEFAULT '',
      sample_id TEXT NOT NULL DEFAULT '',
      sampled_by TEXT NOT NULL DEFAULT '',
      lab_name TEXT NOT NULL DEFAULT '',
      report_number TEXT NOT NULL DEFAULT '',
      oil_brand TEXT NOT NULL DEFAULT '',
      oil_grade TEXT NOT NULL DEFAULT '',
      hours_on_oil TEXT NOT NULL DEFAULT '',
      assessment TEXT NOT NULL DEFAULT 'not_entered' CHECK(assessment IN ('not_entered','satisfactory','monitor','action_required')),
      assessment_notes TEXT NOT NULL DEFAULT '',
      recommendations TEXT NOT NULL DEFAULT '',
      next_sample_due TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      measurements_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_oil_analysis_asset_date ON oil_analysis_records(asset_id, sample_date DESC);

    CREATE TABLE IF NOT EXISTS root_cause_analyses (
      id TEXT PRIMARY KEY,
      asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
      work_order_id TEXT REFERENCES work_orders(id) ON DELETE SET NULL,
      failure_date TEXT NOT NULL DEFAULT (date('now')),
      failure_mode TEXT NOT NULL DEFAULT '',
      symptoms TEXT NOT NULL DEFAULT '',
      cause_category TEXT NOT NULL DEFAULT 'unknown',
      root_cause TEXT NOT NULL DEFAULT '',
      contributing_factors TEXT NOT NULL DEFAULT '',
      corrective_action TEXT NOT NULL DEFAULT '',
      preventive_action TEXT NOT NULL DEFAULT '',
      action_owner TEXT NOT NULL DEFAULT '',
      due_date TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','investigating','actions_in_progress','verified','closed')),
      created_by TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_root_cause_asset_date ON root_cause_analyses(asset_id, failure_date DESC);
    CREATE INDEX IF NOT EXISTS idx_root_cause_status_due ON root_cause_analyses(status, due_date);

    -- Reusable procedure library (the SOP), separate from one-off work order notes.
    CREATE TABLE IF NOT EXISTS procedures (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT 'other' CHECK(category IN ('mechanical','electrical','hvac','plumbing','structural','safety','inspection','other')),
      asset_id TEXT NOT NULL DEFAULT '',
      version TEXT NOT NULL DEFAULT '1.0',
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','approved','retired')),
      approved_by TEXT NOT NULL DEFAULT '',
      approved_at TEXT NOT NULL DEFAULT '',
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

    -- Immutable revision log. Every save appends a snapshot so you can prove
    -- which revision of the SOP was in force on any given date (audit trail).
    CREATE TABLE IF NOT EXISTS procedure_revisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      procedure_id TEXT NOT NULL,
      revision_no INTEGER NOT NULL DEFAULT 1,
      version TEXT NOT NULL DEFAULT '1.0',
      title TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT 'other',
      asset_id TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft',
      steps_json TEXT NOT NULL DEFAULT '[]',
      changed_by TEXT NOT NULL DEFAULT '',
      change_note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Snapshot copied onto a work order when a procedure is applied.
    CREATE TABLE IF NOT EXISTS wo_checklist_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      work_order_id TEXT NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
      procedure_id TEXT NOT NULL DEFAULT '',
      source_version TEXT NOT NULL DEFAULT '',
      step_order INTEGER NOT NULL DEFAULT 1,
      instruction TEXT NOT NULL,
      expected_result TEXT NOT NULL DEFAULT '',
      response_type TEXT NOT NULL DEFAULT 'checkbox',
      unit TEXT NOT NULL DEFAULT '',
      safety_note TEXT NOT NULL DEFAULT '',
      completed INTEGER NOT NULL DEFAULT 0,
      result_value TEXT NOT NULL DEFAULT '',
      result_status TEXT NOT NULL DEFAULT '' CHECK(result_status IN ('','pass','fail','na')),
      follow_up_wo_id TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      completed_by TEXT NOT NULL DEFAULT '',
      completed_at TEXT NOT NULL DEFAULT ''
    );

    -- Downtime intervals per asset. Availability cannot be derived from work
    -- orders alone (a repair may happen while the asset keeps running), so the
    -- intervals are recorded explicitly: opened when an asset goes down and
    -- closed when it comes back. ended_at = '' means still down.
    CREATE TABLE IF NOT EXISTS asset_downtime (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      ended_at TEXT NOT NULL DEFAULT '',
      reason TEXT NOT NULL DEFAULT '',
      work_order_id TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Criticality / risk assessment. One row per assessed asset. Kept separate
    -- from the assets table because these are analysis inputs (judgement calls
    -- plus derived history) rather than master data.
    CREATE TABLE IF NOT EXISTS asset_criticality (
      asset_id TEXT PRIMARY KEY REFERENCES assets(id) ON DELETE CASCADE,
      safety_impact INTEGER NOT NULL DEFAULT 1,
      environmental_impact INTEGER NOT NULL DEFAULT 1,
      production_impact INTEGER NOT NULL DEFAULT 1,
      redundancy TEXT NOT NULL DEFAULT 'none',
      detectability TEXT NOT NULL DEFAULT 'gradual',
      condition INTEGER NOT NULL DEFAULT 1,
      useful_life_years REAL NOT NULL DEFAULT 0,
      lead_time_days INTEGER NOT NULL DEFAULT 0,
      procurement TEXT NOT NULL DEFAULT 'off_the_shelf',
      unit_cost REAL NOT NULL DEFAULT 0,
      critical_spare_on_site INTEGER NOT NULL DEFAULT 0,
      notes TEXT NOT NULL DEFAULT '',
      assessed_by TEXT NOT NULL DEFAULT '',
      assessed_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

  `);

  // Preserve existing electrical tests while moving to a discipline-neutral
  // register that can also hold mechanical test types.
  if (await tableExists(db, 'electrical_tests')) {
    await db.executeMultiple(`
      INSERT OR IGNORE INTO testing_records
        (id, asset_id, discipline, test_type, test_date, results, next_due, tested_by, status, notes, created_at, updated_at)
      SELECT id, asset_id, 'electrical', test_type, test_date, results, next_due, tested_by, status, notes, created_at, updated_at
      FROM electrical_tests;
      DROP TABLE electrical_tests;
    `);
  }

  // Column migrations run AFTER the CREATE TABLE batch. This ordering is the
  // whole point: probing for tables/columns before the schema exists makes
  // every check report "missing table" on a fresh database, so no ALTER is
  // emitted and later data-layer inserts reference columns that were never
  // added (e.g. assets.parent_id) — which aborts seeding entirely.
  for (const [table, cols] of alterGroups) {
    if (!(await tableExists(db, table))) continue;
    for (const [, ddl] of cols) {
      const col = ddl.replace(/^ALTER TABLE \w+ ADD COLUMN /, '').split(' ')[0];
      if (!(await tableHasColumn(db, table, col))) {
        await db.execute(ddl);
      }
    }
  }

  await db.executeMultiple(`
    UPDATE assets SET site_id = CASE id
      WHEN 'FAC-LOCKWOOD' THEN 'SITE-LOCK'
      WHEN 'FAC-KENNEBEC' THEN 'SITE-KENN'
      WHEN 'FAC-SHAWMUT' THEN 'SITE-SHAW'
      WHEN 'FAC-WESTON' THEN 'SITE-WEST'
      ELSE site_id
    END
    WHERE site_id IS NULL AND id IN ('FAC-LOCKWOOD','FAC-KENNEBEC','FAC-SHAWMUT','FAC-WESTON')
      AND EXISTS (SELECT 1 FROM sites WHERE id = CASE assets.id
        WHEN 'FAC-LOCKWOOD' THEN 'SITE-LOCK'
        WHEN 'FAC-KENNEBEC' THEN 'SITE-KENN'
        WHEN 'FAC-SHAWMUT' THEN 'SITE-SHAW'
        WHEN 'FAC-WESTON' THEN 'SITE-WEST'
      END);

    WITH RECURSIVE asset_sites(asset_id, site_id) AS (
      SELECT id, site_id FROM assets WHERE site_id IS NOT NULL
      UNION
      SELECT child.id, parent.site_id
      FROM assets child
      JOIN asset_sites parent ON child.parent_id = parent.asset_id
    )
    UPDATE assets
    SET site_id = (SELECT asset_sites.site_id FROM asset_sites WHERE asset_sites.asset_id = assets.id LIMIT 1)
    WHERE site_id IS NULL AND EXISTS (SELECT 1 FROM asset_sites WHERE asset_sites.asset_id = assets.id);

    UPDATE work_orders
    SET site_id = (SELECT site_id FROM assets WHERE assets.id = work_orders.asset_id)
    WHERE site_id IS NULL AND asset_id IS NOT NULL;

    UPDATE inspections
    SET site_id = COALESCE(
      (SELECT site_id FROM assets WHERE assets.id = inspections.asset_id),
      (SELECT site_id FROM compliance_obligations WHERE compliance_obligations.id = inspections.compliance_obligation_id)
    )
    WHERE site_id IS NULL;
  `);

  const duplicateActivePm = await db.execute(`
    SELECT pm_schedule_id FROM work_orders
    WHERE pm_schedule_id IS NOT NULL AND status IN ('open','in_progress','on_hold')
    GROUP BY pm_schedule_id HAVING COUNT(*) > 1 LIMIT 1
  `);
  if (duplicateActivePm.rows.length === 0) {
    await db.execute(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_work_orders_active_pm
      ON work_orders(pm_schedule_id)
      WHERE pm_schedule_id IS NOT NULL AND status IN ('open','in_progress','on_hold')
    `);
  } else {
    console.warn('[db] Skipping active-PM uniqueness index until existing duplicate work orders are resolved');
  }

  await backfillProcedureGovernance(db);
}

// One-time migration for databases created before procedure governance existed.
// Legacy procedures have no revision history and no approval record; without
// this they would default to 'draft' and vanish from every procedure picker.
// Rows that already carry a revision are left untouched.
async function backfillProcedureGovernance(db: Client): Promise<void> {
  const legacy = await db.execute(`
    SELECT p.id, p.title, p.description, p.category, p.asset_id, p.version, p.status
    FROM procedures p
    WHERE NOT EXISTS (SELECT 1 FROM procedure_revisions r WHERE r.procedure_id = p.id)
  `);
  if (legacy.rows.length === 0) return;
  const now = new Date().toISOString();
  for (const raw of legacy.rows) {
    const p = raw as unknown as { id: string; title: string; description: string; category: string; asset_id: string; version: string; status: string };
    const steps = await db.execute({
      sql: 'SELECT step_order, instruction, expected_result, response_type, unit, safety_note FROM procedure_steps WHERE procedure_id = ? ORDER BY step_order, id',
      args: [p.id],
    });
    const snapshot = steps.rows.map((r, i) => {
      const s = r as unknown as { step_order: number; instruction: string; expected_result: string; response_type: string; unit: string; safety_note: string };
      return {
        id: 0, procedureId: p.id, stepOrder: s.step_order || i + 1, instruction: s.instruction,
        expectedResult: s.expected_result || '', responseType: s.response_type || 'checkbox',
        unit: s.unit || '', safetyNote: s.safety_note || '',
      };
    });
    // Preserve prior behaviour: everything that existed before governance was in use.
    await db.execute({
      sql: "UPDATE procedures SET status = 'approved', approved_by = 'migrated', approved_at = ? WHERE id = ?",
      args: [now, p.id],
    });
    await db.execute({
      sql: `INSERT INTO procedure_revisions (procedure_id,revision_no,version,title,description,category,asset_id,status,steps_json,changed_by,change_note)
        VALUES (?,1,?,?,?,?,?,'approved',?,'migrated','Migrated: pre-governance procedure')`,
      args: [p.id, p.version || '1.0', p.title, p.description || '', p.category, p.asset_id || '', JSON.stringify(snapshot)],
    });
  }
}
