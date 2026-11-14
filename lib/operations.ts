import { getDb } from './db';
import { type InStatement } from '@libsql/client';
import bcryptjs from 'bcryptjs';
import { generateHydroAssets, generateHydroInventory } from './hydro-seed';
import { EXCEL_VENDORS } from './excel-vendors';
import { computeCriticality, bandToAssetCriticality, type CriticalityInput, type CriticalityResult } from './criticality';
import type { Asset, WorkOrder, PmSchedule, InventoryItem, SiteConfig, DbUser, WoPart, WoLabor, Vendor, PurchaseOrder, PoItem, MeterReading, Site, ComplianceObligation, Inspection, Document, SafetyPermit, EquipmentTest, OilAnalysisRecord, RootCauseAnalysis, Procedure, ProcedureStep, ProcedureRevision, WoChecklistItem, ProcedureResponseType } from './types';

// ─── Helpers ───────────────────────────────────────────────────
function nowIso(): string { return new Date().toISOString(); }

// ─── Seed ──────────────────────────────────────────────────────
const SEED_ASSETS: Asset[] = [
  { id: 'AST-001', name: 'Chiller Unit #1', category: 'hvac', location: 'Mechanical Room A', department: 'Facilities', manufacturer: 'Carrier', model: '30XA-100', serialNumber: 'CR-2020-001', installDate: '2020-03-15', warrantyExpiry: '2025-03-15', status: 'operational', criticality: 'critical', notes: 'Primary building chiller', parentId: '', createdAt: nowIso(), updatedAt: nowIso() },
  { id: 'AST-002', name: 'Air Compressor #2', category: 'mechanical', location: 'Compressor Room', department: 'Production', manufacturer: 'Ingersoll Rand', model: 'IR-75', serialNumber: 'IR-2019-042', installDate: '2019-06-01', warrantyExpiry: '2024-06-01', status: 'operational', criticality: 'high', notes: 'Shop air supply', parentId: '', createdAt: nowIso(), updatedAt: nowIso() },
  { id: 'AST-003', name: 'Main Electrical Panel', category: 'electrical', location: 'Electrical Room', department: 'Facilities', manufacturer: 'Square D', model: 'NF-400', serialNumber: 'SD-2021-007', installDate: '2021-01-10', warrantyExpiry: '2026-01-10', status: 'operational', criticality: 'critical', notes: '400A main distribution panel', parentId: '', createdAt: nowIso(), updatedAt: nowIso() },
  { id: 'AST-004', name: 'Fire Pump', category: 'safety', location: 'Pump House', department: 'Safety', manufacturer: 'Grundfos', model: 'CR-64', serialNumber: 'GF-2018-113', installDate: '2018-11-20', warrantyExpiry: '2023-11-20', status: 'operational', criticality: 'critical', notes: 'Sprinkler system fire pump', parentId: '', createdAt: nowIso(), updatedAt: nowIso() },
  { id: 'AST-005', name: 'Forklift #3', category: 'vehicle', location: 'Warehouse B', department: 'Logistics', manufacturer: 'Toyota', model: '8FGU25', serialNumber: 'TY-2022-033', installDate: '2022-05-10', warrantyExpiry: '2025-05-10', status: 'operational', criticality: 'medium', notes: 'Electric forklift', parentId: '', createdAt: nowIso(), updatedAt: nowIso() },
];

// Seeded work orders backdate createdAt so it always precedes due/completed
// dates — MTTR/MTBF are computed from created_at and must never go negative.
const SEED_WORK_ORDERS: WorkOrder[] = [
  { id: 'WO-001', assetId: 'AST-001', title: 'Chiller refrigerant leak repair', description: 'Found refrigerant leak at compressor seal', type: 'corrective', priority: 'high', status: 'in_progress', assignedTo: 'Technician', requestedBy: 'Manager', dueDate: '2026-06-30', completedDate: '', laborHours: 4, partsCost: 350, resolution: '', createdAt: '2026-06-21T07:00:00.000Z', updatedAt: nowIso() },
  { id: 'WO-002', assetId: 'AST-004', title: 'Annual fire pump test', description: 'NFPA 25 annual flow test', type: 'inspection', priority: 'medium', status: 'open', assignedTo: '', requestedBy: 'Safety Officer', dueDate: '2026-07-15', completedDate: '', laborHours: 2, partsCost: 0, resolution: '', createdAt: '2026-07-01T07:00:00.000Z', updatedAt: nowIso() },
  { id: 'WO-003', assetId: 'AST-002', title: 'Air compressor oil change', description: 'Scheduled 2000hr oil change', type: 'preventive', priority: 'low', status: 'completed', assignedTo: 'Technician', requestedBy: 'PM Schedule', dueDate: '2026-06-20', completedDate: '2026-06-19', laborHours: 1.5, partsCost: 85, resolution: 'Oil and filters changed', createdAt: '2026-06-14T07:00:00.000Z', updatedAt: nowIso() },
];

const SEED_PM_SCHEDULES: PmSchedule[] = [
  { id: 'PM-001', assetId: 'AST-001', title: 'Chiller quarterly inspection', description: 'Check pressures, temps, electrical connections', frequencyType: 'quarterly', frequencyValue: 1, lastCompleted: '2026-04-01', nextDue: '2026-07-01', assignedTo: 'Technician', estimatedHours: 3, active: true, createdAt: nowIso(), updatedAt: nowIso() },
  { id: 'PM-002', assetId: 'AST-002', title: 'Compressor oil change', description: 'Replace oil and filters', frequencyType: 'monthly', frequencyValue: 3, lastCompleted: '2026-03-15', nextDue: '2026-06-15', assignedTo: 'Technician', estimatedHours: 1.5, active: true, createdAt: nowIso(), updatedAt: nowIso() },
  { id: 'PM-003', assetId: 'AST-004', title: 'Weekly pump test', description: 'Run pump for 10 minutes, check pressure', frequencyType: 'weekly', frequencyValue: 1, lastCompleted: '2026-06-19', nextDue: '2026-06-26', assignedTo: 'Technician', estimatedHours: 0.5, active: true, createdAt: nowIso(), updatedAt: nowIso() },
];

const SEED_INVENTORY: InventoryItem[] = [
  { id: 'INV-001', name: 'HVAC Filter 24x24x2', partNumber: 'FLT-24X24-001', category: 'hvac', quantityOnHand: 24, minQuantity: 10, unitCost: 12.50, supplier: 'Grainger', location: 'Stockroom A3', notes: 'MERV 13', createdAt: nowIso(), updatedAt: nowIso() },
  { id: 'INV-002', name: 'Compressor Oil 5W-30', partNumber: 'OIL-5W30-001', category: 'mechanical', quantityOnHand: 8, minQuantity: 4, unitCost: 28.00, supplier: 'MSC Industrial', location: 'Stockroom B1', notes: 'Synthetic', createdAt: nowIso(), updatedAt: nowIso() },
  { id: 'INV-003', name: 'Electrical Fuse 100A', partNumber: 'FUS-100A-001', category: 'electrical', quantityOnHand: 5, minQuantity: 3, unitCost: 45.00, supplier: 'Grainger', location: 'Stockroom A1', notes: 'Class J time-delay', createdAt: nowIso(), updatedAt: nowIso() },
];

