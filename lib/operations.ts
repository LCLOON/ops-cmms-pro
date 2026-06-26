import { getDb } from './db';
import bcryptjs from 'bcryptjs';
import type { Asset, WorkOrder, PmSchedule, InventoryItem, SiteConfig, DbUser } from './types';

// ─── Helpers ───────────────────────────────────────────────────
function uid(): string {
  return 'OC-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
}

function nowIso(): string { return new Date().toISOString(); }

// ─── Seed ──────────────────────────────────────────────────────
const SEED_ASSETS: Asset[] = [
  { id: 'AST-001', name: 'Chiller Unit #1', category: 'hvac', location: 'Mechanical Room A', department: 'Facilities', manufacturer: 'Carrier', model: '30XA-100', serialNumber: 'CR-2020-001', installDate: '2020-03-15', warrantyExpiry: '2025-03-15', status: 'operational', criticality: 'critical', notes: 'Primary building chiller', createdAt: nowIso(), updatedAt: nowIso() },
  { id: 'AST-002', name: 'Air Compressor #2', category: 'mechanical', location: 'Compressor Room', department: 'Production', manufacturer: 'Ingersoll Rand', model: 'IR-75', serialNumber: 'IR-2019-042', installDate: '2019-06-01', warrantyExpiry: '2024-06-01', status: 'operational', criticality: 'high', notes: 'Shop air supply', createdAt: nowIso(), updatedAt: nowIso() },
  { id: 'AST-003', name: 'Main Electrical Panel', category: 'electrical', location: 'Electrical Room', department: 'Facilities', manufacturer: 'Square D', model: 'NF-400', serialNumber: 'SD-2021-007', installDate: '2021-01-10', warrantyExpiry: '2026-01-10', status: 'operational', criticality: 'critical', notes: '400A main distribution panel', createdAt: nowIso(), updatedAt: nowIso() },
  { id: 'AST-004', name: 'Fire Pump', category: 'safety', location: 'Pump House', department: 'Safety', manufacturer: 'Grundfos', model: 'CR-64', serialNumber: 'GF-2018-113', installDate: '2018-11-20', warrantyExpiry: '2023-11-20', status: 'operational', criticality: 'critical', notes: 'Sprinkler system fire pump', createdAt: nowIso(), updatedAt: nowIso() },
  { id: 'AST-005', name: 'Forklift #3', category: 'vehicle', location: 'Warehouse B', department: 'Logistics', manufacturer: 'Toyota', model: '8FGU25', serialNumber: 'TY-2022-033', installDate: '2022-05-10', warrantyExpiry: '2025-05-10', status: 'operational', criticality: 'medium', notes: 'Electric forklift', createdAt: nowIso(), updatedAt: nowIso() },
];

