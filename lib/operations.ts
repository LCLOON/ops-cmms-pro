import { getDb } from './db';
import bcryptjs from 'bcryptjs';
import { generateHydroAssets, generateHydroInventory } from './hydro-seed';
import { EXCEL_VENDORS } from './excel-vendors';
import type { Asset, WorkOrder, PmSchedule, InventoryItem, SiteConfig, DbUser, WoPart, WoLabor, Vendor, PurchaseOrder, PoItem, MeterReading, Site, ComplianceObligation, Inspection, Document, SafetyPermit, ElectricalTest } from './types';

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

export function seedDatabase(): void {
  const db = getDb();
  const count = (db.prepare('SELECT COUNT(*) as cnt FROM assets').get() as { cnt: number }).cnt;
  if (count > 0) return;

  db.transaction(() => {
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
    if (!(process.env.VERCEL || process.env.NODE_ENV === 'production')) {
      db.prepare('UPDATE users SET force_password_change = 1 WHERE username IN (?, ?, ?, ?)').run('admin', 'manager', 'tech', 'viewer');
    }

    // Assets
    const insAsset = db.prepare(`INSERT INTO assets (id,name,category,location,department,manufacturer,model,serial_number,install_date,warranty_expiry,status,criticality,notes,parent_id,area,system,replacement_cost,failure_mode,is_component,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    for (const a of SEED_ASSETS) insAsset.run(a.id, a.name, a.category, a.location, a.department, a.manufacturer, a.model, a.serialNumber, a.installDate, a.warrantyExpiry, a.status, a.criticality, a.notes, a.parentId, '', '', 0, '', 0, a.createdAt, a.updatedAt);

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
      insAsset.run(a.assetId, a.name, a.category, a.location, a.department, a.manufacturer, a.model, a.serialNumber, a.installDate, '', a.status, a.criticality, '', a.parentId, a.area, a.system, 0, '', 0, nowIso(), nowIso());
    }

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
  })();
}

// ─── Users ─────────────────────────────────────────────────────
export function getUserByUsername(username: string): DbUser | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM users WHERE username = ? AND active = 1').get(username);
  return row ? (row as DbUser) : null;
}

export function updateLastLogin(userId: number): void {
  getDb().prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").run(userId);
}

export function getUsers(): DbUser[] {
  return getDb().prepare('SELECT * FROM users ORDER BY role, username').all() as DbUser[];
}

export function upsertUser(u: { id?: number; username: string; display_name: string; role: string; active: number; password?: string; force_password_change?: number }): void {
  const db = getDb();
  if (u.password) {
    db.prepare(`INSERT INTO users (username, password_hash, display_name, role, active, force_password_change) VALUES (?,?,?,?,?,?)
      ON CONFLICT(username) DO UPDATE SET display_name=excluded.display_name, role=excluded.role, active=excluded.active, 
      force_password_change=COALESCE(excluded.force_password_change,users.force_password_change), 
      password_hash=excluded.password_hash, updated_at=datetime('now')`)
      .run(u.username, bcryptjs.hashSync(u.password, 12), u.display_name, u.role, u.active, u.force_password_change ?? 0);
  } else {
    db.prepare(`INSERT INTO users (username, password_hash, display_name, role, active, force_password_change) VALUES (?,?,?,?,?,?)
      ON CONFLICT(username) DO UPDATE SET display_name=excluded.display_name, role=excluded.role, active=excluded.active, 
      force_password_change=COALESCE(excluded.force_password_change,users.force_password_change), 
      updated_at=datetime('now')`)
      .run(u.username, '', u.display_name, u.role, u.active, u.force_password_change ?? 0);
  }
}

export function deleteUser(id: number): void {
  getDb().prepare('DELETE FROM users WHERE id = ?').run(id);
}

// ─── Assets ────────────────────────────────────────────────────
function rowToAsset(r: Record<string, unknown>): Asset {
  return {
    id: r.id as string, name: r.name as string, category: r.category as Asset['category'],
    location: r.location as string, department: r.department as string, manufacturer: r.manufacturer as string,
    model: r.model as string, serialNumber: r.serial_number as string, installDate: r.install_date as string,
    warrantyExpiry: r.warranty_expiry as string, status: r.status as Asset['status'],
    criticality: r.criticality as Asset['criticality'], notes: r.notes as string,
    parentId: (r.parent_id as string) || '', createdAt: r.created_at as string, updatedAt: r.updated_at as string,
    replacementCost: (r.replacement_cost as number) || 0, failureMode: (r.failure_mode as string) || '', isComponent: !!(r.is_component),
  };
}

export function getAssets(): Asset[] {
  return (getDb().prepare('SELECT * FROM assets ORDER BY name').all() as Record<string, unknown>[]).map(rowToAsset);
}

export function getAsset(id: string): Asset | null {
  const row = getDb().prepare('SELECT * FROM assets WHERE id = ?').get(id);
  return row ? rowToAsset(row as Record<string, unknown>) : null;
}

export function upsertAsset(asset: Asset): void {
  const db = getDb();
  db.prepare(`INSERT INTO assets (id,name,category,location,department,manufacturer,model,serial_number,install_date,warranty_expiry,status,criticality,notes,parent_id,area,system,replacement_cost,failure_mode,is_component,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))
    ON CONFLICT(id) DO UPDATE SET name=excluded.name,category=excluded.category,location=excluded.location,department=excluded.department,manufacturer=excluded.manufacturer,model=excluded.model,serial_number=excluded.serial_number,install_date=excluded.install_date,warranty_expiry=excluded.warranty_expiry,status=excluded.status,criticality=excluded.criticality,notes=excluded.notes,parent_id=excluded.parent_id,area=excluded.area,system=excluded.system,replacement_cost=excluded.replacement_cost,failure_mode=excluded.failure_mode,is_component=excluded.is_component,updated_at=excluded.updated_at`)
    .run(asset.id, asset.name, asset.category, asset.location, asset.department, asset.manufacturer, asset.model, asset.serialNumber, asset.installDate, asset.warrantyExpiry, asset.status, asset.criticality, asset.notes, asset.parentId || '', asset.area || '', asset.system || '', asset.replacementCost ?? 0, asset.failureMode ?? '', asset.isComponent ? 1 : 0);
}

export function deleteAsset(id: string): void {
  getDb().prepare('DELETE FROM assets WHERE id = ?').run(id);
}

// ─── Work Orders ───────────────────────────────────────────────
function rowToWorkOrder(r: Record<string, unknown>): WorkOrder {
  return {
    id: r.id as string, assetId: (r.asset_id ?? '') as string, title: r.title as string,
    description: r.description as string, type: r.type as WorkOrder['type'],
    priority: r.priority as WorkOrder['priority'], status: r.status as WorkOrder['status'],
    assignedTo: r.assigned_to as string, requestedBy: r.requested_by as string,
    dueDate: r.due_date as string, completedDate: r.completed_date as string,
    laborHours: r.labor_hours as number, partsCost: r.parts_cost as number,
    resolution: r.resolution as string, createdAt: r.created_at as string, updatedAt: r.updated_at as string,
  };
}

export function getWorkOrders(): WorkOrder[] {
  return (getDb().prepare('SELECT * FROM work_orders ORDER BY created_at DESC').all() as Record<string, unknown>[]).map(rowToWorkOrder);
}

export function getWorkOrder(id: string): WorkOrder | null {
  const row = getDb().prepare('SELECT * FROM work_orders WHERE id = ?').get(id);
  return row ? rowToWorkOrder(row as Record<string, unknown>) : null;
}

export function getWorkOrdersByAsset(assetId: string): WorkOrder[] {
  return (getDb().prepare('SELECT * FROM work_orders WHERE asset_id = ? ORDER BY created_at DESC').all(assetId) as Record<string, unknown>[]).map(rowToWorkOrder);
}

export function upsertWorkOrder(wo: WorkOrder): void {
  const db = getDb();
  db.prepare(`INSERT INTO work_orders (id,asset_id,title,description,type,priority,status,assigned_to,requested_by,due_date,completed_date,labor_hours,parts_cost,resolution,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))
    ON CONFLICT(id) DO UPDATE SET asset_id=excluded.asset_id,title=excluded.title,description=excluded.description,type=excluded.type,priority=excluded.priority,status=excluded.status,assigned_to=excluded.assigned_to,requested_by=excluded.requested_by,due_date=excluded.due_date,completed_date=excluded.completed_date,resolution=excluded.resolution,updated_at=excluded.updated_at`)
    .run(wo.id, wo.assetId || null, wo.title, wo.description, wo.type, wo.priority, wo.status, wo.assignedTo, wo.requestedBy, wo.dueDate, wo.completedDate, wo.laborHours, wo.partsCost, wo.resolution);
}

export function deleteWorkOrder(id: string): void {
  getDb().prepare('DELETE FROM work_orders WHERE id = ?').run(id);
}

// ─── PM Schedules ──────────────────────────────────────────────
function rowToPmSchedule(r: Record<string, unknown>): PmSchedule {
  return {
    id: r.id as string, assetId: (r.asset_id ?? '') as string, title: r.title as string,
    description: r.description as string, frequencyType: r.frequency_type as PmSchedule['frequencyType'],
    frequencyValue: r.frequency_value as number, lastCompleted: r.last_completed as string,
    nextDue: r.next_due as string, assignedTo: r.assigned_to as string,
    estimatedHours: r.estimated_hours as number, active: !!(r.active as number),
    createdAt: r.created_at as string, updatedAt: r.updated_at as string,
  };
}

export function getPmSchedules(): PmSchedule[] {
  return (getDb().prepare(`
    SELECT pm.*, a.name as asset_name,
      COALESCE(s.name, p.name) as site_name
    FROM pm_schedules pm
    LEFT JOIN assets a ON pm.asset_id = a.id
    LEFT JOIN sites s ON a.parent_id = s.id
    LEFT JOIN assets p ON a.parent_id = p.id AND p.is_component = 0
    ORDER BY pm.next_due
  `).all() as Record<string, unknown>[]).map(r => ({
    ...rowToPmSchedule(r as Record<string, unknown>),
    assetName: (r.asset_name as string) || '',
    siteName: (r.site_name as string) || '',
  }));
}

export function upsertPmSchedule(pm: PmSchedule): void {
  const db = getDb();
  db.prepare(`INSERT INTO pm_schedules (id,asset_id,title,description,frequency_type,frequency_value,last_completed,next_due,assigned_to,estimated_hours,active,deferral_reason,deferral_approved_by,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))
    ON CONFLICT(id) DO UPDATE SET asset_id=excluded.asset_id,title=excluded.title,description=excluded.description,frequency_type=excluded.frequency_type,frequency_value=excluded.frequency_value,last_completed=excluded.last_completed,next_due=excluded.next_due,assigned_to=excluded.assigned_to,estimated_hours=excluded.estimated_hours,active=excluded.active,deferral_reason=excluded.deferral_reason,deferral_approved_by=excluded.deferral_approved_by,updated_at=excluded.updated_at`)
    .run(pm.id, pm.assetId || null, pm.title, pm.description, pm.frequencyType, pm.frequencyValue, pm.lastCompleted, pm.nextDue, pm.assignedTo, pm.estimatedHours, pm.active ? 1 : 0, pm.deferralReason || '', pm.deferralApprovedBy || '');
}

export function deletePmSchedule(id: string): void {
  getDb().prepare('DELETE FROM pm_schedules WHERE id = ?').run(id);
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

export function getInventory(): InventoryItem[] {
  return (getDb().prepare('SELECT * FROM inventory ORDER BY name').all() as Record<string, unknown>[]).map(rowToInventoryItem);
}

export function upsertInventoryItem(item: InventoryItem): void {
  const db = getDb();
  db.prepare(`INSERT INTO inventory (id,name,part_number,category,quantity_on_hand,min_quantity,unit_cost,supplier,location,notes,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,datetime('now'))
    ON CONFLICT(id) DO UPDATE SET name=excluded.name,part_number=excluded.part_number,category=excluded.category,quantity_on_hand=excluded.quantity_on_hand,min_quantity=excluded.min_quantity,unit_cost=excluded.unit_cost,supplier=excluded.supplier,location=excluded.location,notes=excluded.notes,updated_at=excluded.updated_at`)
    .run(item.id, item.name, item.partNumber, item.category, item.quantityOnHand, item.minQuantity, item.unitCost, item.supplier, item.location, item.notes);
}

export function deleteInventoryItem(id: string): void {
  getDb().prepare('DELETE FROM inventory WHERE id = ?').run(id);
}

// ─── Config ────────────────────────────────────────────────────
export function getSiteConfig(): SiteConfig {
  const row = getDb().prepare('SELECT * FROM site_config WHERE id = 1').get() as Record<string, unknown> | undefined;
  if (!row) return { companyName: '', siteName: '', siteAddress: '', managerName: '', managerEmail: '', managerPhone: '', setupComplete: false };
  return {
    companyName: row.company_name as string, siteName: row.site_name as string,
    siteAddress: row.site_address as string, managerName: row.manager_name as string,
    managerEmail: row.manager_email as string, managerPhone: row.manager_phone as string,
    setupComplete: !!(row.setup_complete as number),
  };
}

// ─── Dashboard Stats ───────────────────────────────────────────
export function getDashboardStats() {
  const db = getDb();
  return {
    totalAssets: (db.prepare('SELECT COUNT(*) as cnt FROM assets').get() as { cnt: number }).cnt,
    openWorkOrders: (db.prepare("SELECT COUNT(*) as cnt FROM work_orders WHERE status IN ('open','in_progress')").get() as { cnt: number }).cnt,
    overduePMs: (db.prepare("SELECT COUNT(*) as cnt FROM pm_schedules WHERE next_due < date('now') AND active = 1").get() as { cnt: number }).cnt,
    downAssets: (db.prepare("SELECT COUNT(*) as cnt FROM assets WHERE status = 'down'").get() as { cnt: number }).cnt,
    lowStock: (db.prepare('SELECT COUNT(*) as cnt FROM inventory WHERE quantity_on_hand <= min_quantity').get() as { cnt: number }).cnt,
    completedThisMonth: (db.prepare("SELECT COUNT(*) as cnt FROM work_orders WHERE status = 'completed' AND completed_date >= date('now','start of month')").get() as { cnt: number }).cnt,
  };
}

// ─── WO Parts ──────────────────────────────────────────────────
export function getWoParts(workOrderId: string): WoPart[] {
  return (getDb().prepare(`
    SELECT wp.*, i.name as inventory_name, i.part_number
    FROM wo_parts wp LEFT JOIN inventory i ON wp.inventory_item_id = i.id
    WHERE wp.work_order_id = ? ORDER BY wp.id
  `).all(workOrderId) as Record<string, unknown>[]).map(r => ({
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

export function addWoPart(part: { workOrderId: string; inventoryItemId: string; quantity: number; unitCost: number }): WoPart {
  const db = getDb();
  const result = db.prepare('INSERT INTO wo_parts (work_order_id, inventory_item_id, quantity, unit_cost) VALUES (?,?,?,?)').run(part.workOrderId, part.inventoryItemId, part.quantity, part.unitCost);
  // Update work order parts_cost
  const total = (db.prepare('SELECT COALESCE(SUM(quantity * unit_cost),0) as t FROM wo_parts WHERE work_order_id = ?').get(part.workOrderId) as { t: number }).t;
  db.prepare('UPDATE work_orders SET parts_cost = ? WHERE id = ?').run(total, part.workOrderId);
  return getWoParts(part.workOrderId).find(p => p.id === Number(result.lastInsertRowid))!;
}

export function deleteWoPart(id: number): void {
  const row = getDb().prepare('SELECT work_order_id FROM wo_parts WHERE id = ?').get(id) as { work_order_id: string } | undefined;
  if (!row) return;
  const db = getDb();
  db.prepare('DELETE FROM wo_parts WHERE id = ?').run(id);
  const total = (db.prepare('SELECT COALESCE(SUM(quantity * unit_cost),0) as t FROM wo_parts WHERE work_order_id = ?').get(row.work_order_id) as { t: number }).t;
  db.prepare('UPDATE work_orders SET parts_cost = ? WHERE id = ?').run(total, row.work_order_id);
}

// ─── WO Labor ──────────────────────────────────────────────────
export function getWoLabor(workOrderId: string): WoLabor[] {
  return (getDb().prepare('SELECT * FROM wo_labor WHERE work_order_id = ? ORDER BY id').all(workOrderId) as Record<string, unknown>[]).map(r => ({
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

export function addWoLabor(entry: { workOrderId: string; userId: number; username: string; hours: number; loggedDate: string; notes: string }): WoLabor {
  const db = getDb();
  const result = db.prepare('INSERT INTO wo_labor (work_order_id, user_id, username, hours, logged_date, notes) VALUES (?,?,?,?,?,?)').run(entry.workOrderId, entry.userId, entry.username, entry.hours, entry.loggedDate, entry.notes);
  const total = (db.prepare('SELECT COALESCE(SUM(hours),0) as t FROM wo_labor WHERE work_order_id = ?').get(entry.workOrderId) as { t: number }).t;
  db.prepare('UPDATE work_orders SET labor_hours = ? WHERE id = ?').run(total, entry.workOrderId);
  return { id: Number(result.lastInsertRowid), ...entry, createdAt: new Date().toISOString() };
}

export function deleteWoLabor(id: number): void {
  const row = getDb().prepare('SELECT work_order_id FROM wo_labor WHERE id = ?').get(id) as { work_order_id: string } | undefined;
  if (!row) return;
  const db = getDb();
  db.prepare('DELETE FROM wo_labor WHERE id = ?').run(id);
  const total = (db.prepare('SELECT COALESCE(SUM(hours),0) as t FROM wo_labor WHERE work_order_id = ?').get(row.work_order_id) as { t: number }).t;
  db.prepare('UPDATE work_orders SET labor_hours = ? WHERE id = ?').run(total, row.work_order_id);
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

export function transitionWorkOrderStatus(id: string, newStatus: string): boolean {
  const wo = getDb().prepare('SELECT status FROM work_orders WHERE id = ?').get(id) as { status: string } | undefined;
  if (!wo) return false;
  const valid = VALID_TRANSITIONS[wo.status] || [];
  if (!valid.includes(newStatus)) return false;
  const now = new Date().toISOString();
  if (newStatus === 'completed') {
    getDb().prepare("UPDATE work_orders SET status = ?, completed_date = ?, updated_at = ? WHERE id = ?").run(newStatus, now, now, id);
  } else {
    getDb().prepare("UPDATE work_orders SET status = ?, updated_at = ? WHERE id = ?").run(newStatus, now, id);
  }
  return true;
}

// ─── PM → WO Generation ───────────────────────────────────────
export function generateWorkOrderFromPm(pmId: string, userId: number, username: string): string | null {
  const pm = getDb().prepare('SELECT * FROM pm_schedules WHERE id = ?').get(pmId) as Record<string, unknown> | undefined;
  if (!pm) return null;

  const woId = 'WO-' + Date.now().toString(36).toUpperCase();
  const now = new Date().toISOString();
  getDb().prepare(`INSERT INTO work_orders (id, asset_id, title, description, type, priority, status, assigned_to, requested_by, due_date, created_at, updated_at)
    VALUES (?,?,?,?,'preventive','medium','open',?,?,?,?,?)`)
    .run(woId, pm.asset_id, pm.title, pm.description || 'Generated from PM schedule', pm.assigned_to, username, pm.next_due, now, now);

  // Update PM: set last_completed = today, recalculate next_due
  const nextDue = calcNextDue(pm.frequency_type as string, pm.frequency_value as number);
  getDb().prepare("UPDATE pm_schedules SET last_completed = date('now'), next_due = ?, updated_at = ? WHERE id = ?").run(nextDue, now, pmId);

  return woId;
}

function calcNextDue(freqType: string, freqValue: number): string {
  const modifiers: Record<string, string> = {
    daily: `${freqValue} days`,
    weekly: `${freqValue * 7} days`,
    monthly: `${freqValue} months`,
    quarterly: `${freqValue * 3} months`,
    semi_annual: `${freqValue * 6} months`,
    annual: `${freqValue} years`,
  };
  const mod = modifiers[freqType] || '1 months';
  const result = getDb().prepare(`SELECT date('now', '+${mod}') as d`).get() as { d: string };
  return result.d;
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

export function getVendors(): Vendor[] {
  return (getDb().prepare('SELECT * FROM vendors ORDER BY name').all() as Record<string, unknown>[]).map(rowToVendor);
}

export function upsertVendor(v: Vendor): void {
  getDb().prepare(`INSERT INTO vendors (id,name,contact_name,email,phone,address,website,payment_terms,notes,active,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,datetime('now'))
    ON CONFLICT(id) DO UPDATE SET name=excluded.name,contact_name=excluded.contact_name,email=excluded.email,phone=excluded.phone,address=excluded.address,website=excluded.website,payment_terms=excluded.payment_terms,notes=excluded.notes,active=excluded.active,updated_at=excluded.updated_at`)
    .run(v.id, v.name, v.contactName, v.email, v.phone, v.address, v.website, v.paymentTerms, v.notes, v.active ? 1 : 0);
}

export function deleteVendor(id: string): void {
  getDb().prepare('DELETE FROM vendors WHERE id = ?').run(id);
}

// ─── Purchase Orders ───────────────────────────────────────────
export function getPurchaseOrders(): PurchaseOrder[] {
  return (getDb().prepare(`SELECT po.*, v.name as vendor_name FROM purchase_orders po LEFT JOIN vendors v ON po.vendor_id = v.id ORDER BY po.created_at DESC`).all() as Record<string, unknown>[]).map(r => ({
    id: r.id as string, vendorId: (r.vendor_id as string) || '', vendorName: (r.vendor_name as string) || '',
    poNumber: r.po_number as string, status: r.status as PurchaseOrder['status'],
    orderDate: r.order_date as string, expectedDate: r.expected_date as string,
    receivedDate: r.received_date as string, totalCost: r.total_cost as number,
    notes: r.notes as string, createdBy: r.created_by as string,
    createdAt: r.created_at as string, updatedAt: r.updated_at as string,
  }));
}

export function upsertPurchaseOrder(po: PurchaseOrder): void {
  getDb().prepare(`INSERT INTO purchase_orders (id,vendor_id,po_number,status,order_date,expected_date,received_date,total_cost,notes,created_by,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,datetime('now'))
    ON CONFLICT(id) DO UPDATE SET vendor_id=excluded.vendor_id,po_number=excluded.po_number,status=excluded.status,order_date=excluded.order_date,expected_date=excluded.expected_date,received_date=excluded.received_date,total_cost=excluded.total_cost,notes=excluded.notes,updated_at=excluded.updated_at`)
    .run(po.id, po.vendorId || null, po.poNumber, po.status, po.orderDate, po.expectedDate, po.receivedDate, po.totalCost, po.notes, po.createdBy);
}

export function deletePurchaseOrder(id: string): void {
  getDb().prepare('DELETE FROM purchase_orders WHERE id = ?').run(id);
}

export function getPoItems(poId: string): PoItem[] {
  return (getDb().prepare('SELECT * FROM po_items WHERE po_id = ? ORDER BY id').all(poId) as Record<string, unknown>[]).map(r => ({
    id: r.id as number, poId: r.po_id as string, inventoryItemId: r.inventory_item_id as string,
    itemName: r.item_name as string, quantity: r.quantity as number, unitCost: r.unit_cost as number,
    createdAt: r.created_at as string,
  }));
}

export function addPoItem(item: { poId: string; inventoryItemId: string; itemName: string; quantity: number; unitCost: number }): void {
  const db = getDb();
  db.prepare('INSERT INTO po_items (po_id, inventory_item_id, item_name, quantity, unit_cost) VALUES (?,?,?,?,?)').run(item.poId, item.inventoryItemId, item.itemName, item.quantity, item.unitCost);
  const total = (db.prepare('SELECT COALESCE(SUM(quantity * unit_cost),0) as t FROM po_items WHERE po_id = ?').get(item.poId) as { t: number }).t;
  db.prepare('UPDATE purchase_orders SET total_cost = ? WHERE id = ?').run(total, item.poId);
}

export function deletePoItem(id: number): void {
  const row = getDb().prepare('SELECT po_id FROM po_items WHERE id = ?').get(id) as { po_id: string } | undefined;
  if (!row) return;
  const db = getDb();
  db.prepare('DELETE FROM po_items WHERE id = ?').run(id);
  const total = (db.prepare('SELECT COALESCE(SUM(quantity * unit_cost),0) as t FROM po_items WHERE po_id = ?').get(row.po_id) as { t: number }).t;
  db.prepare('UPDATE purchase_orders SET total_cost = ? WHERE id = ?').run(total, row.po_id);
}

// ─── Meter Readings ────────────────────────────────────────────
export function getMeterReadings(assetId: string): MeterReading[] {
  return (getDb().prepare('SELECT * FROM meter_readings WHERE asset_id = ? ORDER BY reading_date DESC').all(assetId) as Record<string, unknown>[]).map(r => ({
    id: r.id as number, assetId: r.asset_id as string, readingType: r.reading_type as string,
    value: r.value as number, unit: r.unit as string, readingDate: r.reading_date as string,
    recordedBy: r.recorded_by as string, notes: r.notes as string, createdAt: r.created_at as string,
  }));
}

export function addMeterReading(entry: { assetId: string; readingType: string; value: number; unit: string; readingDate: string; recordedBy: string; notes: string }): MeterReading {
  const db = getDb();
  const result = db.prepare('INSERT INTO meter_readings (asset_id, reading_type, value, unit, reading_date, recorded_by, notes) VALUES (?,?,?,?,?,?,?)').run(entry.assetId, entry.readingType, entry.value, entry.unit, entry.readingDate, entry.recordedBy, entry.notes);
  return { id: Number(result.lastInsertRowid), ...entry, createdAt: new Date().toISOString() };
}

export function deleteMeterReading(id: number): void {
  getDb().prepare('DELETE FROM meter_readings WHERE id = ?').run(id);
}

// ─── Audit Trail ───────────────────────────────────────────────
export function logAudit(entry: { userId?: number; username: string; action: string; entityType: string; entityId: string; details: string; changes?: string }): void {
  getDb().prepare('INSERT INTO audit_log (user_id, username, action, entity_type, entity_id, details, changes) VALUES (?,?,?,?,?,?,?)')
    .run(entry.userId || null, entry.username, entry.action, entry.entityType, entry.entityId, entry.details, entry.changes || '');
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
  topCostAssets: { name: string; total: number }[];
  inventoryValue: { totalItems: number; totalValue: number; lowStockCount: number };
  ytdStats: { totalWOs: number; totalLaborHours: number; totalPartsCost: number; avgResolutionDays: number };
  complianceOverdue: number;
  complianceTotal: number;
  backlog: { aging: string; count: number; totalCost: number }[];
}

export function getAnalytics(): AnalyticsData {
  const db = getDb();

  // MTTR: average days between created_at and completed_date for completed WOs.
  // Clamped at 0 so backdated completions can never report negative repair time.
  const mttr = (db.prepare(`
    SELECT w.asset_id as assetId, a.name as assetName,
      ROUND(AVG(MAX(0.0, julianday(w.completed_date) - julianday(w.created_at))), 1) as mttrDays,
      COUNT(*) as workOrderCount
    FROM work_orders w JOIN assets a ON w.asset_id = a.id
    WHERE w.status = 'completed' AND w.completed_date != '' AND w.created_at != ''
    GROUP BY w.asset_id ORDER BY mttrDays DESC
  `).all() as { assetId: string; assetName: string; mttrDays: number; workOrderCount: number }[]);

  // MTBF: days between first failure and now divided by failure count
  const mtbf = (db.prepare(`
    SELECT w.asset_id as assetId, a.name as assetName,
      CAST((julianday('now') - julianday(MIN(w.created_at))) / COUNT(*) AS INTEGER) as mtbfDays,
      COUNT(*) as failureCount
    FROM work_orders w JOIN assets a ON w.asset_id = a.id
    WHERE w.type IN ('corrective','emergency') GROUP BY w.asset_id HAVING COUNT(*) > 0
    ORDER BY mtbfDays ASC
  `).all() as { assetId: string; assetName: string; mtbfDays: number; failureCount: number }[]);

  // Cost by asset
  const costByAsset = (db.prepare(`
    SELECT w.asset_id as assetId, a.name as assetName,
      COALESCE(SUM(w.labor_hours), 0) * 75 as laborCost,
      COALESCE(SUM(w.parts_cost), 0) as partsCost,
      COALESCE(SUM(w.labor_hours), 0) * 75 + COALESCE(SUM(w.parts_cost), 0) as totalCost
    FROM work_orders w JOIN assets a ON w.asset_id = a.id
    WHERE w.status = 'completed' GROUP BY w.asset_id ORDER BY totalCost DESC
  `).all() as { assetId: string; assetName: string; laborCost: number; partsCost: number; totalCost: number }[]);

  // PM Compliance
  const pmStats = db.prepare(`
    SELECT
      SUM(CASE WHEN next_due >= date('now') OR last_completed >= date('now','-7 days') THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN next_due < date('now') AND active = 1 THEN 1 ELSE 0 END) as overdue,
      COUNT(*) as total
    FROM pm_schedules WHERE active = 1
  `).get() as { completed: number; overdue: number; total: number };
  const complianceRate = pmStats.total > 0 ? Math.round((pmStats.completed / pmStats.total) * 100) : 100;

  // WO by status
  const woByStatus = (db.prepare(`SELECT status, COUNT(*) as count FROM work_orders GROUP BY status`).all() as { status: string; count: number }[]);

  // WO by type
  const woByType = (db.prepare(`SELECT type, COUNT(*) as count FROM work_orders GROUP BY type`).all() as { type: string; count: number }[]);

  // Monthly costs (last 6 months)
  const monthlyCosts = (db.prepare(`
    SELECT strftime('%Y-%m', completed_date) as month,
      COALESCE(SUM(labor_hours), 0) * 75 as labor,
      COALESCE(SUM(parts_cost), 0) as parts
    FROM work_orders WHERE status = 'completed' AND completed_date >= date('now','-6 months')
    GROUP BY month ORDER BY month
  `).all() as { month: string; labor: number; parts: number }[]);

  // Top cost assets
  const topCostAssets = (db.prepare(`
    SELECT a.name, COALESCE(SUM(w.labor_hours),0)*75 + COALESCE(SUM(w.parts_cost),0) as total
    FROM work_orders w JOIN assets a ON w.asset_id = a.id
    WHERE w.status = 'completed' GROUP BY w.asset_id ORDER BY total DESC LIMIT 5
  `).all() as { name: string; total: number }[]);

  // Inventory value
  const invStats = db.prepare(`
    SELECT COUNT(*) as totalItems, COALESCE(SUM(quantity_on_hand * unit_cost), 0) as totalValue,
      SUM(CASE WHEN quantity_on_hand <= min_quantity AND min_quantity > 0 THEN 1 ELSE 0 END) as lowStockCount
    FROM inventory
  `).get() as { totalItems: number; totalValue: number; lowStockCount: number };

  // YTD stats
  const ytdStats = db.prepare(`
    SELECT COUNT(*) as totalWOs, COALESCE(SUM(labor_hours), 0) as totalLaborHours,
      COALESCE(SUM(parts_cost), 0) as totalPartsCost,
      ROUND(AVG(CASE WHEN completed_date != '' THEN julianday(completed_date) - julianday(created_at) END), 1) as avgResolutionDays
    FROM work_orders WHERE created_at >= date('now','start of year')
  `).get() as { totalWOs: number; totalLaborHours: number; totalPartsCost: number; avgResolutionDays: number };

  // Compliance overdue count
  const compOverdue = (db.prepare(`SELECT COUNT(*) as c FROM compliance_obligations WHERE next_due < date('now') AND status IN ('open','in_progress')`).get() as { c: number }).c;
  const compTotal = (db.prepare('SELECT COUNT(*) as c FROM compliance_obligations').get() as { c: number }).c;

  return {
    mttr, mtbf, costByAsset,
    pmCompliance: { ...pmStats, complianceRate },
    woByStatus, woByType, monthlyCosts, topCostAssets,
    inventoryValue: invStats, ytdStats,
    complianceOverdue: compOverdue,
    complianceTotal: compTotal,
    backlog: getBacklogAging(),
  };
}

// ─── Sites ─────────────────────────────────────────────────────
export function getSites(): Site[] {
  return (getDb().prepare('SELECT * FROM sites ORDER BY river_mile').all() as Record<string, unknown>[]).map(r => ({
    id: r.id as string, name: r.name as string, fercNo: r.ferc_no as string,
    riverSystem: r.river_system as string, riverMile: r.river_mile as number,
    capacityMw: r.capacity_mw as string, county: r.county as string, state: r.state as string,
    operator: r.operator as string, yearBuilt: r.year_built as number,
    status: r.status as Site['status'], createdAt: r.created_at as string, updatedAt: r.updated_at as string,
  }));
}

export function upsertSite(site: Site): void {
  const db = getDb();
  db.prepare(`INSERT INTO sites (id,name,ferc_no,river_system,river_mile,capacity_mw,county,state,operator,year_built,status,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,datetime('now'))
    ON CONFLICT(id) DO UPDATE SET name=excluded.name,ferc_no=excluded.ferc_no,river_system=excluded.river_system,river_mile=excluded.river_mile,capacity_mw=excluded.capacity_mw,county=excluded.county,state=excluded.state,operator=excluded.operator,year_built=excluded.year_built,status=excluded.status,updated_at=excluded.updated_at`)
    .run(site.id, site.name, site.fercNo, site.riverSystem, site.riverMile, site.capacityMw, site.county, site.state, site.operator, site.yearBuilt, site.status);
}

// ─── Compliance Obligations ────────────────────────────────────
export function getComplianceObligations(): ComplianceObligation[] {
  return (getDb().prepare('SELECT * FROM compliance_obligations ORDER BY next_due').all() as Record<string, unknown>[]).map(r => ({
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

export function upsertComplianceObligation(o: ComplianceObligation): void {
  const db = getDb();
  db.prepare(`INSERT INTO compliance_obligations (id,site_id,obligation_type,title,description,regulation_ref,frequency,last_completed,next_due,owner_role,evidence_required,status,priority,notes,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))
    ON CONFLICT(id) DO UPDATE SET obligation_type=excluded.obligation_type,title=excluded.title,description=excluded.description,regulation_ref=excluded.regulation_ref,frequency=excluded.frequency,last_completed=excluded.last_completed,next_due=excluded.next_due,owner_role=excluded.owner_role,evidence_required=excluded.evidence_required,status=excluded.status,priority=excluded.priority,notes=excluded.notes,updated_at=excluded.updated_at`)
    .run(o.id, o.siteId || null, o.obligationType, o.title, o.description, o.regulationRef, o.frequency, o.lastCompleted, o.nextDue, o.ownerRole, o.evidenceRequired, o.status, o.priority, o.notes);
}

// ─── Inspections ───────────────────────────────────────────────
export function getInspections(): Inspection[] {
  return (getDb().prepare('SELECT * FROM inspections ORDER BY scheduled_date DESC').all() as Record<string, unknown>[]).map(r => ({
    id: r.id as string, assetId: (r.asset_id ?? '') as string,
    complianceObligationId: (r.compliance_obligation_id ?? '') as string,
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

export function upsertInspection(i: Inspection): void {
  const db = getDb();
  db.prepare(`INSERT INTO inspections (id,asset_id,compliance_obligation_id,inspection_type,title,description,scheduled_date,completed_date,inspector,findings,recommendations,corrective_actions,readings,photos,status,priority,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))
    ON CONFLICT(id) DO UPDATE SET inspection_type=excluded.inspection_type,title=excluded.title,description=excluded.description,scheduled_date=excluded.scheduled_date,completed_date=excluded.completed_date,inspector=excluded.inspector,findings=excluded.findings,recommendations=excluded.recommendations,corrective_actions=excluded.corrective_actions,readings=excluded.readings,photos=excluded.photos,status=excluded.status,priority=excluded.priority,updated_at=excluded.updated_at`)
    .run(i.id, i.assetId || null, i.complianceObligationId || null, i.inspectionType, i.title, i.description, i.scheduledDate, i.completedDate, i.inspector, i.findings, i.recommendations, i.correctiveActions, i.readings, i.photos, i.status, i.priority);
}

// ─── Documents ─────────────────────────────────────────────────
export function getDocuments(): Document[] {
  return (getDb().prepare('SELECT * FROM documents ORDER BY upload_date DESC').all() as Record<string, unknown>[]).map(r => ({
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

export function upsertDocument(d: Document): void {
  const db = getDb();
  db.prepare(`INSERT INTO documents (id,asset_id,document_type,title,description,file_path,file_url,version,uploaded_by,upload_date,review_due_date,tags,active,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))
    ON CONFLICT(id) DO UPDATE SET document_type=excluded.document_type,title=excluded.title,description=excluded.description,file_path=excluded.file_path,file_url=excluded.file_url,version=excluded.version,review_due_date=excluded.review_due_date,tags=excluded.tags,active=excluded.active,updated_at=excluded.updated_at`)
    .run(d.id, d.assetId || null, d.documentType, d.title, d.description, d.filePath, d.fileUrl, d.version, d.uploadedBy, d.uploadDate, d.reviewDueDate || '', d.tags, d.active ? 1 : 0);
}

// ─── Safety Permits ────────────────────────────────────────────
export function getSafetyPermits(): SafetyPermit[] {
  return (getDb().prepare('SELECT * FROM safety_permits ORDER BY issued_date DESC').all() as Record<string, unknown>[]).map(r => ({
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

export function upsertSafetyPermit(s: SafetyPermit): void {
  const db = getDb();
  db.prepare(`INSERT INTO safety_permits (id,work_order_id,asset_id,permit_type,permit_number,issued_by,issued_date,expiry_date,status,description,hazards,precautions,approved_by,attachments,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))
    ON CONFLICT(id) DO UPDATE SET permit_type=excluded.permit_type,status=excluded.status,issued_by=excluded.issued_by,expiry_date=excluded.expiry_date,description=excluded.description,hazards=excluded.hazards,precautions=excluded.precautions,approved_by=excluded.approved_by,attachments=excluded.attachments,updated_at=excluded.updated_at`)
    .run(s.id, s.workOrderId || null, s.assetId || null, s.permitType, s.permitNumber, s.issuedBy, s.issuedDate, s.expiryDate, s.status, s.description, s.hazards, s.precautions, s.approvedBy, s.attachments);
}

// ─── Electrical Tests ──────────────────────────────────────────
export function getElectricalTests(): ElectricalTest[] {
  return (getDb().prepare('SELECT * FROM electrical_tests ORDER BY test_date DESC').all() as Record<string, unknown>[]).map(r => ({
    id: r.id as string, assetId: (r.asset_id ?? '') as string,
    testType: r.test_type as ElectricalTest['testType'],
    testDate: r.test_date as string, results: r.results as string,
    nextDue: r.next_due as string, testedBy: r.tested_by as string,
    status: r.status as ElectricalTest['status'],
    notes: r.notes as string, createdAt: r.created_at as string, updatedAt: r.updated_at as string,
  }));
}

export function upsertElectricalTest(t: ElectricalTest): void {
  const db = getDb();
  db.prepare(`INSERT INTO electrical_tests (id,asset_id,test_type,test_date,results,next_due,tested_by,status,notes,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,datetime('now'))
    ON CONFLICT(id) DO UPDATE SET test_type=excluded.test_type,test_date=excluded.test_date,results=excluded.results,next_due=excluded.next_due,tested_by=excluded.tested_by,status=excluded.status,notes=excluded.notes,updated_at=excluded.updated_at`)
    .run(t.id, t.assetId || null, t.testType, t.testDate, t.results, t.nextDue, t.testedBy, t.status, t.notes);
}

// ─── Backlog aging (for dashboard / reports) ──────────────────
export function getBacklogAging(): { aging: string; count: number; totalCost: number }[] {
  const db = getDb();
  return db.prepare(`
    SELECT
      CASE
        WHEN julianday('now') - julianday(due_date) > 90 THEN '90+ days'
        WHEN julianday('now') - julianday(due_date) > 30 THEN '30-90 days'
        WHEN julianday('now') - julianday(due_date) > 7  THEN '7-30 days'
        WHEN julianday('now') > julianday(due_date) THEN '1-7 days'
        ELSE 'Not overdue'
      END as aging,
      COUNT(*) as count,
      COALESCE(SUM(labor_hours * 75 + parts_cost), 0) as totalCost
    FROM work_orders WHERE status NOT IN ('completed','cancelled')
    GROUP BY aging ORDER BY
      CASE aging
        WHEN '90+ days' THEN 1 WHEN '30-90 days' THEN 2
        WHEN '7-30 days' THEN 3 WHEN '1-7 days' THEN 4 ELSE 5
      END
  `).all() as { aging: string; count: number; totalCost: number }[];
}

export function deleteComplianceObligation(id: string): void { getDb().prepare('DELETE FROM compliance_obligations WHERE id = ?').run(id); }
export function deleteInspection(id: string): void { getDb().prepare('DELETE FROM inspections WHERE id = ?').run(id); }
export function deleteDocument(id: string): void { getDb().prepare('DELETE FROM documents WHERE id = ?').run(id); }
export function deleteSafetyPermit(id: string): void { getDb().prepare('DELETE FROM safety_permits WHERE id = ?').run(id); }
export function deleteElectricalTest(id: string): void { getDb().prepare('DELETE FROM electrical_tests WHERE id = ?').run(id); }