export async function seedDatabase(): Promise<void> {
  const client = await getDb();
  const countRs = await client.execute('SELECT COUNT(*) as cnt FROM assets');
  const count = (countRs.rows[0] as unknown as { cnt: number }).cnt;
  if (count > 0) return;

  // Collect every insert first, then flush in chunks. Batching keeps
  // first-boot seeding fast even against a remote database, and each
  // chunk is applied atomically.
  const pending: InStatement[] = [];
  const db = {
    prepare: (sql: string) => ({
      run: (...args: (string | number | null)[]) => { pending.push({ sql, args }); },
    }),
  };
  {
    // Site config
    db.prepare(`INSERT OR IGNORE INTO site_config (id, company_name, site_name, site_address, manager_name, manager_email, manager_phone, setup_complete)
      VALUES (1, 'Kennebec Hydro Operations', 'Kennebec River Hydro Projects', 'Lockwood | Hydro Kennebec | Shawmut | Weston — Kennebec River, ME', 'Mike Thornton', 'mthornton@kennebechydro.com', '(207) 555-0142', 1)`).run();

    // ── Sites (multi-site foundation) ────────────────────
    const insSite = db.prepare(`INSERT OR IGNORE INTO sites (id,name,ferc_no,river_system,river_mile,capacity_mw,county,state,operator,year_built,status) VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
    insSite.run('SITE-LOCK', 'Lockwood Hydro', 'P-2574', 'Kennebec River', 63, '6.915 MW', 'Kennebec', 'ME', 'KRRT', 1919, 'operational');
    insSite.run('SITE-KENN', 'Hydro-Kennebec', 'P-2611', 'Kennebec River', 64, '15.433 MW', 'Kennebec', 'ME', 'KRRT', 1989, 'operational');
    insSite.run('SITE-SHAW', 'Shawmut Hydro', 'P-2322', 'Kennebec River', 66, '8.65 MW', 'Kennebec', 'ME', 'KRRT', 1912, 'operational');
    insSite.run('SITE-WEST', 'Weston Station', 'P-2325', 'Kennebec River', 81.5, '15.98 MW', 'Somerset', 'ME', 'KRRT', 1920, 'operational');

    // ── FERC Compliance Calendar ─────────────────────────
    const now = new Date().toISOString().slice(0, 10);
    const nextYear = (new Date().getFullYear() + 1) + now.slice(4);
    const insCompliance = db.prepare(`INSERT OR IGNORE INTO compliance_obligations (id,site_id,obligation_type,title,description,regulation_ref,frequency,last_completed,next_due,owner_role,evidence_required,status,priority,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    const complianceItems = [
      { id: 'FERC-001', type: 'dam_safety' as const, title: 'Operator dam inspection walkdown', desc: 'Inspect crest, abutments, training walls, seepage, concrete distress, settlement, debris, ice, vandalism, hazards.', ref: 'FERC Dam Safety / Part 12', freq: 'weekly' as const, last: '', next: now, owner: 'Operations', ev: 'Inspection checklist/photos' },
      { id: 'FERC-002', type: 'dam_safety' as const, title: 'Formal dam safety inspection', desc: 'Document condition of all water-retaining structures, spillways, gates, abutments, embankments, erosion, seepage, cracks.', ref: 'FERC Dam Safety / Part 12', freq: 'annual' as const, last: '', next: nextYear, owner: 'Civil/Dam Safety', ev: 'Inspection report' },
      { id: 'FERC-003', type: 'dssmp' as const, title: 'DSSMP/DSSMR readings and review', desc: 'Collect and trend surveillance readings: pond/tailwater elevation, seepage, drains, piezometers, monuments, leakage, gate performance.', ref: 'FERC DSSMP/DSSMR', freq: 'monthly' as const, last: '', next: now, owner: 'Civil/Dam Safety', ev: 'Readings, trend plots, threshold review' },
      { id: 'FERC-004', type: 'eap' as const, title: 'Emergency Action Plan annual review', desc: 'Verify contact lists, flowcharts, inundation maps, document control, agency coordination.', ref: 'FERC Dam Safety', freq: 'annual' as const, last: '', next: nextYear, owner: 'Safety / Compliance', ev: 'EAP update and distribution record' },
      { id: 'FERC-005', type: 'eap' as const, title: 'EAP tabletop/drill/exercise', desc: 'Conduct seminar, drill, tabletop, functional or full-scale exercise per FERC schedule.', ref: 'FERC Dam Safety', freq: 'annual' as const, last: '', next: nextYear, owner: 'Safety / Compliance', ev: 'Exercise record / after-action report' },
      { id: 'FERC-006', type: 'dam_safety' as const, title: 'Part 12D Independent Consultant inspection support', desc: 'Five-year comprehensive/periodic inspection support per Order No. 880.', ref: 'FERC Part 12D', freq: '5-year' as const, last: '', next: nextYear, owner: 'Civil/Dam Safety', ev: 'Part 12D report / FERC filing' },
      { id: 'FERC-007', type: 'ferc_license' as const, title: 'FERC license article compliance review', desc: 'Review all license articles, WQC conditions, fishway prescriptions, agency consultation, recreation, flow, reporting deadlines.', ref: 'FERC License', freq: 'quarterly' as const, last: '', next: now, owner: 'COO / Compliance', ev: 'FERC filing / compliance log' },
      { id: 'FERC-008', type: 'public_safety' as const, title: 'Public safety plan/signage review', desc: 'Inspect public safety devices, signage, booms, access gates, fall protection per Order No. 880.', ref: 'FERC Public Safety', freq: 'annual' as const, last: '', next: nextYear, owner: 'Safety / Operations', ev: 'Photos and deficiency log' },
      { id: 'FERC-009', type: 'fish_passage' as const, title: 'Fish passage O&M and effectiveness documentation', desc: 'Seasonal/daily operational logs for fish lift, eelway, bypass, attraction water, counters.', ref: 'NMFS/USFWS Fishway Prescription', freq: 'seasonal' as const, last: '', next: now, owner: 'Environmental/Fisheries', ev: 'Fish passage logs / agency reports' },
      { id: 'FERC-010', type: 'water_quality' as const, title: 'Water level, run-of-river and minimum flow verification', desc: 'Daily pond level and minimum flow compliance; document exceptions for high flow, ice, emergency, approved maintenance.', ref: 'Maine DEP WQC', freq: 'daily' as const, last: '', next: now, owner: 'Operations', ev: 'Water level/flow log' },
      { id: 'FERC-011', type: 'ot_cyber' as const, title: 'OT cyber hygiene review', desc: 'Review user accounts, remote access, firewall, antivirus, backup status, patch status, vendor accounts, MFA.', ref: 'Cyber/OT Security', freq: 'quarterly' as const, last: '', next: now, owner: 'Security/Cyber', ev: 'Backup logs / account review' },
      { id: 'FERC-012', type: 'nerc' as const, title: 'NERC BES applicability review', desc: 'Verify aggregate plant ratings, interconnection voltage, registered entity obligations.', ref: 'NERC', freq: 'annual' as const, last: '', next: nextYear, owner: 'Compliance / Electrical', ev: 'Engineering memo' },
      { id: 'FERC-013', type: 'dam_safety' as const, title: 'Spillway and gate operational test', desc: 'Exercise spillway, sluice, Tainter, headgate equipment; verify controls, limit switches, brakes, hydraulic power.', ref: 'FERC Dam Safety / Part 12', freq: 'quarterly' as const, last: '', next: now, owner: 'Mechanical', ev: 'Inspection checklist' },
      { id: 'FERC-014', type: 'environmental' as const, title: 'Substation/interconnection maintenance boundary verification', desc: 'Verify generator leads, bus, disconnects, metering, CT/PT, grounding, wildlife guards, utility demarcation.', ref: 'ISO-NE / Market / Metering', freq: 'annual' as const, last: '', next: nextYear, owner: 'Electrical / Utility', ev: 'One-line, switching agreement, test reports' },
    ];
    const allSites = ['SITE-LOCK', 'SITE-KENN', 'SITE-SHAW', 'SITE-WEST'];
    for (const c of complianceItems) {
      for (const sid of allSites) {
        const uid = `${c.id}-${sid}`;
        insCompliance.run(uid, sid, c.type, c.title, c.desc, c.ref, c.freq, c.last, c.next, c.owner, c.ev, 'open', 'high', '');
      }
    }

    // Users
    const users = [
      { username: 'admin', password: 'Admin2025!CMMS', display_name: 'System Administrator', role: 'admin' as const },
      { username: 'manager', password: 'Manager2025!CMMS', display_name: 'Maintenance Manager', role: 'manager' as const },
      { username: 'tech', password: 'Tech2025!CMMS', display_name: 'Lead Technician', role: 'technician' as const },
      { username: 'viewer', password: 'Viewer2025!CMMS', display_name: 'Operations Viewer', role: 'viewer' as const },
    ];
    const insertUser = db.prepare('INSERT OR IGNORE INTO users (username, password_hash, display_name, role) VALUES (?, ?, ?, ?)');
    for (const u of users) insertUser.run(u.username, bcryptjs.hashSync(u.password, 12), u.display_name, u.role);
    // These four accounts ship with published demo passwords, so they must
    // change on first sign-in in EVERY environment. The check used to be
    // inverted — the flag was only set outside production, leaving a deployed
    // system with known admin credentials.
    db.prepare('UPDATE users SET force_password_change = 1 WHERE username IN (?, ?, ?, ?)').run('admin', 'manager', 'tech', 'viewer');

    // Assets
    const insAsset = db.prepare(`INSERT INTO assets (id,site_id,name,category,location,department,manufacturer,model,serial_number,install_date,warranty_expiry,status,criticality,notes,parent_id,area,system,replacement_cost,failure_mode,is_component,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    for (const a of SEED_ASSETS) insAsset.run(a.id, a.siteId || null, a.name, a.category, a.location, a.department, a.manufacturer, a.model, a.serialNumber, a.installDate, a.warrantyExpiry, a.status, a.criticality, a.notes, a.parentId, '', '', 0, '', 0, a.createdAt, a.updatedAt);

    // Work Orders
    const insWO = db.prepare(`INSERT INTO work_orders (id,asset_id,title,description,type,priority,status,assigned_to,requested_by,due_date,completed_date,labor_hours,parts_cost,resolution,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    for (const w of SEED_WORK_ORDERS) insWO.run(w.id, w.assetId, w.title, w.description, w.type, w.priority, w.status, w.assignedTo, w.requestedBy, w.dueDate, w.completedDate, w.laborHours, w.partsCost, w.resolution, w.createdAt, w.updatedAt);

    // PM Schedules
    const insPM = db.prepare(`INSERT INTO pm_schedules (id,asset_id,title,description,frequency_type,frequency_value,last_completed,next_due,assigned_to,estimated_hours,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    for (const p of SEED_PM_SCHEDULES) insPM.run(p.id, p.assetId, p.title, p.description, p.frequencyType, p.frequencyValue, p.lastCompleted, p.nextDue, p.assignedTo, p.estimatedHours, p.active ? 1 : 0, p.createdAt, p.updatedAt);

    // Inventory
    const insInv = db.prepare(`INSERT INTO inventory (id,name,part_number,category,quantity_on_hand,min_quantity,unit_cost,supplier,location,notes,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
    for (const i of SEED_INVENTORY) insInv.run(i.id, i.name, i.partNumber, i.category, i.quantityOnHand, i.minQuantity, i.unitCost, i.supplier, i.location, i.notes, i.createdAt, i.updatedAt);

    // ── Hydro Plant Seed ──────────────────────────────────
    const hydro = generateHydroAssets();
    db.prepare('UPDATE site_config SET company_name = ?, site_name = ?, site_address = ?, manager_name = ?, manager_email = ?, manager_phone = ? WHERE id = 1')
      .run('Kennebec Hydro Operations', 'Kennebec River Hydro Projects', 'Lockwood | Hydro Kennebec | Shawmut | Weston — Kennebec River, ME', 'Mike Thornton', 'mthornton@kennebechydro.com', '(207) 555-0142');

    for (const a of hydro.assets) {
      insAsset.run(a.assetId, a.siteId || null, a.name, a.category, a.location, a.department, a.manufacturer, a.model, a.serialNumber, a.installDate, '', a.status, a.criticality, '', a.parentId, a.area, a.system, 0, '', 0, nowIso(), nowIso());
    }
    db.prepare(`
      WITH RECURSIVE asset_sites(asset_id, site_id) AS (
        SELECT id, site_id FROM assets WHERE site_id IS NOT NULL
        UNION
        SELECT child.id, parent.site_id
        FROM assets child
        JOIN asset_sites parent ON child.parent_id = parent.asset_id
      )
      UPDATE assets
      SET site_id = (SELECT asset_sites.site_id FROM asset_sites WHERE asset_sites.asset_id = assets.id LIMIT 1)
      WHERE site_id IS NULL AND EXISTS (SELECT 1 FROM asset_sites WHERE asset_sites.asset_id = assets.id)
    `).run();

    for (const p of hydro.pmSchedules) {
      insPM.run(p.pmId, p.assetId, p.title, p.description || '', p.frequencyType, p.frequencyValue, '', new Date().toISOString().slice(0,10), p.assignedTo, p.estimatedHours, 1, nowIso(), nowIso());
    }

    const hydroInventory = generateHydroInventory();
    for (const i of hydroInventory) {
      insInv.run(i.id, i.name, i.partNumber, i.category, i.quantityOnHand, i.minQuantity, i.unitCost, i.supplier, i.location, i.notes, nowIso(), nowIso());
    }

    // ── Vendor Seed ───────────────────────────────────────
    const insVendor = db.prepare(`INSERT INTO vendors (id,name,contact_name,email,phone,address,website,payment_terms,notes,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
    EXCEL_VENDORS.forEach((v, i) => {
      const id = 'VEND-' + String(i + 1).padStart(3, '0');
      const notes = [
        v.category ? 'Category: ' + v.category : '',
        v.evidenceLevel ? 'Evidence: ' + v.evidenceLevel : '',
        v.recommendedUse ? 'Use: ' + v.recommendedUse : '',
        v.riskNotes ? 'Risk: ' + v.riskNotes : '',
      ].filter(Boolean).join(' | ');
      insVendor.run(id, v.vendorName, '', '', '', '', v.sourceUrl, 'Net 30', notes, 1, nowIso(), nowIso());
    });
  }

  try {
    for (let i = 0; i < pending.length; i += 200) {
      await client.batch(pending.slice(i, i + 200), 'write');
    }
  } catch (err) {
    // Partial seed: clear the data tables so the next request retries cleanly.
    for (const t of ['sites', 'compliance_obligations', 'assets', 'work_orders', 'pm_schedules', 'inventory', 'vendors']) {
      await client.execute(`DELETE FROM ${t}`).catch(() => {});
    }
    throw err;
  }
}

// ─── Users ─────────────────────────────────────────────────────
// libSQL rejects `undefined` as a bind value. Several routes forward the request
// body straight into these writers without schema validation, so an omitted
// optional field became a 500. Coerce at the boundary instead.
const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v));
const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
export async function getUserByUsername(username: string): Promise<DbUser | null> {
  const rs = await (await getDb()).execute({ sql: 'SELECT * FROM users WHERE username = ? AND active = 1', args: [username] });
  const row = rs.rows[0];
  return row ? (row as unknown as DbUser) : null;
}

export async function updateLastLogin(userId: number): Promise<void> {
  await (await getDb()).execute({ sql: "UPDATE users SET last_login_at = datetime('now') WHERE id = ?", args: [userId] });
}

export async function getUsers(): Promise<DbUser[]> {
  const rs = await (await getDb()).execute('SELECT * FROM users ORDER BY role, username');
  return rs.rows as unknown as DbUser[];
}

export async function upsertUser(u: { id?: number; username: string; display_name: string; role: string; active: number; password?: string; force_password_change?: number }): Promise<void> {
  const db = await getDb();
  if (u.password) {
    await db.execute({ sql: `INSERT INTO users (username, password_hash, display_name, role, active, force_password_change) VALUES (?,?,?,?,?,?)
      ON CONFLICT(username) DO UPDATE SET display_name=excluded.display_name, role=excluded.role, active=excluded.active, 
      force_password_change=COALESCE(excluded.force_password_change,users.force_password_change), 
      password_hash=excluded.password_hash, updated_at=datetime('now')`,
      args: [u.username, bcryptjs.hashSync(u.password, 12), u.display_name, u.role, u.active, u.force_password_change ?? 0] });
  } else {
    await db.execute({ sql: `INSERT INTO users (username, password_hash, display_name, role, active, force_password_change) VALUES (?,?,?,?,?,?)
      ON CONFLICT(username) DO UPDATE SET display_name=excluded.display_name, role=excluded.role, active=excluded.active, 
      force_password_change=COALESCE(excluded.force_password_change,users.force_password_change), 
      updated_at=datetime('now')`,
      args: [u.username, '', u.display_name, u.role, u.active, u.force_password_change ?? 0] });
  }
}

export async function deleteUser(id: number): Promise<void> {
  await (await getDb()).execute({ sql: 'DELETE FROM users WHERE id = ?', args: [id] });
}

// Sets a new password for a user and clears the forced-change flag in one
// statement, so the account can never end up with a new hash but a stale gate.
export async function changeUserPassword(userId: number, newPassword: string): Promise<void> {
  await (await getDb()).execute({
    sql: "UPDATE users SET password_hash = ?, force_password_change = 0, updated_at = datetime('now') WHERE id = ?",
    args: [bcryptjs.hashSync(newPassword, 12), userId],
  });
}

// ─── Assets ────────────────────────────────────────────────────
function rowToAsset(r: Record<string, unknown>): Asset {
  return {
    id: r.id as string, siteId: (r.site_id ?? '') as string, name: r.name as string, category: r.category as Asset['category'],
    location: r.location as string, department: r.department as string, manufacturer: r.manufacturer as string,
    model: r.model as string, serialNumber: r.serial_number as string, installDate: r.install_date as string,
    warrantyExpiry: r.warranty_expiry as string, status: r.status as Asset['status'],
    criticality: r.criticality as Asset['criticality'], notes: r.notes as string,
    parentId: (r.parent_id as string) || '', createdAt: r.created_at as string, updatedAt: r.updated_at as string,
    replacementCost: (r.replacement_cost as number) || 0, failureMode: (r.failure_mode as string) || '', isComponent: !!(r.is_component),
  };
}

export async function getAssets(): Promise<Asset[]> {
  const rs = await (await getDb()).execute('SELECT * FROM assets ORDER BY name');
  return (rs.rows as unknown as Record<string, unknown>[]).map(rowToAsset);
}

export async function getAsset(id: string): Promise<Asset | null> {
  const rs = await (await getDb()).execute({ sql: 'SELECT * FROM assets WHERE id = ?', args: [id] });
  const row = rs.rows[0];
  return row ? rowToAsset(row as unknown as Record<string, unknown>) : null;
}

export async function upsertAsset(asset: Asset): Promise<void> {
  const db = await getDb();
  // Prior status decides whether this save opens or closes a downtime interval.
  const priorRs = await db.execute({ sql: 'SELECT status FROM assets WHERE id = ?', args: [asset.id] });
  const prior = priorRs.rows[0] as unknown as { status: string } | undefined;
  const parentRs = asset.parentId && !asset.siteId
    ? await db.execute({ sql: 'SELECT site_id FROM assets WHERE id = ?', args: [asset.parentId] })
    : { rows: [] };
  const parentSiteId = (parentRs.rows[0] as unknown as { site_id?: string | null } | undefined)?.site_id;
  const siteId = asset.siteId || parentSiteId || null;

  await db.execute({ sql: `INSERT INTO assets (id,site_id,name,category,location,department,manufacturer,model,serial_number,install_date,warranty_expiry,status,criticality,notes,parent_id,area,system,replacement_cost,failure_mode,is_component,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))
    ON CONFLICT(id) DO UPDATE SET site_id=excluded.site_id,name=excluded.name,category=excluded.category,location=excluded.location,department=excluded.department,manufacturer=excluded.manufacturer,model=excluded.model,serial_number=excluded.serial_number,install_date=excluded.install_date,warranty_expiry=excluded.warranty_expiry,status=excluded.status,criticality=excluded.criticality,notes=excluded.notes,parent_id=excluded.parent_id,area=excluded.area,system=excluded.system,replacement_cost=excluded.replacement_cost,failure_mode=excluded.failure_mode,is_component=excluded.is_component,updated_at=excluded.updated_at`,
    args: [asset.id, siteId, asset.name, asset.category, asset.location, asset.department, asset.manufacturer, asset.model, asset.serialNumber, asset.installDate, asset.warrantyExpiry, asset.status, asset.criticality, asset.notes, asset.parentId || '', asset.area || '', asset.system || '', asset.replacementCost ?? 0, asset.failureMode ?? '', asset.isComponent ? 1 : 0] });

  await syncDowntime(asset.id, prior?.status, asset.status);
}

// Opens a downtime interval when an asset becomes 'down' and closes it when it
// stops being down. Idempotent: any already-open interval is closed first so an
// asset can never accumulate overlapping intervals.
async function syncDowntime(assetId: string, fromStatus: string | undefined, toStatus: string): Promise<void> {
  const db = await getDb();
  if (toStatus === 'down' && fromStatus !== 'down') {
    await db.execute({ sql: "UPDATE asset_downtime SET ended_at = datetime('now') WHERE asset_id = ? AND ended_at = ''", args: [assetId] });
    await db.execute({ sql: "INSERT INTO asset_downtime (asset_id, started_at, reason) VALUES (?, datetime('now'), ?)", args: [assetId, 'Asset set to down'] });
    return;
  }
  if (fromStatus === 'down' && toStatus !== 'down') {
    await db.execute({ sql: "UPDATE asset_downtime SET ended_at = datetime('now') WHERE asset_id = ? AND ended_at = ''", args: [assetId] });
  }
}

export interface AssetDowntime {
  id: number; assetId: string; startedAt: string; endedAt: string; reason: string; workOrderId: string;
}

export async function getAssetDowntime(assetId: string): Promise<AssetDowntime[]> {
  const rs = await (await getDb()).execute({ sql: 'SELECT * FROM asset_downtime WHERE asset_id = ? ORDER BY started_at DESC LIMIT 50', args: [assetId] });
  return (rs.rows as unknown as Record<string, unknown>[]).map(r => ({
    id: r.id as number,
    assetId: r.asset_id as string,
    startedAt: r.started_at as string,
    endedAt: r.ended_at as string,
    reason: r.reason as string,
    workOrderId: r.work_order_id as string,
  }));
}

export interface AvailabilityRow {
  assetId: string; assetName: string; downtimeHours: number; availabilityPct: number; incidents: number; openDowntime: boolean;
}

// Availability over a trailing window: the share of wall-clock time each asset
// was not recorded as down. Interval time is clamped to the window so old
// downtime does not leak into the number.
export async function getAvailability(windowDays = 30): Promise<{ windowDays: number; fleetAvailabilityPct: number; assets: AvailabilityRow[] }> {
  const db = await getDb();
  const days = Math.min(Math.max(Math.trunc(windowDays) || 30, 1), 365);
  const assetsRs = await db.execute('SELECT id, name FROM assets');
  const assets = assetsRs.rows as unknown as { id: string; name: string }[];

  const dtRs = await db.execute({
    sql: `SELECT asset_id, started_at, ended_at FROM asset_downtime
          WHERE ended_at = '' OR ended_at >= datetime('now', ?) OR started_at >= datetime('now', ?)`,
    args: [`-${days} days`, `-${days} days`],
  });

  const nowMs = Date.now();
  const windowStartMs = nowMs - days * 86_400_000;
  const perAsset = new Map<string, { hours: number; incidents: number; open: boolean }>();

  for (const raw of dtRs.rows) {
    const r = raw as unknown as { asset_id: string; started_at: string; ended_at: string };
    const startMs = Date.parse(`${r.started_at.replace(' ', 'T')}Z`);
    if (Number.isNaN(startMs)) continue;
    const endMs = r.ended_at ? Date.parse(`${r.ended_at.replace(' ', 'T')}Z`) : nowMs;
    if (Number.isNaN(endMs)) continue;
    const from = Math.max(startMs, windowStartMs);
    const to = Math.max(Math.min(endMs, nowMs), from);
    const entry = perAsset.get(r.asset_id) ?? { hours: 0, incidents: 0, open: false };
    entry.hours += (to - from) / 3_600_000;
    entry.incidents += 1;
    if (!r.ended_at) entry.open = true;
    perAsset.set(r.asset_id, entry);
  }

  const windowHours = days * 24;
  const rows: AvailabilityRow[] = assets
    .map(a => {
      const d = perAsset.get(a.id);
      const downtimeHours = d ? Math.round(d.hours * 10) / 10 : 0;
      return {
        assetId: a.id,
        assetName: a.name,
        downtimeHours,
        availabilityPct: Math.max(0, Math.round((1 - downtimeHours / windowHours) * 1000) / 10),
        incidents: d?.incidents ?? 0,
        openDowntime: d?.open ?? false,
      };
    })
    .filter(r => r.downtimeHours > 0)
    .sort((a, b) => a.availabilityPct - b.availabilityPct)
    .slice(0, 12);

  const totalDowntime = [...perAsset.values()].reduce((sum, v) => sum + v.hours, 0);
  const fleetWindow = Math.max(1, assets.length) * windowHours;
  const fleetAvailabilityPct = Math.max(0, Math.round((1 - totalDowntime / fleetWindow) * 1000) / 10);

  return { windowDays: days, fleetAvailabilityPct, assets: rows };
}

export async function deleteAsset(id: string): Promise<void> {
  await (await getDb()).execute({ sql: 'DELETE FROM assets WHERE id = ?', args: [id] });
}

// ─── Work Orders ───────────────────────────────────────────────
function rowToWorkOrder(r: Record<string, unknown>): WorkOrder {
  return {
    id: r.id as string, assetId: (r.asset_id ?? '') as string, title: r.title as string,
    siteId: (r.site_id ?? '') as string, pmScheduleId: (r.pm_schedule_id ?? '') as string,
    sourceTestingRecordId: (r.source_testing_record_id ?? '') as string,
    sourceInspectionId: (r.source_inspection_id ?? '') as string,
    sourceOilAnalysisId: (r.source_oil_analysis_id ?? '') as string,
    description: r.description as string, type: r.type as WorkOrder['type'],
    priority: r.priority as WorkOrder['priority'], status: r.status as WorkOrder['status'],
    assignedTo: r.assigned_to as string, requestedBy: r.requested_by as string,
    dueDate: r.due_date as string, completedDate: r.completed_date as string,
    laborHours: r.labor_hours as number, partsCost: r.parts_cost as number,
    resolution: r.resolution as string, createdAt: r.created_at as string, updatedAt: r.updated_at as string,
  };
}

export async function getWorkOrders(): Promise<WorkOrder[]> {
  const rs = await (await getDb()).execute('SELECT * FROM work_orders ORDER BY created_at DESC');
  return (rs.rows as unknown as Record<string, unknown>[]).map(rowToWorkOrder);
}

export async function getWorkOrder(id: string): Promise<WorkOrder | null> {
  const rs = await (await getDb()).execute({ sql: 'SELECT * FROM work_orders WHERE id = ?', args: [id] });
  const row = rs.rows[0];
  return row ? rowToWorkOrder(row as unknown as Record<string, unknown>) : null;
}

export async function getWorkOrdersByAsset(assetId: string): Promise<WorkOrder[]> {
  const rs = await (await getDb()).execute({ sql: 'SELECT * FROM work_orders WHERE asset_id = ? ORDER BY created_at DESC', args: [assetId] });
  return (rs.rows as unknown as Record<string, unknown>[]).map(rowToWorkOrder);
}

export async function upsertWorkOrder(wo: WorkOrder): Promise<void> {
  const db = await getDb();
  const priorRs = await db.execute({ sql: 'SELECT status, type, asset_id FROM work_orders WHERE id = ?', args: [wo.id] });
  const prior = priorRs.rows[0] as unknown as { status: string; type: string; asset_id: string | null } | undefined;
  const assetRs = wo.assetId
    ? await db.execute({ sql: 'SELECT site_id FROM assets WHERE id = ?', args: [wo.assetId] })
    : { rows: [] };
  const assetSiteId = (assetRs.rows[0] as unknown as { site_id: string | null } | undefined)?.site_id;
  const siteId = assetSiteId || wo.siteId || null;

  await db.execute({ sql: `INSERT INTO work_orders (id,asset_id,site_id,pm_schedule_id,source_testing_record_id,source_inspection_id,source_oil_analysis_id,title,description,type,priority,status,assigned_to,requested_by,due_date,completed_date,labor_hours,parts_cost,resolution,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))
    ON CONFLICT(id) DO UPDATE SET asset_id=excluded.asset_id,site_id=excluded.site_id,pm_schedule_id=excluded.pm_schedule_id,source_testing_record_id=excluded.source_testing_record_id,source_inspection_id=excluded.source_inspection_id,source_oil_analysis_id=excluded.source_oil_analysis_id,title=excluded.title,description=excluded.description,type=excluded.type,priority=excluded.priority,status=excluded.status,assigned_to=excluded.assigned_to,requested_by=excluded.requested_by,due_date=excluded.due_date,completed_date=excluded.completed_date,resolution=excluded.resolution,updated_at=excluded.updated_at`,
    args: [
      wo.id, wo.assetId || null, siteId, wo.pmScheduleId || null, wo.sourceTestingRecordId || null,
      wo.sourceInspectionId || null, wo.sourceOilAnalysisId || null, wo.title, wo.description, wo.type, wo.priority, wo.status,
      wo.assignedTo, wo.requestedBy, wo.dueDate, wo.completedDate, wo.laborHours, wo.partsCost, wo.resolution,
    ] });
  if (wo.status === 'completed' && prior?.status !== 'completed') await syncPmScheduleOnCompletion(wo.id);
  // The edit form can also mark a work order complete, so the return-to-service
  // rule has to apply on this path too, not just on the status transition route.
  if (wo.status === 'completed') await syncAssetStatusAfterCompletion(wo.assetId || null);
  if (prior?.type === 'corrective' || prior?.type === 'emergency' || wo.type === 'corrective' || wo.type === 'emergency') {
    await refreshCriticalityBands([prior?.asset_id, wo.assetId]);
  }
}

// Returning an asset to service. Completing the last open work order for a
// down asset brings it back to operational; otherwise "Down assets" would be a
// number that can only ever climb unless someone edited the asset by hand.
// Deliberately conservative: any other open, in-progress or on-hold work order
// for the asset keeps it down.
async function syncAssetStatusAfterCompletion(assetId: string | null): Promise<void> {
  if (!assetId) return;
  const db = await getDb();
  const openRs = await db.execute({
    sql: "SELECT COUNT(*) as c FROM work_orders WHERE asset_id = ? AND status IN ('open','in_progress','on_hold')",
    args: [assetId],
  });
  const stillOpen = Number((openRs.rows[0] as unknown as { c: number }).c) || 0;
  if (stillOpen > 0) return;
  const res = await db.execute({
    sql: "UPDATE assets SET status = 'operational', updated_at = datetime('now') WHERE id = ? AND status = 'down'",
    args: [assetId],
  });
  // The asset really did come back, so close its downtime interval too —
  // otherwise availability would keep counting an asset as down forever.
  if (Number(res.rowsAffected) > 0) {
    await db.execute({ sql: "UPDATE asset_downtime SET ended_at = datetime('now') WHERE asset_id = ? AND ended_at = ''", args: [assetId] });
  }
}

export async function deleteWorkOrder(id: string): Promise<void> {
  const db = await getDb();
  const rs = await db.execute({ sql: 'SELECT asset_id, type FROM work_orders WHERE id = ?', args: [id] });
  const row = rs.rows[0] as unknown as { asset_id: string | null; type: string } | undefined;
  await db.execute({ sql: 'DELETE FROM work_orders WHERE id = ?', args: [id] });
  if (row?.type === 'corrective' || row?.type === 'emergency') await refreshCriticalityBands([row.asset_id]);
}

// ─── PM Schedules ──────────────────────────────────────────────
function rowToPmSchedule(r: Record<string, unknown>): PmSchedule {
  return {
    id: r.id as string, assetId: (r.asset_id ?? '') as string, title: r.title as string,
    description: r.description as string, frequencyType: r.frequency_type as PmSchedule['frequencyType'],
    frequencyValue: r.frequency_value as number, lastCompleted: r.last_completed as string,
    nextDue: r.next_due as string, assignedTo: r.assigned_to as string,
    estimatedHours: r.estimated_hours as number, active: !!(r.active as number),
    deferralReason: (r.deferral_reason as string) || '',
    deferralApprovedBy: (r.deferral_approved_by as string) || '',
    procedureId: (r.procedure_id as string) || '',
    createdAt: r.created_at as string, updatedAt: r.updated_at as string,
  };
}

export async function getPmSchedules(): Promise<PmSchedule[]> {
  const rs = await (await getDb()).execute(`
    SELECT pm.*, a.name as asset_name,
      COALESCE(s.name, p.name) as site_name
    FROM pm_schedules pm
    LEFT JOIN assets a ON pm.asset_id = a.id
    LEFT JOIN sites s ON a.site_id = s.id
    LEFT JOIN assets p ON a.parent_id = p.id AND p.is_component = 0
    ORDER BY pm.next_due
  `);
  const runtime = await getRuntimePmStatuses();
  return (rs.rows as unknown as Record<string, unknown>[]).map(r => {
    const base = rowToPmSchedule(r);
    const rt = runtime[base.id];
    return {
      ...base,
      assetName: (r.asset_name as string) || '',
      siteName: (r.site_name as string) || '',
      runtimeHoursSince: rt ? rt.hoursSince : undefined,
      runtimeDue: rt ? rt.due : undefined,
    };
  });
}

// ─── Runtime-hour PM status ────────────────────────────────────
// Runtime PMs are driven by accumulated meter hours, not the calendar: an
// interval of 250 hours means 250 hours of running time between services.
// The baseline is the odometer reading recorded at (or before) the last
// completion, so completing the work order resets the count.
export interface RuntimePmStatus { pmId: string; hoursSince: number; intervalHours: number; due: boolean; }

export async function getRuntimePmStatuses(): Promise<Record<string, RuntimePmStatus>> {
  const db = await getDb();
  const rs = await db.execute(`
    SELECT pm.id as pm_id,
      pm.frequency_value as interval_hours,
      (
        SELECT mr.value FROM meter_readings mr
        WHERE mr.asset_id = pm.asset_id AND mr.reading_type = 'runtime_hours'
        ORDER BY mr.reading_date DESC, mr.id DESC LIMIT 1
      ) as latest_hours,
      (
        SELECT mr.value FROM meter_readings mr
        WHERE mr.asset_id = pm.asset_id AND mr.reading_type = 'runtime_hours'
          AND pm.last_completed != '' AND mr.reading_date <= pm.last_completed
        ORDER BY mr.reading_date DESC, mr.id DESC LIMIT 1
      ) as baseline_hours,
      (
        SELECT mr.value FROM meter_readings mr
        WHERE mr.asset_id = pm.asset_id AND mr.reading_type = 'runtime_hours'
        ORDER BY mr.reading_date ASC, mr.id ASC LIMIT 1
      ) as first_hours
    FROM pm_schedules pm
    WHERE pm.frequency_type = 'runtime_hours' AND pm.active = 1
  `);
  const out: Record<string, RuntimePmStatus> = {};
  for (const raw of rs.rows) {
    const r = raw as unknown as {
      pm_id: string; interval_hours: number; latest_hours: number | null;
      baseline_hours: number | null; first_hours: number | null;
    };
    const interval = Number(r.interval_hours) || 0;
    // No meter history means the interval cannot be evaluated yet — report zero
    // elapsed rather than inventing a due date.
    if (r.latest_hours === null || r.latest_hours === undefined) {
      out[r.pm_id] = { pmId: r.pm_id, hoursSince: 0, intervalHours: interval, due: false };
      continue;
    }
    const latest = Number(r.latest_hours) || 0;
    // Baseline is the odometer at the last completion. When the PM has never
    // been completed we measure from the first reading we hold, so elapsed
    // hours accrue from when tracking began instead of staying pinned at zero.
    const rawBaseline = r.baseline_hours ?? r.first_hours;
    const baseline = rawBaseline === null || rawBaseline === undefined ? latest : Number(rawBaseline) || 0;
    const hoursSince = Math.max(0, latest - baseline);
    out[r.pm_id] = { pmId: r.pm_id, hoursSince, intervalHours: interval, due: interval > 0 && hoursSince >= interval };
  }
  return out;
}

export async function upsertPmSchedule(pm: PmSchedule): Promise<void> {
  const db = await getDb();
  await db.execute({ sql: `INSERT INTO pm_schedules (id,asset_id,title,description,frequency_type,frequency_value,last_completed,next_due,assigned_to,estimated_hours,active,deferral_reason,deferral_approved_by,procedure_id,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))
    ON CONFLICT(id) DO UPDATE SET asset_id=excluded.asset_id,title=excluded.title,description=excluded.description,frequency_type=excluded.frequency_type,frequency_value=excluded.frequency_value,last_completed=excluded.last_completed,next_due=excluded.next_due,assigned_to=excluded.assigned_to,estimated_hours=excluded.estimated_hours,active=excluded.active,deferral_reason=excluded.deferral_reason,deferral_approved_by=excluded.deferral_approved_by,procedure_id=excluded.procedure_id,updated_at=excluded.updated_at`,
    args: [pm.id, pm.assetId || null, pm.title, pm.description, pm.frequencyType, pm.frequencyValue, pm.lastCompleted, pm.nextDue, pm.assignedTo, pm.estimatedHours, pm.active ? 1 : 0, pm.deferralReason || '', pm.deferralApprovedBy || '', pm.procedureId || ''] });
}

export async function deletePmSchedule(id: string): Promise<void> {
  await (await getDb()).execute({ sql: 'DELETE FROM pm_schedules WHERE id = ?', args: [id] });
}

// ─── Inventory ─────────────────────────────────────────────────
function rowToInventoryItem(r: Record<string, unknown>): InventoryItem {
  return {
    id: r.id as string, name: r.name as string, partNumber: r.part_number as string,
    category: r.category as InventoryItem['category'], quantityOnHand: r.quantity_on_hand as number,
    minQuantity: r.min_quantity as number, unitCost: r.unit_cost as number,
    supplier: r.supplier as string, location: r.location as string, notes: r.notes as string,
    createdAt: r.created_at as string, updatedAt: r.updated_at as string,
  };
}

export async function getInventory(): Promise<InventoryItem[]> {
  const rs = await (await getDb()).execute('SELECT * FROM inventory ORDER BY name');
  return (rs.rows as unknown as Record<string, unknown>[]).map(rowToInventoryItem);
}

export async function upsertInventoryItem(item: InventoryItem): Promise<void> {
  const db = await getDb();
  await db.execute({ sql: `INSERT INTO inventory (id,name,part_number,category,quantity_on_hand,min_quantity,unit_cost,supplier,location,notes,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,datetime('now'))
    ON CONFLICT(id) DO UPDATE SET name=excluded.name,part_number=excluded.part_number,category=excluded.category,quantity_on_hand=excluded.quantity_on_hand,min_quantity=excluded.min_quantity,unit_cost=excluded.unit_cost,supplier=excluded.supplier,location=excluded.location,notes=excluded.notes,updated_at=excluded.updated_at`,
    args: [item.id, item.name, item.partNumber, item.category, item.quantityOnHand, item.minQuantity, item.unitCost, item.supplier, item.location, item.notes] });
}

export async function deleteInventoryItem(id: string): Promise<void> {
  await (await getDb()).execute({ sql: 'DELETE FROM inventory WHERE id = ?', args: [id] });
}

// ─── Config ────────────────────────────────────────────────────
export async function getSiteConfig(): Promise<SiteConfig> {
  const rs = await (await getDb()).execute('SELECT * FROM site_config WHERE id = 1');
  const row = rs.rows[0] as unknown as Record<string, unknown> | undefined;
  if (!row) return { companyName: '', siteName: '', siteAddress: '', managerName: '', managerEmail: '', managerPhone: '', laborRate: 75, setupComplete: false };
  return {
    companyName: row.company_name as string, siteName: row.site_name as string,
    siteAddress: row.site_address as string, managerName: row.manager_name as string,
    managerEmail: row.manager_email as string, managerPhone: row.manager_phone as string,
    laborRate: Number(row.labor_rate) >= 0 ? Number(row.labor_rate) : 75,
    setupComplete: !!(row.setup_complete as number),
  };
}

// Labour rate used by every cost calculation. Falls back to the historical
// default when the column is absent or nonsensical, so reporting never breaks.
export async function getLaborRate(): Promise<number> {
  try {
    const rs = await (await getDb()).execute('SELECT labor_rate FROM site_config WHERE id = 1');
    const row = rs.rows[0] as unknown as { labor_rate: number } | undefined;
    const rate = Number(row?.labor_rate);
    return Number.isFinite(rate) && rate >= 0 ? rate : 75;
  } catch {
    return 75;
  }
}

// Partial update of the organisation settings. Used by the admin screen so the
// labour rate can be corrected without touching the database directly.
export async function updateSiteConfig(patch: Partial<Omit<SiteConfig, 'setupComplete'>>): Promise<SiteConfig> {
  const db = await getDb();
  const current = await getSiteConfig();
  const merged = { ...current, ...patch };
  const rate = Number(merged.laborRate);
  const laborRate = Number.isFinite(rate) && rate >= 0 ? rate : 75;
  // The row is created by the seed, but never assume it exists.
  await db.execute('INSERT OR IGNORE INTO site_config (id) VALUES (1)');
  await db.execute({
    sql: `UPDATE site_config SET company_name=?, site_name=?, site_address=?, manager_name=?, manager_email=?, manager_phone=?, labor_rate=?, updated_at=datetime('now') WHERE id = 1`,
    args: [merged.companyName, merged.siteName, merged.siteAddress, merged.managerName, merged.managerEmail, merged.managerPhone, laborRate],
  });
  return { ...merged, laborRate };
}

// ─── Dashboard Stats ───────────────────────────────────────────
// Overdue means past its due point AND not formally deferred. A deferred PM
// carries a reason and an approver, so it must stop nagging until the deferral
// is cleared — otherwise the deferral fields were purely cosmetic.
export async function getDashboardStats() {
  const db = await getDb();
  const count = async (sql: string): Promise<number> => ((await db.execute(sql)).rows[0] as unknown as { cnt: number }).cnt;
  // next_due = '' marks a runtime-hour PM (no calendar date). Guard against it:
  // in SQLite '' sorts before any date, so a bare `< date('now')` would flag it.
  const calendarOverdue = await count("SELECT COUNT(*) as cnt FROM pm_schedules WHERE active = 1 AND deferral_reason = '' AND next_due != '' AND next_due < date('now')");
  const runtime = await getRuntimePmStatuses();
  const deferredIds = new Set(
    ((await db.execute("SELECT id FROM pm_schedules WHERE active = 1 AND deferral_reason != ''")).rows as unknown as { id: string }[]).map(r => r.id),
  );
  const runtimeDue = Object.values(runtime).filter(r => r.due && !deferredIds.has(r.pmId)).length;
  return {
    totalAssets: await count('SELECT COUNT(*) as cnt FROM assets'),
    openWorkOrders: await count("SELECT COUNT(*) as cnt FROM work_orders WHERE status IN ('open','in_progress')"),
    overduePMs: calendarOverdue + runtimeDue,
    downAssets: await count("SELECT COUNT(*) as cnt FROM assets WHERE status = 'down'"),
    lowStock: await count('SELECT COUNT(*) as cnt FROM inventory WHERE quantity_on_hand <= min_quantity'),
    completedThisMonth: await count("SELECT COUNT(*) as cnt FROM work_orders WHERE status = 'completed' AND completed_date >= date('now','start of month')"),
  };
}

// ─── WO Parts ──────────────────────────────────────────────────
export async function getWoParts(workOrderId: string): Promise<WoPart[]> {
  const rs = await (await getDb()).execute({
    sql: `
    SELECT wp.*, i.name as inventory_name, i.part_number
    FROM wo_parts wp LEFT JOIN inventory i ON wp.inventory_item_id = i.id
    WHERE wp.work_order_id = ? ORDER BY wp.id
  `,
    args: [workOrderId],
  });
  return (rs.rows as unknown as Record<string, unknown>[]).map(r => ({
    id: r.id as number,
    workOrderId: r.work_order_id as string,
    inventoryItemId: r.inventory_item_id as string,
    inventoryName: (r.inventory_name as string) || '',
    partNumber: (r.part_number as string) || '',
    quantity: r.quantity as number,
    unitCost: r.unit_cost as number,
    createdAt: r.created_at as string,
  }));
}

// Raised when a part issue would drive stock below zero (or the item is gone).
// Routes translate this into a 400 with a usable message instead of a blind 500.
export class StockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StockError';
  }
}

// Issuing a part against a work order IS the stock transaction: the on-hand
// quantity falls by what was used. Without this, low-stock alerts and reorder
// points only ever reflected hand-edited numbers, never real consumption.
export async function addWoPart(part: { workOrderId: string; inventoryItemId: string; quantity: number; unitCost: number }): Promise<WoPart> {
  const db = await getDb();
  const qty = Number(part.quantity);
  if (!Number.isFinite(qty) || qty <= 0) throw new StockError('Quantity must be greater than zero');

  const itemRs = await db.execute({ sql: 'SELECT quantity_on_hand, unit_cost FROM inventory WHERE id = ?', args: [part.inventoryItemId] });
  const item = itemRs.rows[0] as unknown as { quantity_on_hand: number; unit_cost: number } | undefined;
  if (!item) throw new StockError('Inventory item not found');
  const onHand = Number(item.quantity_on_hand) || 0;
  if (onHand < qty) {
    throw new StockError(`Insufficient stock: ${onHand} on hand, ${qty} requested`);
  }

  // Charge the inventory's current cost unless the caller supplied one.
  const unitCost = Number(part.unitCost) || Number(item.unit_cost) || 0;
  const result = await db.execute({ sql: 'INSERT INTO wo_parts (work_order_id, inventory_item_id, quantity, unit_cost) VALUES (?,?,?,?)', args: [part.workOrderId, part.inventoryItemId, qty, unitCost] });
  await db.execute({ sql: "UPDATE inventory SET quantity_on_hand = quantity_on_hand - ?, updated_at = datetime('now') WHERE id = ?", args: [qty, part.inventoryItemId] });

  // Update work order parts_cost
  const totalRs = await db.execute({ sql: 'SELECT COALESCE(SUM(quantity * unit_cost),0) as t FROM wo_parts WHERE work_order_id = ?', args: [part.workOrderId] });
  const total = (totalRs.rows[0] as unknown as { t: number }).t;
  await db.execute({ sql: 'UPDATE work_orders SET parts_cost = ? WHERE id = ?', args: [total, part.workOrderId] });
  const parts = await getWoParts(part.workOrderId);
  return parts.find(p => p.id === Number(result.lastInsertRowid))!;
}

// Removing an issued part returns the stock and reverses the cost rollup.
export async function deleteWoPart(id: number): Promise<void> {
  const db = await getDb();
  const rowRs = await db.execute({ sql: 'SELECT work_order_id, inventory_item_id, quantity FROM wo_parts WHERE id = ?', args: [id] });
  const row = rowRs.rows[0] as unknown as { work_order_id: string; inventory_item_id: string; quantity: number } | undefined;
  if (!row) return;
  await db.execute({ sql: 'DELETE FROM wo_parts WHERE id = ?', args: [id] });
  await db.execute({
    sql: "UPDATE inventory SET quantity_on_hand = quantity_on_hand + ?, updated_at = datetime('now') WHERE id = ?",
    args: [Number(row.quantity) || 0, row.inventory_item_id],
  });
  const totalRs = await db.execute({ sql: 'SELECT COALESCE(SUM(quantity * unit_cost),0) as t FROM wo_parts WHERE work_order_id = ?', args: [row.work_order_id] });
  const total = (totalRs.rows[0] as unknown as { t: number }).t;
  await db.execute({ sql: 'UPDATE work_orders SET parts_cost = ? WHERE id = ?', args: [total, row.work_order_id] });
}

// ─── WO Labor ──────────────────────────────────────────────────
export async function getWoLabor(workOrderId: string): Promise<WoLabor[]> {
  const rs = await (await getDb()).execute({ sql: 'SELECT * FROM wo_labor WHERE work_order_id = ? ORDER BY id', args: [workOrderId] });
  return (rs.rows as unknown as Record<string, unknown>[]).map(r => ({
    id: r.id as number,
    workOrderId: r.work_order_id as string,
    userId: r.user_id as number,
    username: r.username as string,
    hours: r.hours as number,
    loggedDate: r.logged_date as string,
    notes: r.notes as string,
    createdAt: r.created_at as string,
  }));
}

export async function addWoLabor(entry: { workOrderId: string; userId: number; username: string; hours: number; loggedDate: string; notes: string }): Promise<WoLabor> {
  const db = await getDb();
  const result = await db.execute({ sql: 'INSERT INTO wo_labor (work_order_id, user_id, username, hours, logged_date, notes) VALUES (?,?,?,?,?,?)', args: [entry.workOrderId, entry.userId, entry.username, entry.hours, entry.loggedDate, entry.notes] });
  const totalRs = await db.execute({ sql: 'SELECT COALESCE(SUM(hours),0) as t FROM wo_labor WHERE work_order_id = ?', args: [entry.workOrderId] });
  const total = (totalRs.rows[0] as unknown as { t: number }).t;
  await db.execute({ sql: 'UPDATE work_orders SET labor_hours = ? WHERE id = ?', args: [total, entry.workOrderId] });
  return { id: Number(result.lastInsertRowid), ...entry, createdAt: new Date().toISOString() };
}

export async function deleteWoLabor(id: number): Promise<void> {
  const db = await getDb();
  const rowRs = await db.execute({ sql: 'SELECT work_order_id FROM wo_labor WHERE id = ?', args: [id] });
  const row = rowRs.rows[0] as unknown as { work_order_id: string } | undefined;
  if (!row) return;
  await db.execute({ sql: 'DELETE FROM wo_labor WHERE id = ?', args: [id] });
  const totalRs = await db.execute({ sql: 'SELECT COALESCE(SUM(hours),0) as t FROM wo_labor WHERE work_order_id = ?', args: [row.work_order_id] });
  const total = (totalRs.rows[0] as unknown as { t: number }).t;
  await db.execute({ sql: 'UPDATE work_orders SET labor_hours = ? WHERE id = ?', args: [total, row.work_order_id] });
}

// ─── WO Status Transition ──────────────────────────────────────
const VALID_TRANSITIONS: Record<string, string[]> = {
  open: ['in_progress', 'cancelled'],
  in_progress: ['on_hold', 'completed', 'cancelled'],
  on_hold: ['in_progress', 'cancelled'],
  completed: [],
  cancelled: [],
};

export function getValidStatusTransitions(status: string): string[] {
  return VALID_TRANSITIONS[status] || [];
}

export async function transitionWorkOrderStatus(id: string, newStatus: string): Promise<{ ok: boolean; error?: string }> {
  const db = await getDb();
  const rs = await db.execute({ sql: 'SELECT status, pm_schedule_id, asset_id, type FROM work_orders WHERE id = ?', args: [id] });
  const wo = rs.rows[0] as unknown as { status: string; pm_schedule_id: string | null; asset_id: string | null; type: string } | undefined;
  if (!wo) return { ok: false, error: 'Work order not found' };
  const valid = VALID_TRANSITIONS[wo.status] || [];
  if (!valid.includes(newStatus)) return { ok: false, error: 'Invalid status transition' };
  if (newStatus === 'completed') {
    const blockers = await getCompletionBlockers(id);
    if (blockers.length > 0) return { ok: false, error: `Cannot complete: ${blockers.join('; ')}` };
  }
  const now = new Date().toISOString();
  if (newStatus === 'completed') {
    await db.execute({ sql: 'UPDATE work_orders SET status = ?, completed_date = ?, updated_at = ? WHERE id = ?', args: [newStatus, now, now, id] });
  } else {
    await db.execute({ sql: 'UPDATE work_orders SET status = ?, updated_at = ? WHERE id = ?', args: [newStatus, now, id] });
  }
  if (newStatus === 'completed') {
    await syncPmScheduleOnCompletion(id);
    await syncAssetStatusAfterCompletion(wo.asset_id || null);
  }
  if (wo.type === 'corrective' || wo.type === 'emergency') await refreshCriticalityBands([wo.asset_id]);
  return { ok: true };
}

// ─── PM → WO Generation ───────────────────────────────────────
export async function generateWorkOrderFromPm(pmId: string, userId: number, username: string): Promise<string | null> {
  const db = await getDb();
  const rs = await db.execute({ sql: 'SELECT * FROM pm_schedules WHERE id = ?', args: [pmId] });
  const pm = rs.rows[0] as unknown as Record<string, unknown> | undefined;
  if (!pm) return null;

  const active = await db.execute({
    sql: "SELECT id FROM work_orders WHERE pm_schedule_id = ? AND status IN ('open','in_progress','on_hold') ORDER BY created_at DESC LIMIT 1",
    args: [pmId],
  });
  if (active.rows[0]) return (active.rows[0] as unknown as { id: string }).id;

  const woId = 'WO-' + Date.now().toString(36).toUpperCase();
  const now = new Date().toISOString();
  const assetRs = pm.asset_id
    ? await db.execute({ sql: 'SELECT site_id FROM assets WHERE id = ?', args: [pm.asset_id as string] })
    : { rows: [] };
  const siteId = (assetRs.rows[0] as unknown as { site_id: string | null } | undefined)?.site_id ?? null;
  await db.execute({ sql: `INSERT INTO work_orders (id,asset_id,site_id,pm_schedule_id,title,description,type,priority,status,assigned_to,requested_by,due_date,created_at,updated_at)
    VALUES (?,?,?,?,?,?,'preventive','medium','open',?,?,?,?,?)`,
    args: [woId, pm.asset_id as string | null, siteId, pmId, pm.title as string, (pm.description as string) || 'Generated from PM schedule', pm.assigned_to as string, username, pm.next_due as string, now, now] });

  const procedureId = (pm.procedure_id as string) || '';
  if (procedureId) await applyProcedureToWorkOrder(woId, procedureId, username);

  return woId;
}

async function syncPmScheduleOnCompletion(workOrderId: string): Promise<void> {
  const db = await getDb();
  const rs = await db.execute({
    sql: `SELECT pm.id, pm.frequency_type, pm.frequency_value
      FROM work_orders wo JOIN pm_schedules pm ON pm.id = wo.pm_schedule_id
      WHERE wo.id = ?`,
    args: [workOrderId],
  });
  const pm = rs.rows[0] as unknown as { id: string; frequency_type: string; frequency_value: number } | undefined;
  if (!pm) return;
  const nextDue = await calcNextDue(pm.frequency_type, pm.frequency_value);
  await db.execute({
    sql: "UPDATE pm_schedules SET last_completed = date('now'), next_due = ?, updated_at = datetime('now') WHERE id = ?",
    args: [nextDue, pm.id],
  });
}

async function calcNextDue(freqType: string, freqValue: number): Promise<string> {
  // Runtime-hour PMs have no calendar projection: they fall due on accumulated
  // meter hours. Returning a date here previously made every runtime PM look
  // like a one-month task, which is the wrong interval for rotating machinery.
  if (freqType === 'runtime_hours') return '';
  const modifiers: Record<string, string> = {
    daily: `${freqValue} days`,
    weekly: `${freqValue * 7} days`,
    monthly: `${freqValue} months`,
    quarterly: `${freqValue * 3} months`,
    semi_annual: `${freqValue * 6} months`,
    annual: `${freqValue} years`,
  };
  const mod = modifiers[freqType] || '1 months';
  const rs = await (await getDb()).execute(`SELECT date('now', '+${mod}') as d`);
  return (rs.rows[0] as unknown as { d: string }).d;
}

// ─── Due PM generation (scheduler-safe) ────────────────────────
// Generates work orders for every PM that is due right now: calendar PMs past
// their next_due, plus runtime PMs past their hour interval. Formally deferred
// PMs are skipped. Safe to call repeatedly — generating advances next_due /
// last_completed, so the same PM is not picked up again until it is due again.
export interface DueGenerationResult {
  generated: { pmId: string; workOrderId: string }[];
  errors: { pmId: string; error: string }[];
}

export async function generateDueWorkOrders(userId: number, username: string): Promise<DueGenerationResult> {
  const db = await getDb();
  const generated: { pmId: string; workOrderId: string }[] = [];
  const errors: { pmId: string; error: string }[] = [];

  const dueIds = new Set<string>();
  const calendarRs = await db.execute(`
    SELECT id FROM pm_schedules
    WHERE active = 1 AND deferral_reason = '' AND frequency_type != 'runtime_hours'
      AND next_due != '' AND next_due <= date('now')
  `);
  for (const raw of calendarRs.rows) dueIds.add((raw as unknown as { id: string }).id);

  const deferredRs = await db.execute("SELECT id FROM pm_schedules WHERE active = 1 AND deferral_reason != ''");
  const deferred = new Set((deferredRs.rows as unknown as { id: string }[]).map(r => r.id));
  const runtime = await getRuntimePmStatuses();
  for (const r of Object.values(runtime)) {
    if (r.due && !deferred.has(r.pmId)) dueIds.add(r.pmId);
  }

  for (const pmId of dueIds) {
    try {
      const active = await db.execute({
        sql: "SELECT id FROM work_orders WHERE pm_schedule_id = ? AND status IN ('open','in_progress','on_hold') LIMIT 1",
        args: [pmId],
      });
      if (active.rows.length > 0) continue;
      const workOrderId = await generateWorkOrderFromPm(pmId, userId, username);
      if (workOrderId) generated.push({ pmId, workOrderId });
      else errors.push({ pmId, error: 'PM schedule not found' });
    } catch (err) {
      errors.push({ pmId, error: err instanceof Error ? err.message : String(err) });
    }
  }

  if (generated.length > 0) {
    await logAudit({
      userId: userId || undefined,
      username,
      action: 'pm.auto_generate',
      entityType: 'pm_schedule',
      entityId: '',
      details: `Generated ${generated.length} work order(s) from due PMs`,
    });
  }

  return { generated, errors };
}

// ─── Criticality / risk assessment ─────────────────────────────
export interface CriticalityRow extends CriticalityInput {
  assetId: string;
  assetName: string;
  assetStatus: string;
  legacyCriticality: string;
  assessed: boolean;
  assessedBy: string;
  assessedAt: string;
  notes: string;
  result: CriticalityResult;
}

function yearsSince(dateStr: string): number | null {
  if (!dateStr) return null;
  const then = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(then.getTime())) return null;
  return Math.max(0, Math.round(((Date.now() - then.getTime()) / (365.25 * 86_400_000)) * 10) / 10);
}

// Every asset is returned, assessed or not, so the tab can show coverage. For
// unassessed assets the inputs default to the lowest risk so they rank last
// rather than silently looking safe.
export async function getCriticalityRegister(): Promise<CriticalityRow[]> {
  const db = await getDb();
  const rs = await db.execute(`
    SELECT a.id, a.name, a.status, a.criticality AS legacy_criticality,
      a.install_date, a.replacement_cost,
      c.safety_impact, c.environmental_impact, c.production_impact, c.redundancy,
      c.detectability, c.condition, c.useful_life_years, c.lead_time_days,
      c.procurement, c.unit_cost, c.critical_spare_on_site, c.notes,
      c.assessed_by, c.assessed_at,
      (SELECT COUNT(*) FROM work_orders w
        WHERE w.asset_id = a.id AND w.type IN ('corrective','emergency')
          AND w.created_at >= date('now','-12 months')) AS failures_12m
    FROM assets a LEFT JOIN asset_criticality c ON c.asset_id = a.id
    ORDER BY a.name
  `);

  return (rs.rows as unknown as Record<string, unknown>[]).map(r => {
    const assessed = r.assessed_at !== null && r.assessed_at !== undefined;
    const input: CriticalityInput = {
      safetyImpact: num(r.safety_impact) || 1,
      environmentalImpact: num(r.environmental_impact) || 1,
      productionImpact: num(r.production_impact) || 1,
      redundancy: (str(r.redundancy) || 'none') as CriticalityInput['redundancy'],
      detectability: (str(r.detectability) || 'gradual') as CriticalityInput['detectability'],
      condition: num(r.condition) || 1,
      failureCount12m: num(r.failures_12m),
      ageYears: yearsSince(str(r.install_date)),
      usefulLifeYears: num(r.useful_life_years),
      leadTimeDays: num(r.lead_time_days),
      procurement: (str(r.procurement) || 'off_the_shelf') as CriticalityInput['procurement'],
      unitCost: num(r.unit_cost) || num(r.replacement_cost),
      criticalSpareOnSite: num(r.critical_spare_on_site) === 1,
    };
    return {
      assetId: str(r.id),
      assetName: str(r.name),
      assetStatus: str(r.status),
      legacyCriticality: str(r.legacy_criticality),
      assessed,
      assessedBy: str(r.assessed_by),
      assessedAt: str(r.assessed_at),
      notes: str(r.notes),
      ...input,
      result: computeCriticality(input),
    };
  });
}

// Saving an assessment also writes the derived band back to the asset's
// criticality level, so every other screen reflects the analysis.
export async function upsertCriticality(
  assetId: string,
  input: CriticalityInput,
  assessedBy: string,
  notes = '',
): Promise<CriticalityRow | null> {
  const db = await getDb();
  const existing = await db.execute({
    sql: `SELECT a.install_date,
        (SELECT COUNT(*) FROM work_orders w
          WHERE w.asset_id = a.id AND w.type IN ('corrective','emergency')
            AND w.created_at >= date('now','-12 months')) AS failures
      FROM assets a WHERE a.id = ?`,
    args: [assetId],
  });
  const meta = existing.rows[0] as unknown as { install_date: string; failures: number } | undefined;
  if (!meta) return null;

  // Age and failure history are facts the server owns. Trusting the client for
  // them made the band computed at save time disagree with the band the
  // register recomputes on read.
  const derived: CriticalityInput = {
    ...input,
    ageYears: yearsSince(str(meta.install_date)),
    failureCount12m: num(meta.failures),
  };

  await db.execute({
    sql: `INSERT INTO asset_criticality (asset_id, safety_impact, environmental_impact, production_impact,
        redundancy, detectability, condition, useful_life_years, lead_time_days, procurement, unit_cost,
        critical_spare_on_site, notes, assessed_by, assessed_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))
      ON CONFLICT(asset_id) DO UPDATE SET
        safety_impact=excluded.safety_impact, environmental_impact=excluded.environmental_impact,
        production_impact=excluded.production_impact, redundancy=excluded.redundancy,
        detectability=excluded.detectability, condition=excluded.condition,
        useful_life_years=excluded.useful_life_years, lead_time_days=excluded.lead_time_days,
        procurement=excluded.procurement, unit_cost=excluded.unit_cost,
        critical_spare_on_site=excluded.critical_spare_on_site, notes=excluded.notes,
        assessed_by=excluded.assessed_by, assessed_at=excluded.assessed_at`,
    args: [
      assetId,
      clampInt(derived.safetyImpact, 1, 5), clampInt(derived.environmentalImpact, 1, 5), clampInt(derived.productionImpact, 1, 5),
      str(derived.redundancy) || 'none', str(derived.detectability) || 'gradual', clampInt(derived.condition, 1, 5),
      num(derived.usefulLifeYears), Math.round(num(derived.leadTimeDays)), str(derived.procurement) || 'off_the_shelf',
      num(derived.unitCost), derived.criticalSpareOnSite ? 1 : 0, str(notes), str(assessedBy),
    ],
  });

  const result = computeCriticality(derived);
  await db.execute({
    sql: "UPDATE assets SET criticality = ?, updated_at = datetime('now') WHERE id = ?",
    args: [bandToAssetCriticality(result.band), assetId],
  });

  const all = await getCriticalityRegister();
  return all.find(r => r.assetId === assetId) ?? null;
}

async function refreshCriticalityBands(assetIds: (string | null | undefined)[]): Promise<void> {
  const targets = new Set(assetIds.filter((id): id is string => Boolean(id)));
  if (targets.size === 0) return;
  const rows = await getCriticalityRegister();
  const db = await getDb();
  for (const row of rows) {
    if (!targets.has(row.assetId) || !row.assessed) continue;
    const criticality = bandToAssetCriticality(row.result.band);
    if (row.legacyCriticality === criticality) continue;
    await db.execute({
      sql: "UPDATE assets SET criticality = ?, updated_at = datetime('now') WHERE id = ?",
      args: [criticality, row.assetId],
    });
  }
}

function clampInt(v: unknown, lo: number, hi: number): number {
  const n = Math.round(num(v));
  return Math.min(hi, Math.max(lo, n));
}

// ─── Vendors ───────────────────────────────────────────────────
function rowToVendor(r: Record<string, unknown>): Vendor {
  return {
    id: r.id as string, name: r.name as string, contactName: r.contact_name as string,
    email: r.email as string, phone: r.phone as string, address: r.address as string,
    website: r.website as string, paymentTerms: r.payment_terms as string,
    notes: r.notes as string, active: !!(r.active as number),
    createdAt: r.created_at as string, updatedAt: r.updated_at as string,
  };
}

export async function getVendors(): Promise<Vendor[]> {
  const rs = await (await getDb()).execute('SELECT * FROM vendors ORDER BY name');
  return (rs.rows as unknown as Record<string, unknown>[]).map(rowToVendor);
}

export async function upsertVendor(v: Vendor): Promise<void> {
  await (await getDb()).execute({ sql: `INSERT INTO vendors (id,name,contact_name,email,phone,address,website,payment_terms,notes,active,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,datetime('now'))
    ON CONFLICT(id) DO UPDATE SET name=excluded.name,contact_name=excluded.contact_name,email=excluded.email,phone=excluded.phone,address=excluded.address,website=excluded.website,payment_terms=excluded.payment_terms,notes=excluded.notes,active=excluded.active,updated_at=excluded.updated_at`,
    args: [str(v.id), str(v.name), str(v.contactName), str(v.email), str(v.phone), str(v.address), str(v.website), str(v.paymentTerms), str(v.notes), v.active ? 1 : 0] });
}

export async function deleteVendor(id: string): Promise<void> {
  await (await getDb()).execute({ sql: 'DELETE FROM vendors WHERE id = ?', args: [id] });
}

// ─── Purchase Orders ───────────────────────────────────────────
export async function getPurchaseOrders(): Promise<PurchaseOrder[]> {
  const rs = await (await getDb()).execute(`SELECT po.*, v.name as vendor_name FROM purchase_orders po LEFT JOIN vendors v ON po.vendor_id = v.id ORDER BY po.created_at DESC`);
  return (rs.rows as unknown as Record<string, unknown>[]).map(r => ({
    id: r.id as string, vendorId: (r.vendor_id as string) || '', vendorName: (r.vendor_name as string) || '',
    poNumber: r.po_number as string, status: r.status as PurchaseOrder['status'],
    orderDate: r.order_date as string, expectedDate: r.expected_date as string,
    receivedDate: r.received_date as string, totalCost: r.total_cost as number,
    notes: r.notes as string, createdBy: r.created_by as string,
    createdAt: r.created_at as string, updatedAt: r.updated_at as string,
  }));
}

export async function upsertPurchaseOrder(po: PurchaseOrder): Promise<void> {
  const db = await getDb();
  // Receiving is a stock transaction. Read the prior status first so the
  // restock only happens on the transition INTO 'received' — re-saving an
  // already-received PO must not inflate inventory again.
  const priorRs = await db.execute({ sql: 'SELECT status FROM purchase_orders WHERE id = ?', args: [po.id] });
  const prior = priorRs.rows[0] as unknown as { status: string } | undefined;
  const wasReceived = prior?.status === 'received';

  await db.execute({ sql: `INSERT INTO purchase_orders (id,vendor_id,po_number,status,order_date,expected_date,received_date,total_cost,notes,created_by,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,datetime('now'))
    ON CONFLICT(id) DO UPDATE SET vendor_id=excluded.vendor_id,po_number=excluded.po_number,status=excluded.status,order_date=excluded.order_date,expected_date=excluded.expected_date,received_date=excluded.received_date,total_cost=excluded.total_cost,notes=excluded.notes,updated_at=excluded.updated_at`,
    args: [str(po.id), str(po.vendorId) || null, str(po.poNumber), str(po.status) || 'draft', str(po.orderDate), str(po.expectedDate), str(po.receivedDate), num(po.totalCost), str(po.notes), str(po.createdBy)] });

  if (po.status === 'received' && !wasReceived) {
    const items = await db.execute({ sql: 'SELECT inventory_item_id, quantity FROM po_items WHERE po_id = ?', args: [po.id] });
    for (const raw of items.rows) {
      const item = raw as unknown as { inventory_item_id: string; quantity: number };
      // Only line items tied to a stock item affect inventory; free-text lines do not.
      if (!item.inventory_item_id) continue;
      await db.execute({
        sql: "UPDATE inventory SET quantity_on_hand = quantity_on_hand + ?, updated_at = datetime('now') WHERE id = ?",
        args: [Number(item.quantity) || 0, item.inventory_item_id],
      });
    }
  }
}

export async function deletePurchaseOrder(id: string): Promise<void> {
  await (await getDb()).execute({ sql: 'DELETE FROM purchase_orders WHERE id = ?', args: [id] });
}

export async function getPoItems(poId: string): Promise<PoItem[]> {
  const rs = await (await getDb()).execute({ sql: 'SELECT * FROM po_items WHERE po_id = ? ORDER BY id', args: [poId] });
  return (rs.rows as unknown as Record<string, unknown>[]).map(r => ({
    id: r.id as number, poId: r.po_id as string, inventoryItemId: r.inventory_item_id as string,
    itemName: r.item_name as string, quantity: r.quantity as number, unitCost: r.unit_cost as number,
    createdAt: r.created_at as string,
  }));
}

export async function addPoItem(item: { poId: string; inventoryItemId: string; itemName: string; quantity: number; unitCost: number }): Promise<void> {
  const db = await getDb();
  await db.execute({ sql: 'INSERT INTO po_items (po_id, inventory_item_id, item_name, quantity, unit_cost) VALUES (?,?,?,?,?)', args: [str(item.poId), str(item.inventoryItemId), str(item.itemName), num(item.quantity), num(item.unitCost)] });
  const totalRs = await db.execute({ sql: 'SELECT COALESCE(SUM(quantity * unit_cost),0) as t FROM po_items WHERE po_id = ?', args: [item.poId] });
  const total = (totalRs.rows[0] as unknown as { t: number }).t;
  await db.execute({ sql: 'UPDATE purchase_orders SET total_cost = ? WHERE id = ?', args: [total, item.poId] });
}

export async function deletePoItem(id: number): Promise<void> {
  const db = await getDb();
  const rowRs = await db.execute({ sql: 'SELECT po_id FROM po_items WHERE id = ?', args: [id] });
  const row = rowRs.rows[0] as unknown as { po_id: string } | undefined;
  if (!row) return;
  await db.execute({ sql: 'DELETE FROM po_items WHERE id = ?', args: [id] });
  const totalRs = await db.execute({ sql: 'SELECT COALESCE(SUM(quantity * unit_cost),0) as t FROM po_items WHERE po_id = ?', args: [row.po_id] });
  const total = (totalRs.rows[0] as unknown as { t: number }).t;
  await db.execute({ sql: 'UPDATE purchase_orders SET total_cost = ? WHERE id = ?', args: [total, row.po_id] });
}

// ─── Meter Readings ────────────────────────────────────────────
export async function getMeterReadings(assetId: string): Promise<MeterReading[]> {
  const rs = await (await getDb()).execute({ sql: 'SELECT * FROM meter_readings WHERE asset_id = ? ORDER BY reading_date DESC', args: [assetId] });
  return (rs.rows as unknown as Record<string, unknown>[]).map(r => ({
    id: r.id as number, assetId: r.asset_id as string, readingType: r.reading_type as string,
    value: r.value as number, unit: r.unit as string, readingDate: r.reading_date as string,
    recordedBy: r.recorded_by as string, notes: r.notes as string, createdAt: r.created_at as string,
  }));
}

export async function addMeterReading(entry: { assetId: string; readingType: string; value: number; unit: string; readingDate: string; recordedBy: string; notes: string }): Promise<MeterReading> {
  const result = await (await getDb()).execute({ sql: 'INSERT INTO meter_readings (asset_id, reading_type, value, unit, reading_date, recorded_by, notes) VALUES (?,?,?,?,?,?,?)', args: [str(entry.assetId), str(entry.readingType) || 'runtime_hours', num(entry.value), str(entry.unit), str(entry.readingDate), str(entry.recordedBy), str(entry.notes)] });
  return { id: Number(result.lastInsertRowid), ...entry, createdAt: new Date().toISOString() };
}

export async function deleteMeterReading(id: number): Promise<void> {
  await (await getDb()).execute({ sql: 'DELETE FROM meter_readings WHERE id = ?', args: [id] });
}

// ─── Audit Trail ───────────────────────────────────────────────
export async function logAudit(entry: { userId?: number; username: string; action: string; entityType: string; entityId: string; details: string; changes?: string }): Promise<void> {
  await (await getDb()).execute({ sql: 'INSERT INTO audit_log (user_id, username, action, entity_type, entity_id, details, changes) VALUES (?,?,?,?,?,?,?)', args: [entry.userId || null, entry.username, entry.action, entry.entityType, entry.entityId, entry.details, entry.changes || ''] });
}

export interface AuditEntry {
  id: number; timestamp: string; username: string; action: string;
  entityType: string; entityId: string; details: string; changes: string;
}

// Most recent audit entries, newest first. The table existed but only the import
// paths ever wrote to it, so there was no trail for the workflows that matter.
export async function getAuditLog(limit = 100): Promise<AuditEntry[]> {
  const capped = Math.min(Math.max(Math.trunc(limit) || 100, 1), 500);
  const rs = await (await getDb()).execute({ sql: 'SELECT * FROM audit_log ORDER BY id DESC LIMIT ?', args: [capped] });
  return (rs.rows as unknown as Record<string, unknown>[]).map(r => ({
    id: r.id as number,
    timestamp: r.timestamp as string,
    username: (r.username as string) || '',
    action: (r.action as string) || '',
    entityType: (r.entity_type as string) || '',
    entityId: (r.entity_id as string) || '',
    details: (r.details as string) || '',
    changes: (r.changes as string) || '',
  }));
}

// ─── Analytics ─────────────────────────────────────────────────
export interface AnalyticsData {
  mttr: { assetId: string; assetName: string; mttrDays: number; workOrderCount: number }[];
  mtbf: { assetId: string; assetName: string; mtbfDays: number; failureCount: number }[];
  costByAsset: { assetId: string; assetName: string; laborCost: number; partsCost: number; totalCost: number }[];
  pmCompliance: { completed: number; overdue: number; total: number; complianceRate: number };
  woByStatus: { status: string; count: number }[];
  woByType: { type: string; count: number }[];
  monthlyCosts: { month: string; labor: number; parts: number }[];
  topCostAssets: { name: string; assetId: string; total: number }[];
  inventoryValue: { totalItems: number; totalValue: number; lowStockCount: number };
  ytdStats: { totalWOs: number; totalLaborHours: number; totalPartsCost: number; avgResolutionDays: number };
  complianceOverdue: number;
  complianceTotal: number;
  backlog: { aging: string; count: number; totalCost: number }[];
  // Asset lifecycle signals. These consume replacement_cost and failure_mode,
  // which were captured on the asset form but never used by any report.
  assetInsights: {
    warranty: { id: string; name: string; warrantyExpiry: string; daysLeft: number }[];
    failureModes: { failureMode: string; count: number }[];
    replaceCandidates: { id: string; name: string; maintenanceCost: number; replacementCost: number; ratio: number }[];
  };
  // Uptime is the headline reliability number; it is derived from explicit
  // downtime intervals rather than inferred from work orders.
  availability: { windowDays: number; fleetAvailabilityPct: number; assets: AvailabilityRow[] };
  // Planned vs reactive split (the standard maintenance-mix KPI) and where PM
  // coverage is missing despite repeated failures.
  maintenanceMix: { month: string; planned: number; reactive: number }[];
  plannedPct: number;
  pmGaps: { assetId: string; assetName: string; failures: number }[];
  // Technician workload, reported as two dimensions on purpose: open work is
  // keyed by the free-text assigned_to field, hours are keyed by the login that
  // logged them. Forcing them into one row would imply a join that does not
  // exist and would split one person across two rows.
  workload: {
    openByAssignee: { name: string; openWorkOrders: number; criticalOpen: number }[];
    hours30d: { name: string; hours: number }[];
  };
}

export async function getAnalytics(): Promise<AnalyticsData> {
  const db = await getDb();

  // MTTR: average days between created_at and completed_date for completed WOs.
  // Clamped at 0 so backdated completions can never report negative repair time.
  // LEFT JOIN: asset_id is nullable, and an inner join silently dropped every
  // site-level work order from the repair-time metrics while ytdStats still
  // counted it — the two numbers disagreed. Unassigned work is grouped as such.
  const mttr = (await db.execute(`
    SELECT COALESCE(w.asset_id, '') as assetId, COALESCE(a.name, 'Unassigned') as assetName,
      ROUND(AVG(MAX(0.0, julianday(w.completed_date) - julianday(w.created_at))), 1) as mttrDays,
      COUNT(*) as workOrderCount
    FROM work_orders w LEFT JOIN assets a ON w.asset_id = a.id
    WHERE w.status = 'completed' AND w.completed_date != '' AND w.created_at != ''
    GROUP BY w.asset_id ORDER BY mttrDays DESC
  `)).rows as unknown as { assetId: string; assetName: string; mttrDays: number; workOrderCount: number }[];

  // MTBF: days between first failure and now divided by failure count
  const mtbf = (await db.execute(`
    SELECT COALESCE(w.asset_id, '') as assetId, COALESCE(a.name, 'Unassigned') as assetName,
      CAST((julianday('now') - julianday(MIN(w.created_at))) / COUNT(*) AS INTEGER) as mtbfDays,
      COUNT(*) as failureCount
    FROM work_orders w LEFT JOIN assets a ON w.asset_id = a.id
    WHERE w.type IN ('corrective','emergency') GROUP BY w.asset_id HAVING COUNT(*) > 0
    ORDER BY mtbfDays ASC
  `)).rows as unknown as { assetId: string; assetName: string; mtbfDays: number; failureCount: number }[];

  // Cost by asset. The labour rate is a setting, not a constant — it is bound
  // as a parameter (twice, for the labour and total columns).
  const laborRate = await getLaborRate();
  const costByAsset = (await db.execute({
    sql: `
    SELECT COALESCE(w.asset_id, '') as assetId, COALESCE(a.name, 'Unassigned') as assetName,
      COALESCE(SUM(w.labor_hours), 0) * ? as laborCost,
      COALESCE(SUM(w.parts_cost), 0) as partsCost,
      COALESCE(SUM(w.labor_hours), 0) * ? + COALESCE(SUM(w.parts_cost), 0) as totalCost
    FROM work_orders w LEFT JOIN assets a ON w.asset_id = a.id
    WHERE w.status = 'completed' GROUP BY w.asset_id ORDER BY totalCost DESC
  `,
    args: [laborRate, laborRate],
  })).rows as unknown as { assetId: string; assetName: string; laborCost: number; partsCost: number; totalCost: number }[];

  // PM Compliance. Deferred PMs are excluded (they are consciously parked, with
  // an approver) and runtime-hour PMs are evaluated on meter hours, not dates.
  // The previous formula counted anything completed in the last 7 days as
  // compliant, which scored genuinely overdue work as green.
  const calendarPm = (await db.execute(`
    SELECT COUNT(*) as total,
      SUM(CASE WHEN next_due != '' AND next_due < date('now') THEN 1 ELSE 0 END) as overdue
    FROM pm_schedules WHERE active = 1 AND deferral_reason = '' AND frequency_type != 'runtime_hours'
  `)).rows[0] as unknown as { total: number; overdue: number };
  const runtimeAll = await getRuntimePmStatuses();
  const deferredIds = new Set(
    ((await db.execute("SELECT id FROM pm_schedules WHERE active = 1 AND deferral_reason != ''")).rows as unknown as { id: string }[]).map(r => r.id),
  );
  const runtimeList = Object.values(runtimeAll).filter(r => !deferredIds.has(r.pmId));
  const pmTotal = (Number(calendarPm.total) || 0) + runtimeList.length;
  const pmOverdue = (Number(calendarPm.overdue) || 0) + runtimeList.filter(r => r.due).length;
  const pmStats = { completed: Math.max(0, pmTotal - pmOverdue), overdue: pmOverdue, total: pmTotal };
  const complianceRate = pmTotal > 0 ? Math.round((pmStats.completed / pmTotal) * 100) : 100;

  // WO by status
  const woByStatus = ((await db.execute(`SELECT status, COUNT(*) as count FROM work_orders GROUP BY status`)).rows as unknown as { status: string; count: number }[]);

  // WO by type
  const woByType = ((await db.execute(`SELECT type, COUNT(*) as count FROM work_orders GROUP BY type`)).rows as unknown as { type: string; count: number }[]);

  // Monthly costs (last 6 months)
  const monthlyCosts = ((await db.execute({
    sql: `
    SELECT strftime('%Y-%m', completed_date) as month,
      COALESCE(SUM(labor_hours), 0) * ? as labor,
      COALESCE(SUM(parts_cost), 0) as parts
    FROM work_orders WHERE status = 'completed' AND completed_date >= date('now','-6 months')
    GROUP BY month ORDER BY month
  `,
    args: [laborRate],
  })).rows as unknown as { month: string; labor: number; parts: number }[]);

  // Top cost assets
  const topCostAssets = ((await db.execute({
    sql: `
    SELECT COALESCE(a.name, 'Unassigned') as name, COALESCE(w.asset_id, '') as assetId,
      COALESCE(SUM(w.labor_hours),0)*? + COALESCE(SUM(w.parts_cost),0) as total
    FROM work_orders w LEFT JOIN assets a ON w.asset_id = a.id
    WHERE w.status = 'completed' GROUP BY w.asset_id ORDER BY total DESC LIMIT 5
  `,
    args: [laborRate],
  })).rows as unknown as { name: string; assetId: string; total: number }[]);

  // Inventory value
  const invStats = (await db.execute(`
    SELECT COUNT(*) as totalItems, COALESCE(SUM(quantity_on_hand * unit_cost), 0) as totalValue,
      SUM(CASE WHEN quantity_on_hand <= min_quantity AND min_quantity > 0 THEN 1 ELSE 0 END) as lowStockCount
    FROM inventory
  `)).rows[0] as unknown as { totalItems: number; totalValue: number; lowStockCount: number };

  // YTD stats
  const ytdStats = (await db.execute(`
    SELECT COUNT(*) as totalWOs, COALESCE(SUM(labor_hours), 0) as totalLaborHours,
      COALESCE(SUM(parts_cost), 0) as totalPartsCost,
      ROUND(AVG(CASE WHEN completed_date != '' THEN julianday(completed_date) - julianday(created_at) END), 1) as avgResolutionDays
    FROM work_orders WHERE created_at >= date('now','start of year')
  `)).rows[0] as unknown as { totalWOs: number; totalLaborHours: number; totalPartsCost: number; avgResolutionDays: number };

  // Compliance overdue count
  const compOverdue = ((await db.execute(`SELECT COUNT(*) as c FROM compliance_obligations WHERE next_due < date('now') AND status IN ('open','in_progress')`)).rows[0] as unknown as { c: number }).c;
  const compTotal = ((await db.execute('SELECT COUNT(*) as c FROM compliance_obligations')).rows[0] as unknown as { c: number }).c;

  // ─── Asset lifecycle signals ─────────────────────────────────
  // Warranty cover ending (or already gone) — nobody notices an expiry date
  // buried in an asset record.
  const warranty = ((await db.execute(`
    SELECT id, name, warranty_expiry,
      CAST(julianday(warranty_expiry) - julianday('now') AS INTEGER) as days_left
    FROM assets
    WHERE warranty_expiry != '' AND warranty_expiry <= date('now','+90 days')
    ORDER BY warranty_expiry ASC LIMIT 25
  `)).rows as unknown as { id: string; name: string; warranty_expiry: string; days_left: number }[])
    .map(r => ({ id: r.id, name: r.name, warrantyExpiry: r.warranty_expiry, daysLeft: Number(r.days_left) }));

  // Failure-mode Pareto: which failure modes actually drive corrective work.
  const failureModes = ((await db.execute(`
    WITH failure_events AS (
      SELECT w.id AS event_id,
        COALESCE(
          NULLIF((SELECT r.failure_mode FROM root_cause_analyses r
            WHERE r.work_order_id = w.id ORDER BY r.created_at DESC LIMIT 1), ''),
          NULLIF(a.failure_mode, ''),
          'Unclassified'
        ) AS failure_mode
      FROM work_orders w LEFT JOIN assets a ON w.asset_id = a.id
      WHERE w.type IN ('corrective','emergency')
      UNION ALL
      SELECT r.id AS event_id, COALESCE(NULLIF(r.failure_mode, ''), 'Unclassified')
      FROM root_cause_analyses r WHERE r.work_order_id IS NULL
    )
    SELECT failure_mode AS failureMode, COUNT(*) AS count
    FROM failure_events GROUP BY failure_mode ORDER BY count DESC LIMIT 12
  `)).rows as unknown as { failureMode: string; count: number }[]);

  // Replace-vs-repair: cumulative maintenance cost against replacement cost.
  // Assets below a 10% ratio are noise; the ratio is returned so the UI can
  // frame it rather than asserting a verdict.
  const replaceCandidates = ((await db.execute({
    sql: `
    SELECT a.id, a.name,
      a.replacement_cost as replacementCost,
      COALESCE(SUM(w.labor_hours),0) * ? + COALESCE(SUM(w.parts_cost),0) as maintenanceCost
    FROM assets a
    JOIN work_orders w ON w.asset_id = a.id AND w.status = 'completed'
    WHERE a.replacement_cost > 0
    GROUP BY a.id
    HAVING maintenanceCost > 0
    ORDER BY maintenanceCost DESC LIMIT 15
  `,
    args: [laborRate],
  })).rows as unknown as { id: string; name: string; replacementCost: number; maintenanceCost: number }[])
    .map(r => ({
      id: r.id,
      name: r.name,
      maintenanceCost: Math.round(Number(r.maintenanceCost) * 100) / 100,
      replacementCost: Number(r.replacementCost),
      ratio: Math.round((Number(r.maintenanceCost) / Number(r.replacementCost)) * 100) / 100,
    }))
    .filter(r => r.ratio >= 0.1)
    .sort((a, b) => b.ratio - a.ratio);

  // ─── Maintenance mix (planned vs reactive) ───────────────────
  // The honest reading of "is preventive work paying off": what share of the
  // work being raised is planned rather than a reaction to a failure.
  const maintenanceMix = ((await db.execute(`
    SELECT strftime('%Y-%m', created_at) as month,
      SUM(CASE WHEN type IN ('preventive','predictive','inspection') THEN 1 ELSE 0 END) as planned,
      SUM(CASE WHEN type IN ('corrective','emergency') THEN 1 ELSE 0 END) as reactive
    FROM work_orders WHERE created_at >= date('now','-6 months')
    GROUP BY month ORDER BY month
  `)).rows as unknown as { month: string; planned: number; reactive: number }[])
    .map(r => ({ month: r.month, planned: Number(r.planned) || 0, reactive: Number(r.reactive) || 0 }));
  const totalPlanned = maintenanceMix.reduce((s, m) => s + m.planned, 0);
  const totalReactive = maintenanceMix.reduce((s, m) => s + m.reactive, 0);
  const plannedPct = totalPlanned + totalReactive > 0
    ? Math.round((totalPlanned / (totalPlanned + totalReactive)) * 100)
    : 100;

  // Assets with repeated corrective work but no active PM schedule: the clearest
  // actionable gap in a preventive programme.
  const pmGaps = ((await db.execute(`
    SELECT a.id as assetId, a.name as assetName, COUNT(*) as failures
    FROM work_orders w JOIN assets a ON w.asset_id = a.id
    WHERE w.type IN ('corrective','emergency') AND w.created_at >= date('now','-90 days')
      AND NOT EXISTS (SELECT 1 FROM pm_schedules pm WHERE pm.asset_id = a.id AND pm.active = 1)
    GROUP BY a.id HAVING COUNT(*) >= 2 ORDER BY failures DESC LIMIT 10
  `)).rows as unknown as { assetId: string; assetName: string; failures: number }[])
    .map(r => ({ assetId: r.assetId, assetName: r.assetName, failures: Number(r.failures) || 0 }));

  // ─── Technician workload ────────────────────────────────────
  const openByAssignee = ((await db.execute(`
    SELECT COALESCE(NULLIF(assigned_to, ''), 'Unassigned') as name,
      COUNT(*) as openWorkOrders,
      SUM(CASE WHEN priority = 'critical' THEN 1 ELSE 0 END) as criticalOpen
    FROM work_orders WHERE status IN ('open','in_progress','on_hold')
    GROUP BY name ORDER BY criticalOpen DESC, openWorkOrders DESC LIMIT 12
  `)).rows as unknown as { name: string; openWorkOrders: number; criticalOpen: number }[])
    .map(r => ({ name: r.name, openWorkOrders: Number(r.openWorkOrders) || 0, criticalOpen: Number(r.criticalOpen) || 0 }));
  const hours30d = ((await db.execute(`
    SELECT COALESCE(NULLIF(username, ''), 'Unknown') as name, SUM(hours) as hours
    FROM wo_labor WHERE logged_date >= date('now','-30 days')
    GROUP BY name ORDER BY hours DESC LIMIT 12
  `)).rows as unknown as { name: string; hours: number }[])
    .map(r => ({ name: r.name, hours: Math.round((Number(r.hours) || 0) * 10) / 10 }));

  return {
    mttr, mtbf, costByAsset,
    pmCompliance: { ...pmStats, complianceRate },
    woByStatus, woByType, monthlyCosts, topCostAssets,
    inventoryValue: invStats, ytdStats,
    complianceOverdue: compOverdue,
    complianceTotal: compTotal,
    backlog: await getBacklogAging(),
    assetInsights: { warranty, failureModes, replaceCandidates },
    availability: await getAvailability(30),
    maintenanceMix, plannedPct, pmGaps, workload: { openByAssignee, hours30d },
  };
}

// ─── Sites ─────────────────────────────────────────────────────
export async function getSites(): Promise<Site[]> {
  const rs = await (await getDb()).execute('SELECT * FROM sites ORDER BY river_mile');
  return (rs.rows as unknown as Record<string, unknown>[]).map(r => ({
    id: r.id as string, name: r.name as string, fercNo: r.ferc_no as string,
    riverSystem: r.river_system as string, riverMile: r.river_mile as number,
    capacityMw: r.capacity_mw as string, county: r.county as string, state: r.state as string,
    operator: r.operator as string, yearBuilt: r.year_built as number,
    status: r.status as Site['status'], createdAt: r.created_at as string, updatedAt: r.updated_at as string,
  }));
}

export async function upsertSite(site: Site): Promise<void> {
  await (await getDb()).execute({ sql: `INSERT INTO sites (id,name,ferc_no,river_system,river_mile,capacity_mw,county,state,operator,year_built,status,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,datetime('now'))
    ON CONFLICT(id) DO UPDATE SET name=excluded.name,ferc_no=excluded.ferc_no,river_system=excluded.river_system,river_mile=excluded.river_mile,capacity_mw=excluded.capacity_mw,county=excluded.county,state=excluded.state,operator=excluded.operator,year_built=excluded.year_built,status=excluded.status,updated_at=excluded.updated_at`,
    args: [str(site.id), str(site.name), str(site.fercNo), str(site.riverSystem), num(site.riverMile), str(site.capacityMw), str(site.county), str(site.state), str(site.operator), num(site.yearBuilt), str(site.status) || 'operational'] });
}

// ─── Compliance Obligations ────────────────────────────────────
export async function getComplianceObligations(): Promise<ComplianceObligation[]> {
  const rs = await (await getDb()).execute('SELECT * FROM compliance_obligations ORDER BY next_due');
  return (rs.rows as unknown as Record<string, unknown>[]).map(r => ({
    id: r.id as string, siteId: (r.site_id ?? '') as string,
    obligationType: r.obligation_type as ComplianceObligation['obligationType'],
    title: r.title as string, description: r.description as string,
    regulationRef: r.regulation_ref as string,
    frequency: r.frequency as ComplianceObligation['frequency'],
    lastCompleted: r.last_completed as string, nextDue: r.next_due as string,
    ownerRole: r.owner_role as string, evidenceRequired: r.evidence_required as string,
    status: r.status as ComplianceObligation['status'],
    priority: r.priority as ComplianceObligation['priority'],
    notes: r.notes as string, createdAt: r.created_at as string, updatedAt: r.updated_at as string,
  }));
}

export async function upsertComplianceObligation(o: ComplianceObligation): Promise<void> {
  await (await getDb()).execute({ sql: `INSERT INTO compliance_obligations (id,site_id,obligation_type,title,description,regulation_ref,frequency,last_completed,next_due,owner_role,evidence_required,status,priority,notes,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))
    ON CONFLICT(id) DO UPDATE SET obligation_type=excluded.obligation_type,title=excluded.title,description=excluded.description,regulation_ref=excluded.regulation_ref,frequency=excluded.frequency,last_completed=excluded.last_completed,next_due=excluded.next_due,owner_role=excluded.owner_role,evidence_required=excluded.evidence_required,status=excluded.status,priority=excluded.priority,notes=excluded.notes,updated_at=excluded.updated_at`,
    args: [str(o.id), str(o.siteId) || null, str(o.obligationType) || 'other', str(o.title), str(o.description), str(o.regulationRef), str(o.frequency) || 'annual', str(o.lastCompleted), str(o.nextDue), str(o.ownerRole), str(o.evidenceRequired), str(o.status) || 'open', str(o.priority) || 'high', str(o.notes)] });
}

// ─── Inspections ───────────────────────────────────────────────
export async function getInspections(): Promise<Inspection[]> {
  const rs = await (await getDb()).execute(`
    SELECT i.*,
      (SELECT wo.id FROM work_orders wo WHERE wo.source_inspection_id = i.id ORDER BY wo.created_at DESC LIMIT 1) AS work_order_id
    FROM inspections i ORDER BY i.scheduled_date DESC
  `);
  return (rs.rows as unknown as Record<string, unknown>[]).map(r => ({
    id: r.id as string, siteId: (r.site_id ?? '') as string, assetId: (r.asset_id ?? '') as string,
    complianceObligationId: (r.compliance_obligation_id ?? '') as string,
    workOrderId: (r.work_order_id ?? '') as string,
    inspectionType: r.inspection_type as Inspection['inspectionType'],
    title: r.title as string, description: r.description as string,
    scheduledDate: r.scheduled_date as string, completedDate: r.completed_date as string,
    inspector: r.inspector as string, findings: r.findings as string,
    recommendations: r.recommendations as string, correctiveActions: r.corrective_actions as string,
    readings: r.readings as string, photos: r.photos as string,
    status: r.status as Inspection['status'],
    priority: r.priority as Inspection['priority'],
    createdAt: r.created_at as string, updatedAt: r.updated_at as string,
  }));
}

export async function upsertInspection(i: Inspection): Promise<void> {
  const db = await getDb();
  const [assetRs, obligationRs] = await Promise.all([
    i.assetId ? db.execute({ sql: 'SELECT site_id FROM assets WHERE id = ?', args: [i.assetId] }) : Promise.resolve({ rows: [] }),
    i.complianceObligationId ? db.execute({ sql: 'SELECT site_id FROM compliance_obligations WHERE id = ?', args: [i.complianceObligationId] }) : Promise.resolve({ rows: [] }),
  ]);
  const assetSiteId = (assetRs.rows[0] as unknown as { site_id?: string | null } | undefined)?.site_id;
  const obligationSiteId = (obligationRs.rows[0] as unknown as { site_id?: string | null } | undefined)?.site_id;
  const siteId = assetSiteId || obligationSiteId || i.siteId || null;
  await db.execute({ sql: `INSERT INTO inspections (id,site_id,asset_id,compliance_obligation_id,inspection_type,title,description,scheduled_date,completed_date,inspector,findings,recommendations,corrective_actions,readings,photos,status,priority,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))
    ON CONFLICT(id) DO UPDATE SET site_id=excluded.site_id,asset_id=excluded.asset_id,compliance_obligation_id=excluded.compliance_obligation_id,inspection_type=excluded.inspection_type,title=excluded.title,description=excluded.description,scheduled_date=excluded.scheduled_date,completed_date=excluded.completed_date,inspector=excluded.inspector,findings=excluded.findings,recommendations=excluded.recommendations,corrective_actions=excluded.corrective_actions,readings=excluded.readings,photos=excluded.photos,status=excluded.status,priority=excluded.priority,updated_at=excluded.updated_at`,
    args: [str(i.id), siteId, str(i.assetId) || null, str(i.complianceObligationId) || null, str(i.inspectionType) || 'visual', str(i.title), str(i.description), str(i.scheduledDate), str(i.completedDate), str(i.inspector), str(i.findings), str(i.recommendations), str(i.correctiveActions), str(i.readings), str(i.photos), str(i.status) || 'scheduled', str(i.priority) || 'medium'] });
}

// ─── Documents ─────────────────────────────────────────────────
export async function getDocuments(): Promise<Document[]> {
  const rs = await (await getDb()).execute('SELECT * FROM documents ORDER BY upload_date DESC');
  return (rs.rows as unknown as Record<string, unknown>[]).map(r => ({
    id: r.id as string, assetId: (r.asset_id ?? '') as string,
    documentType: r.document_type as Document['documentType'],
    title: r.title as string, description: r.description as string,
    filePath: r.file_path as string, fileUrl: r.file_url as string,
    version: r.version as string, uploadedBy: r.uploaded_by as string,
    uploadDate: r.upload_date as string, reviewDueDate: r.review_due_date as string,
    tags: r.tags as string, active: !!(r.active),
    createdAt: r.created_at as string, updatedAt: r.updated_at as string,
  }));
}

export async function upsertDocument(d: Document): Promise<void> {
  await (await getDb()).execute({ sql: `INSERT INTO documents (id,asset_id,document_type,title,description,file_path,file_url,version,uploaded_by,upload_date,review_due_date,tags,active,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))
    ON CONFLICT(id) DO UPDATE SET document_type=excluded.document_type,title=excluded.title,description=excluded.description,file_path=excluded.file_path,file_url=excluded.file_url,version=excluded.version,review_due_date=excluded.review_due_date,tags=excluded.tags,active=excluded.active,updated_at=excluded.updated_at`,
    args: [str(d.id), str(d.assetId) || null, str(d.documentType) || 'other', str(d.title), str(d.description), str(d.filePath), str(d.fileUrl), str(d.version) || '1.0', str(d.uploadedBy), str(d.uploadDate), str(d.reviewDueDate), str(d.tags), d.active === false ? 0 : 1] });
}

// ─── Safety Permits ────────────────────────────────────────────
export async function getSafetyPermits(): Promise<SafetyPermit[]> {
  const rs = await (await getDb()).execute('SELECT * FROM safety_permits ORDER BY issued_date DESC');
  return (rs.rows as unknown as Record<string, unknown>[]).map(r => ({
    id: r.id as string, workOrderId: (r.work_order_id ?? '') as string, assetId: (r.asset_id ?? '') as string,
    permitType: r.permit_type as SafetyPermit['permitType'],
    permitNumber: r.permit_number as string, issuedBy: r.issued_by as string,
    issuedDate: r.issued_date as string, expiryDate: r.expiry_date as string,
    status: r.status as SafetyPermit['status'],
    description: r.description as string, hazards: r.hazards as string,
    precautions: r.precautions as string, approvedBy: r.approved_by as string,
    attachments: r.attachments as string,
    createdAt: r.created_at as string, updatedAt: r.updated_at as string,
  }));
}

export async function upsertSafetyPermit(s: SafetyPermit): Promise<void> {
  await (await getDb()).execute({ sql: `INSERT INTO safety_permits (id,work_order_id,asset_id,permit_type,permit_number,issued_by,issued_date,expiry_date,status,description,hazards,precautions,approved_by,attachments,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))
    ON CONFLICT(id) DO UPDATE SET work_order_id=excluded.work_order_id,asset_id=excluded.asset_id,permit_type=excluded.permit_type,permit_number=excluded.permit_number,issued_by=excluded.issued_by,issued_date=excluded.issued_date,expiry_date=excluded.expiry_date,status=excluded.status,description=excluded.description,hazards=excluded.hazards,precautions=excluded.precautions,approved_by=excluded.approved_by,attachments=excluded.attachments,updated_at=excluded.updated_at`,
    args: [str(s.id), str(s.workOrderId) || null, str(s.assetId) || null, str(s.permitType) || 'other', str(s.permitNumber), str(s.issuedBy), str(s.issuedDate), str(s.expiryDate), str(s.status) || 'draft', str(s.description), str(s.hazards), str(s.precautions), str(s.approvedBy), str(s.attachments)] });
}

// ─── Oil Analysis ──────────────────────────────────────────────
export async function getOilAnalysisRecords(): Promise<OilAnalysisRecord[]> {
  const rs = await (await getDb()).execute(`
    SELECT o.*,
      (SELECT wo.id FROM work_orders wo WHERE wo.source_oil_analysis_id = o.id ORDER BY wo.created_at DESC LIMIT 1) AS follow_up_work_order_id
    FROM oil_analysis_records o
    ORDER BY o.sample_date DESC
  `);
  return (rs.rows as unknown as Record<string, unknown>[]).map(r => ({
    id: r.id as string,
    assetId: r.asset_id as string,
    sampleType: r.sample_type as OilAnalysisRecord['sampleType'],
    sampleDate: r.sample_date as string,
    samplePoint: r.sample_point as string,
    sampleId: r.sample_id as string,
    sampledBy: r.sampled_by as string,
    labName: r.lab_name as string,
    reportNumber: r.report_number as string,
    oilBrand: r.oil_brand as string,
    oilGrade: r.oil_grade as string,
    hoursOnOil: r.hours_on_oil as string,
    assessment: r.assessment as OilAnalysisRecord['assessment'],
    assessmentNotes: r.assessment_notes as string,
    recommendations: r.recommendations as string,
    nextSampleDue: r.next_sample_due as string,
    notes: r.notes as string,
    measurements: JSON.parse(r.measurements_json as string) as Record<string, string>,
    followUpWorkOrderId: (r.follow_up_work_order_id ?? '') as string,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  }));
}

export async function upsertOilAnalysisRecord(record: OilAnalysisRecord): Promise<void> {
  await (await getDb()).execute({
    sql: `INSERT INTO oil_analysis_records (id,asset_id,sample_type,sample_date,sample_point,sample_id,sampled_by,lab_name,report_number,oil_brand,oil_grade,hours_on_oil,assessment,assessment_notes,recommendations,next_sample_due,notes,measurements_json,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))
      ON CONFLICT(id) DO UPDATE SET asset_id=excluded.asset_id,sample_type=excluded.sample_type,sample_date=excluded.sample_date,sample_point=excluded.sample_point,sample_id=excluded.sample_id,sampled_by=excluded.sampled_by,lab_name=excluded.lab_name,report_number=excluded.report_number,oil_brand=excluded.oil_brand,oil_grade=excluded.oil_grade,hours_on_oil=excluded.hours_on_oil,assessment=excluded.assessment,assessment_notes=excluded.assessment_notes,recommendations=excluded.recommendations,next_sample_due=excluded.next_sample_due,notes=excluded.notes,measurements_json=excluded.measurements_json,updated_at=excluded.updated_at`,
    args: [
      record.id, record.assetId, record.sampleType, record.sampleDate, record.samplePoint,
      record.sampleId, record.sampledBy, record.labName, record.reportNumber, record.oilBrand,
      record.oilGrade, record.hoursOnOil, record.assessment, record.assessmentNotes,
      record.recommendations, record.nextSampleDue, record.notes, JSON.stringify(record.measurements),
    ],
  });
}

export async function deleteOilAnalysisRecord(id: string): Promise<void> {
  await (await getDb()).execute({ sql: 'DELETE FROM oil_analysis_records WHERE id = ?', args: [id] });
}

// ─── Equipment Testing ─────────────────────────────────────────
export async function getTestingRecords(): Promise<EquipmentTest[]> {
  const rs = await (await getDb()).execute(`
    SELECT t.*,
      (SELECT wo.id FROM work_orders wo WHERE wo.source_testing_record_id = t.id ORDER BY wo.created_at DESC LIMIT 1) AS follow_up_work_order_id
    FROM testing_records t ORDER BY t.test_date DESC
  `);
  return (rs.rows as unknown as Record<string, unknown>[]).map(r => ({
    id: r.id as string, assetId: (r.asset_id ?? '') as string,
    followUpWorkOrderId: (r.follow_up_work_order_id ?? '') as string,
    discipline: r.discipline as EquipmentTest['discipline'],
    testType: r.test_type as EquipmentTest['testType'],
    testDate: r.test_date as string, results: r.results as string,
    nextDue: r.next_due as string, testedBy: r.tested_by as string,
    status: r.status as EquipmentTest['status'],
    notes: r.notes as string, createdAt: r.created_at as string, updatedAt: r.updated_at as string,
  }));
}

export async function upsertTestingRecord(t: EquipmentTest): Promise<void> {
  await (await getDb()).execute({ sql: `INSERT INTO testing_records (id,asset_id,discipline,test_type,test_date,results,next_due,tested_by,status,notes,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,datetime('now'))
    ON CONFLICT(id) DO UPDATE SET asset_id=excluded.asset_id,discipline=excluded.discipline,test_type=excluded.test_type,test_date=excluded.test_date,results=excluded.results,next_due=excluded.next_due,tested_by=excluded.tested_by,status=excluded.status,notes=excluded.notes,updated_at=excluded.updated_at`,
    args: [str(t.id), str(t.assetId) || null, str(t.discipline) || 'electrical', str(t.testType) || 'other', str(t.testDate), str(t.results), str(t.nextDue), str(t.testedBy), str(t.status) || 'pending', str(t.notes)] });
}

// ─── Root Cause Analysis ───────────────────────────────────────
function rowToRootCauseAnalysis(r: Record<string, unknown>): RootCauseAnalysis {
  return {
    id: str(r.id), assetId: str(r.asset_id), workOrderId: str(r.work_order_id),
    failureDate: str(r.failure_date), failureMode: str(r.failure_mode),
    symptoms: str(r.symptoms), causeCategory: r.cause_category as RootCauseAnalysis['causeCategory'],
    rootCause: str(r.root_cause), contributingFactors: str(r.contributing_factors),
    correctiveAction: str(r.corrective_action), preventiveAction: str(r.preventive_action),
    actionOwner: str(r.action_owner), dueDate: str(r.due_date),
    status: r.status as RootCauseAnalysis['status'], createdBy: str(r.created_by),
    createdAt: str(r.created_at), updatedAt: str(r.updated_at),
  };
}

export async function getRootCauseAnalyses(): Promise<RootCauseAnalysis[]> {
  const rs = await (await getDb()).execute('SELECT * FROM root_cause_analyses ORDER BY failure_date DESC, created_at DESC');
  return (rs.rows as unknown as Record<string, unknown>[]).map(rowToRootCauseAnalysis);
}

export async function getRootCauseAnalysis(id: string): Promise<RootCauseAnalysis | null> {
  const rs = await (await getDb()).execute({ sql: 'SELECT * FROM root_cause_analyses WHERE id = ?', args: [id] });
  const row = rs.rows[0] as unknown as Record<string, unknown> | undefined;
  return row ? rowToRootCauseAnalysis(row) : null;
}

export async function upsertRootCauseAnalysis(analysis: RootCauseAnalysis): Promise<void> {
  await (await getDb()).execute({
    sql: `INSERT INTO root_cause_analyses
      (id,asset_id,work_order_id,failure_date,failure_mode,symptoms,cause_category,root_cause,contributing_factors,
       corrective_action,preventive_action,action_owner,due_date,status,created_by,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))
      ON CONFLICT(id) DO UPDATE SET asset_id=excluded.asset_id,work_order_id=excluded.work_order_id,
        failure_date=excluded.failure_date,failure_mode=excluded.failure_mode,symptoms=excluded.symptoms,
        cause_category=excluded.cause_category,root_cause=excluded.root_cause,
        contributing_factors=excluded.contributing_factors,corrective_action=excluded.corrective_action,
        preventive_action=excluded.preventive_action,action_owner=excluded.action_owner,due_date=excluded.due_date,
        status=excluded.status,updated_at=excluded.updated_at`,
    args: [
      str(analysis.id), str(analysis.assetId), str(analysis.workOrderId) || null, str(analysis.failureDate),
      str(analysis.failureMode), str(analysis.symptoms), str(analysis.causeCategory) || 'unknown',
      str(analysis.rootCause), str(analysis.contributingFactors), str(analysis.correctiveAction),
      str(analysis.preventiveAction), str(analysis.actionOwner), str(analysis.dueDate),
      str(analysis.status) || 'open', str(analysis.createdBy),
    ],
  });
}

// ─── Backlog aging (for dashboard / reports) ──────────────────
export async function getBacklogAging(): Promise<{ aging: string; count: number; totalCost: number }[]> {
  const db = await getDb();
  const laborRate = await getLaborRate();
  const rs = await db.execute({
    sql: `
    SELECT
      CASE
        WHEN julianday('now') - julianday(due_date) > 90 THEN '90+ days'
        WHEN julianday('now') - julianday(due_date) > 30 THEN '30-90 days'
        WHEN julianday('now') - julianday(due_date) > 7  THEN '7-30 days'
        WHEN julianday('now') > julianday(due_date) THEN '1-7 days'
        ELSE 'Not overdue'
      END as aging,
      COUNT(*) as count,
      COALESCE(SUM(labor_hours * ? + parts_cost), 0) as totalCost
    FROM work_orders WHERE status NOT IN ('completed','cancelled')
    GROUP BY aging ORDER BY
      CASE aging
        WHEN '90+ days' THEN 1 WHEN '30-90 days' THEN 2
        WHEN '7-30 days' THEN 3 WHEN '1-7 days' THEN 4 ELSE 5
      END
  `,
    args: [laborRate],
  });
  return rs.rows as unknown as { aging: string; count: number; totalCost: number }[];
}

function rowToProcedureStep(r: Record<string, unknown>): ProcedureStep {
  return {
    id: r.id as number,
    procedureId: r.procedure_id as string,
    stepOrder: r.step_order as number,
    instruction: r.instruction as string,
    expectedResult: (r.expected_result as string) || '',
    responseType: r.response_type as ProcedureResponseType,
    unit: (r.unit as string) || '',
    safetyNote: (r.safety_note as string) || '',
  };
}

function rowToProcedure(r: Record<string, unknown>): Procedure {
  return {
    id: r.id as string,
    title: r.title as string,
    description: (r.description as string) || '',
    category: r.category as Procedure['category'],
    assetId: (r.asset_id as string) || '',
    version: (r.version as string) || '1.0',
    status: ((r.status as string) || 'draft') as Procedure['status'],
    approvedBy: (r.approved_by as string) || '',
    approvedAt: (r.approved_at as string) || '',
    active: !!(r.active as number),
    stepCount: Number(r.step_count ?? 0),
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

function rowToProcedureRevision(r: Record<string, unknown>): ProcedureRevision {
  let steps: ProcedureStep[] = [];
  try {
    steps = JSON.parse((r.steps_json as string) || '[]') as ProcedureStep[];
  } catch {
    steps = [];
  }
  return {
    id: r.id as number,
    procedureId: r.procedure_id as string,
    revisionNo: Number(r.revision_no ?? 1),
    version: (r.version as string) || '1.0',
    title: (r.title as string) || '',
    description: (r.description as string) || '',
    category: (r.category as string) as ProcedureRevision['category'],
    assetId: (r.asset_id as string) || '',
    status: ((r.status as string) || 'draft') as ProcedureRevision['status'],
    steps,
    changedBy: (r.changed_by as string) || '',
    changeNote: (r.change_note as string) || '',
    createdAt: r.created_at as string,
  };
}

// Append an immutable snapshot of the procedure as it stands right now.
async function appendProcedureRevision(p: Procedure, changedBy: string, changeNote: string): Promise<number> {
  const db = await getDb();
  const maxRs = await db.execute({ sql: 'SELECT COALESCE(MAX(revision_no),0) as m FROM procedure_revisions WHERE procedure_id = ?', args: [p.id] });
  const revisionNo = Number((maxRs.rows[0] as unknown as { m: number }).m) + 1;
  const steps = (p.steps || []).filter(s => s.instruction.trim()).map((s, i) => ({
    id: 0, procedureId: p.id, stepOrder: s.stepOrder || i + 1, instruction: s.instruction.trim(),
    expectedResult: s.expectedResult || '', responseType: s.responseType || 'checkbox', unit: s.unit || '', safetyNote: s.safetyNote || '',
  }));
  await db.execute({
    sql: `INSERT INTO procedure_revisions (procedure_id,revision_no,version,title,description,category,asset_id,status,steps_json,changed_by,change_note)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    args: [p.id, revisionNo, p.version || '1.0', p.title, p.description || '', p.category, p.assetId || '', p.status || 'draft', JSON.stringify(steps), changedBy || '', changeNote || ''],
  });
  return revisionNo;
}