const SEED_WORK_ORDERS: WorkOrder[] = [
  { id: 'WO-001', assetId: 'AST-001', title: 'Chiller refrigerant leak repair', description: 'Found refrigerant leak at compressor seal', type: 'corrective', priority: 'high', status: 'in_progress', assignedTo: 'Technician', requestedBy: 'Manager', dueDate: '2026-06-30', completedDate: '', laborHours: 4, partsCost: 350, resolution: '', createdAt: nowIso(), updatedAt: nowIso() },
  { id: 'WO-002', assetId: 'AST-004', title: 'Annual fire pump test', description: 'NFPA 25 annual flow test', type: 'inspection', priority: 'medium', status: 'open', assignedTo: '', requestedBy: 'Safety Officer', dueDate: '2026-07-15', completedDate: '', laborHours: 2, partsCost: 0, resolution: '', createdAt: nowIso(), updatedAt: nowIso() },
  { id: 'WO-003', assetId: 'AST-002', title: 'Air compressor oil change', description: 'Scheduled 2000hr oil change', type: 'preventive', priority: 'low', status: 'completed', assignedTo: 'Technician', requestedBy: 'PM Schedule', dueDate: '2026-06-20', completedDate: '2026-06-19', laborHours: 1.5, partsCost: 85, resolution: 'Oil and filters changed', createdAt: nowIso(), updatedAt: nowIso() },
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
      VALUES (1, 'OpsCMMSPro Demo Facility', 'Main Operations Campus', '2000 Industrial Parkway, Suite 100, Chicago, IL 60601', 'Sarah Chen', 'schen@opscmmspro-demo.com', '(312) 555-0187', 1)`).run();

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
    const insAsset = db.prepare(`INSERT INTO assets (id,name,category,location,department,manufacturer,model,serial_number,install_date,warranty_expiry,status,criticality,notes,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    for (const a of SEED_ASSETS) insAsset.run(a.id, a.name, a.category, a.location, a.department, a.manufacturer, a.model, a.serialNumber, a.installDate, a.warrantyExpiry, a.status, a.criticality, a.notes, a.createdAt, a.updatedAt);

    // Work Orders
    const insWO = db.prepare(`INSERT INTO work_orders (id,asset_id,title,description,type,priority,status,assigned_to,requested_by,due_date,completed_date,labor_hours,parts_cost,resolution,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    for (const w of SEED_WORK_ORDERS) insWO.run(w.id, w.assetId, w.title, w.description, w.type, w.priority, w.status, w.assignedTo, w.requestedBy, w.dueDate, w.completedDate, w.laborHours, w.partsCost, w.resolution, w.createdAt, w.updatedAt);

    // PM Schedules
    const insPM = db.prepare(`INSERT INTO pm_schedules (id,asset_id,title,description,frequency_type,frequency_value,last_completed,next_due,assigned_to,estimated_hours,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    for (const p of SEED_PM_SCHEDULES) insPM.run(p.id, p.assetId, p.title, p.description, p.frequencyType, p.frequencyValue, p.lastCompleted, p.nextDue, p.assignedTo, p.estimatedHours, p.active ? 1 : 0, p.createdAt, p.updatedAt);

    // Inventory
    const insInv = db.prepare(`INSERT INTO inventory (id,name,part_number,category,quantity_on_hand,min_quantity,unit_cost,supplier,location,notes,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
    for (const i of SEED_INVENTORY) insInv.run(i.id, i.name, i.partNumber, i.category, i.quantityOnHand, i.minQuantity, i.unitCost, i.supplier, i.location, i.notes, i.createdAt, i.updatedAt);
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

// ─── Assets ────────────────────────────────────────────────────
function rowToAsset(r: Record<string, unknown>): Asset {
  return {
    id: r.id as string, name: r.name as string, category: r.category as Asset['category'],
    location: r.location as string, department: r.department as string, manufacturer: r.manufacturer as string,
    model: r.model as string, serialNumber: r.serial_number as string, installDate: r.install_date as string,
    warrantyExpiry: r.warranty_expiry as string, status: r.status as Asset['status'],
    criticality: r.criticality as Asset['criticality'], notes: r.notes as string,
    createdAt: r.created_at as string, updatedAt: r.updated_at as string,
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
  db.prepare(`INSERT INTO assets (id,name,category,location,department,manufacturer,model,serial_number,install_date,warranty_expiry,status,criticality,notes,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))
    ON CONFLICT(id) DO UPDATE SET name=excluded.name,category=excluded.category,location=excluded.location,department=excluded.department,manufacturer=excluded.manufacturer,model=excluded.model,serial_number=excluded.serial_number,install_date=excluded.install_date,warranty_expiry=excluded.warranty_expiry,status=excluded.status,criticality=excluded.criticality,notes=excluded.notes,updated_at=excluded.updated_at`)
    .run(asset.id, asset.name, asset.category, asset.location, asset.department, asset.manufacturer, asset.model, asset.serialNumber, asset.installDate, asset.warrantyExpiry, asset.status, asset.criticality, asset.notes);
}

export function deleteAsset(id: string): void {
  getDb().prepare('DELETE FROM assets WHERE id = ?').run(id);
}

// ─── Work Orders ───────────────────────────────────────────────
function rowToWorkOrder(r: Record<string, unknown>): WorkOrder {
  return {
    id: r.id as string, assetId: r.asset_id as string, title: r.title as string,
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

export function getWorkOrdersByAsset(assetId: string): WorkOrder[] {
  return (getDb().prepare('SELECT * FROM work_orders WHERE asset_id = ? ORDER BY created_at DESC').all(assetId) as Record<string, unknown>[]).map(rowToWorkOrder);
}

export function upsertWorkOrder(wo: WorkOrder): void {
  const db = getDb();
  db.prepare(`INSERT INTO work_orders (id,asset_id,title,description,type,priority,status,assigned_to,requested_by,due_date,completed_date,labor_hours,parts_cost,resolution,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))
    ON CONFLICT(id) DO UPDATE SET asset_id=excluded.asset_id,title=excluded.title,description=excluded.description,type=excluded.type,priority=excluded.priority,status=excluded.status,assigned_to=excluded.assigned_to,requested_by=excluded.requested_by,due_date=excluded.due_date,completed_date=excluded.completed_date,labor_hours=excluded.labor_hours,parts_cost=excluded.parts_cost,resolution=excluded.resolution,updated_at=excluded.updated_at`)
    .run(wo.id, wo.assetId, wo.title, wo.description, wo.type, wo.priority, wo.status, wo.assignedTo, wo.requestedBy, wo.dueDate, wo.completedDate, wo.laborHours, wo.partsCost, wo.resolution);
}

export function deleteWorkOrder(id: string): void {
  getDb().prepare('DELETE FROM work_orders WHERE id = ?').run(id);
}

// ─── PM Schedules ──────────────────────────────────────────────
function rowToPmSchedule(r: Record<string, unknown>): PmSchedule {
  return {
    id: r.id as string, assetId: r.asset_id as string, title: r.title as string,
    description: r.description as string, frequencyType: r.frequency_type as PmSchedule['frequencyType'],
    frequencyValue: r.frequency_value as number, lastCompleted: r.last_completed as string,
    nextDue: r.next_due as string, assignedTo: r.assigned_to as string,
    estimatedHours: r.estimated_hours as number, active: !!(r.active as number),
    createdAt: r.created_at as string, updatedAt: r.updated_at as string,
  };
}

export function getPmSchedules(): PmSchedule[] {
  return (getDb().prepare('SELECT * FROM pm_schedules ORDER BY next_due').all() as Record<string, unknown>[]).map(rowToPmSchedule);
}

export function upsertPmSchedule(pm: PmSchedule): void {
  const db = getDb();
  db.prepare(`INSERT INTO pm_schedules (id,asset_id,title,description,frequency_type,frequency_value,last_completed,next_due,assigned_to,estimated_hours,active,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,datetime('now'))
    ON CONFLICT(id) DO UPDATE SET asset_id=excluded.asset_id,title=excluded.title,description=excluded.description,frequency_type=excluded.frequency_type,frequency_value=excluded.frequency_value,last_completed=excluded.last_completed,next_due=excluded.next_due,assigned_to=excluded.assigned_to,estimated_hours=excluded.estimated_hours,active=excluded.active,updated_at=excluded.updated_at`)
    .run(pm.id, pm.assetId, pm.title, pm.description, pm.frequencyType, pm.frequencyValue, pm.lastCompleted, pm.nextDue, pm.assignedTo, pm.estimatedHours, pm.active ? 1 : 0);
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