// Asset-scoped listing: an optional assetId returns procedures that target that
// asset plus generic (asset-agnostic) procedures, so the picker is never empty.
export async function getProcedures(assetId?: string): Promise<Procedure[]> {
  const db = await getDb();
  if (assetId) {
    const rs = await db.execute({
      sql: `SELECT p.*, (SELECT COUNT(*) FROM procedure_steps s WHERE s.procedure_id = p.id) AS step_count
        FROM procedures p WHERE p.asset_id = '' OR p.asset_id = ? ORDER BY p.title`,
      args: [assetId],
    });
    return (rs.rows as unknown as Record<string, unknown>[]).map(rowToProcedure);
  }
  const rs = await db.execute(`
    SELECT p.*, (SELECT COUNT(*) FROM procedure_steps s WHERE s.procedure_id = p.id) AS step_count
    FROM procedures p ORDER BY p.title
  `);
  return (rs.rows as unknown as Record<string, unknown>[]).map(rowToProcedure);
}

export async function getProcedure(id: string): Promise<Procedure | null> {
  const db = await getDb();
  const rs = await db.execute({ sql: 'SELECT * FROM procedures WHERE id = ?', args: [id] });
  const row = rs.rows[0] as unknown as Record<string, unknown> | undefined;
  if (!row) return null;
  const steps = await db.execute({ sql: 'SELECT * FROM procedure_steps WHERE procedure_id = ? ORDER BY step_order, id', args: [id] });
  return {
    ...rowToProcedure(row),
    steps: (steps.rows as unknown as Record<string, unknown>[]).map(rowToProcedureStep),
  };
}

export async function upsertProcedure(p: Procedure, changedBy = '', changeNote = ''): Promise<void> {
  const db = await getDb();
  await db.execute({
    sql: `INSERT INTO procedures (id,title,description,category,asset_id,version,status,approved_by,approved_at,active,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,datetime('now'))
      ON CONFLICT(id) DO UPDATE SET title=excluded.title,description=excluded.description,category=excluded.category,asset_id=excluded.asset_id,version=excluded.version,status=excluded.status,approved_by=excluded.approved_by,approved_at=excluded.approved_at,active=excluded.active,updated_at=excluded.updated_at`,
    args: [p.id, p.title, p.description, p.category, p.assetId || '', p.version || '1.0', p.status || 'draft', p.approvedBy || '', p.approvedAt || '', p.active ? 1 : 0],
  });
  await db.execute({ sql: 'DELETE FROM procedure_steps WHERE procedure_id = ?', args: [p.id] });
  const steps = p.steps || [];
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    if (!s.instruction.trim()) continue;
    await db.execute({
      sql: `INSERT INTO procedure_steps (procedure_id,step_order,instruction,expected_result,response_type,unit,safety_note)
        VALUES (?,?,?,?,?,?,?)`,
      args: [p.id, s.stepOrder || i + 1, s.instruction.trim(), s.expectedResult || '', s.responseType || 'checkbox', s.unit || '', s.safetyNote || ''],
    });
  }
  await appendProcedureRevision(p, changedBy, changeNote);
}

// Approve a procedure: records the signer and timestamp, then logs a revision so
// the approval itself is part of the immutable audit trail.
export async function approveProcedure(id: string, approvedBy: string, changeNote = ''): Promise<Procedure | null> {
  const existing = await getProcedure(id);
  if (!existing) return null;
  const now = new Date().toISOString();
  const approved: Procedure = { ...existing, status: 'approved', approvedBy, approvedAt: now };
  await upsertProcedure(approved, approvedBy, changeNote || `Approved v${approved.version}`);
  return getProcedure(id);
}

export async function retireProcedure(id: string, changedBy: string): Promise<Procedure | null> {
  const existing = await getProcedure(id);
  if (!existing) return null;
  await upsertProcedure({ ...existing, status: 'retired', active: false }, changedBy, 'Retired');
  return getProcedure(id);
}

export async function getProcedureRevisions(procedureId: string): Promise<ProcedureRevision[]> {
  const rs = await (await getDb()).execute({ sql: 'SELECT * FROM procedure_revisions WHERE procedure_id = ? ORDER BY revision_no DESC', args: [procedureId] });
  return (rs.rows as unknown as Record<string, unknown>[]).map(rowToProcedureRevision);
}

export async function deleteProcedure(id: string): Promise<void> {
  const db = await getDb();
  await db.execute({ sql: 'DELETE FROM procedure_steps WHERE procedure_id = ?', args: [id] });
  await db.execute({ sql: 'DELETE FROM procedure_revisions WHERE procedure_id = ?', args: [id] });
  await db.execute({ sql: 'DELETE FROM procedures WHERE id = ?', args: [id] });
}

function rowToChecklistItem(r: Record<string, unknown>): WoChecklistItem {
  return {
    id: r.id as number,
    workOrderId: r.work_order_id as string,
    procedureId: (r.procedure_id as string) || '',
    sourceVersion: (r.source_version as string) || '',
    stepOrder: r.step_order as number,
    instruction: r.instruction as string,
    expectedResult: (r.expected_result as string) || '',
    responseType: (r.response_type as ProcedureResponseType) || 'checkbox',
    unit: (r.unit as string) || '',
    safetyNote: (r.safety_note as string) || '',
    completed: !!(r.completed as number),
    resultValue: (r.result_value as string) || '',
    resultStatus: ((r.result_status as string) || '') as WoChecklistItem['resultStatus'],
    followUpWoId: (r.follow_up_wo_id as string) || '',
    notes: (r.notes as string) || '',
    completedBy: (r.completed_by as string) || '',
    completedAt: (r.completed_at as string) || '',
  };
}

export async function getWoChecklist(workOrderId: string): Promise<WoChecklistItem[]> {
  const rs = await (await getDb()).execute({ sql: 'SELECT * FROM wo_checklist_items WHERE work_order_id = ? ORDER BY step_order, id', args: [workOrderId] });
  return (rs.rows as unknown as Record<string, unknown>[]).map(rowToChecklistItem);
}

export async function applyProcedureToWorkOrder(workOrderId: string, procedureId: string, username: string): Promise<WoChecklistItem[]> {
  const db = await getDb();
  // The approved/active gate belongs in the data layer, not only the route: a
  // PM-generated work order applies a procedure straight from
  // pm_schedules.procedure_id, so without this a draft, retired, or inactive
  // SOP would have its steps copied onto the work order.
  const procRs = await db.execute({ sql: 'SELECT version, status, active FROM procedures WHERE id = ?', args: [procedureId] });
  const procRow = procRs.rows[0] as unknown as { version: string; status: string; active: number } | undefined;
  if (!procRow || procRow.status !== 'approved' || !procRow.active) return getWoChecklist(workOrderId);
  const sourceVersion = procRow.version || '';
  const steps = await db.execute({ sql: 'SELECT * FROM procedure_steps WHERE procedure_id = ? ORDER BY step_order, id', args: [procedureId] });
  const maxRs = await db.execute({ sql: 'SELECT COALESCE(MAX(step_order),0) as m FROM wo_checklist_items WHERE work_order_id = ?', args: [workOrderId] });
  let order = Number((maxRs.rows[0] as unknown as { m: number }).m);
  for (const raw of steps.rows) {
    const s = raw as unknown as { instruction: string; expected_result: string; response_type: string; unit: string; safety_note: string };
    order += 1;
    await db.execute({
      sql: `INSERT INTO wo_checklist_items (work_order_id,procedure_id,source_version,step_order,instruction,expected_result,response_type,unit,safety_note)
        VALUES (?,?,?,?,?,?,?,?,?)`,
      args: [workOrderId, procedureId, sourceVersion, order, s.instruction, s.expected_result || '', s.response_type || 'checkbox', s.unit || '', s.safety_note || ''],
    });
  }
  void username;
  return getWoChecklist(workOrderId);
}

// Completion gate: a work order carrying a checklist cannot be closed while
// steps are outstanding, or while a failed step has no corrective work order.
// Returns the blocking reasons (empty array means the transition is allowed).
export async function getCompletionBlockers(workOrderId: string): Promise<string[]> {
  const items = await getWoChecklist(workOrderId);
  if (items.length === 0) return [];
  const incomplete = items.filter(i => !i.completed);
  const failed = items.filter(i => i.resultStatus === 'fail' && !i.followUpWoId);
  const blockers: string[] = [];
  if (incomplete.length > 0) blockers.push(`${incomplete.length} checklist step(s) not yet completed`);
  if (failed.length > 0) blockers.push(`${failed.length} failed step(s) with no follow-up work order`);
  return blockers;
}

// Raise a corrective work order from a failed checklist step and link it back so
// the failure is traceable and the completion gate can be satisfied.
export async function createFollowUpWorkOrder(checklistItemId: number, username: string): Promise<string | null> {
  const db = await getDb();
  const rs = await db.execute({ sql: 'SELECT * FROM wo_checklist_items WHERE id = ?', args: [checklistItemId] });
  const item = rs.rows[0] as unknown as Record<string, unknown> | undefined;
  if (!item) return null;
  const existing = (item.follow_up_wo_id as string) || '';
  if (existing) return existing;
  const parentRs = await db.execute({ sql: 'SELECT * FROM work_orders WHERE id = ?', args: [item.work_order_id as string] });
  const parent = parentRs.rows[0] as unknown as Record<string, unknown> | undefined;
  const woId = 'WO-' + Date.now().toString(36).toUpperCase();
  const now = new Date().toISOString();
  const instruction = (item.instruction as string) || 'Checklist step';
  // asset_id is a foreign key to assets(id). An empty string is NOT null, so it
  // fails the FK check when the parent work order is asset-less — which made
  // this endpoint 500 for every site-level work order. Persist NULL instead.
  const parentAssetId = (parent?.asset_id as string) || null;
  await db.execute({
    sql: `INSERT INTO work_orders (id, asset_id, title, description, type, priority, status, assigned_to, requested_by, due_date, created_at, updated_at)
      VALUES (?,?,?,?,'corrective','high','open',?,?,?,?,?)`,
    args: [
      woId,
      parentAssetId,
      `Follow-up: ${instruction}`.slice(0, 120),
      `Raised from failed checklist step on ${item.work_order_id as string}. Result: ${(item.result_value as string) || 'n/a'}${item.notes ? ` — ${item.notes as string}` : ''}`,
      (parent?.assigned_to as string) || '',
      username || 'Checklist',
      now.slice(0, 10),
      now,
      now,
    ],
  });
  await db.execute({ sql: 'UPDATE wo_checklist_items SET follow_up_wo_id = ? WHERE id = ?', args: [woId, checklistItemId] });
  return woId;
}

export async function updateWoChecklistItem(item: { id: number; completed: boolean; resultValue: string; resultStatus: string; notes: string; completedBy: string }): Promise<void> {
  const status = ['pass', 'fail', 'na'].includes(item.resultStatus) ? item.resultStatus : '';
  await (await getDb()).execute({
    sql: `UPDATE wo_checklist_items
      SET completed = ?, result_value = ?, result_status = ?, notes = ?,
          completed_by = CASE WHEN ? = 1 THEN ? ELSE '' END,
          completed_at = CASE WHEN ? = 1 THEN datetime('now') ELSE '' END
      WHERE id = ?`,
    args: [item.completed ? 1 : 0, item.resultValue || '', status, item.notes || '', item.completed ? 1 : 0, item.completedBy || '', item.completed ? 1 : 0, item.id],
  });
}

export async function deleteWoChecklistItem(id: number): Promise<void> {
  await (await getDb()).execute({ sql: 'DELETE FROM wo_checklist_items WHERE id = ?', args: [id] });
}

export async function deleteComplianceObligation(id: string): Promise<void> { await (await getDb()).execute({ sql: 'DELETE FROM compliance_obligations WHERE id = ?', args: [id] }); }
export async function deleteInspection(id: string): Promise<void> { await (await getDb()).execute({ sql: 'DELETE FROM inspections WHERE id = ?', args: [id] }); }
export async function deleteDocument(id: string): Promise<void> { await (await getDb()).execute({ sql: 'DELETE FROM documents WHERE id = ?', args: [id] }); }
export async function deleteSafetyPermit(id: string): Promise<void> { await (await getDb()).execute({ sql: 'DELETE FROM safety_permits WHERE id = ?', args: [id] }); }
export async function deleteTestingRecord(id: string): Promise<void> { await (await getDb()).execute({ sql: 'DELETE FROM testing_records WHERE id = ?', args: [id] }); }
export async function deleteRootCauseAnalysis(id: string): Promise<void> { await (await getDb()).execute({ sql: 'DELETE FROM root_cause_analyses WHERE id = ?', args: [id] }); }
