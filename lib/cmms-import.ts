// CMMS import/conversion: maps exported rows from popular CMMS systems
// (SAP PM, IBM Maximo, Fiix, MaintainX, eMaint, Limble, UpKeep) into the
// OpsCMMSPro `Asset` shape. Each converter is a pure function so it can be
// unit-tested and reused by the import API without any UI coupling.

import type { Asset } from './types';

export type CmmsSource =
  | 'generic'
  | 'sap'
  | 'maximo'
  | 'fiix'
  | 'maintainx'
  | 'emaint'
  | 'limble'
  | 'upkeep';

export interface RawRow {
  [key: string]: string | number | null | undefined;
}

export interface ConvertedAsset {
  asset: Asset;
  warnings: string[];
}

// Field aliases per vendor, matched case-insensitively against CSV headers
// or JSON keys. The first match wins.
const ALIASES: Record<Exclude<CmmsSource, 'generic'>, Record<string, string[]>> = {
  sap: {
    name: ['description', 'asset description', 'equipment description', 'eqktx', 'text'],
    category: ['object type', 'equipment category', 'category', 'eqart'],
    location: ['location', 'main work center', 'arbpl', 'cost center'],
    department: ['planning plant', 'iwert', 'plant section'],
    manufacturer: ['manufacturer', 'herst', 'make'],
    model: ['model number', 'typbz', 'model'],
    serialNumber: ['serial number', 'serge', 'serialno'],
    installDate: ['start-up date', 'inbetriebnahme', 'installation date'],
    status: ['system status', 'status', 'objnr'],
    criticality: ['criticality', 'critically', 'priority'],
    notes: ['long text', 'notes', 'description text'],
  },
  maximo: {
    name: ['description', 'assetnum', 'asset number'],
    category: ['classid', 'classification', 'class structure'],
    location: ['location', 'siteid', 'site'],
    department: ['department', 'orgid', 'organization'],
    manufacturer: ['manufacturer', 'vendor'],
    model: ['modelnum', 'model'],
    serialNumber: ['serialnum', 'serial'],
    installDate: ['installdate', 'install date'],
    status: ['status', 'asset status'],
    criticality: ['criticality', 'priority'],
    notes: ['description_longdescription', 'long description', 'notes'],
  },
  fiix: {
    name: ['name', 'asset name', 'description'],
    category: ['category', 'asset type', 'type'],
    location: ['location', 'site', 'site name'],
    department: ['department', 'dept'],
    manufacturer: ['manufacturer', 'make'],
    model: ['model'],
    serialNumber: ['serial number', 'serial'],
    installDate: ['install date', 'date installed'],
    status: ['status', 'asset status'],
    criticality: ['criticality', 'importance', 'priority'],
    notes: ['notes', 'description', 'additional info'],
  },
  maintainx: {
    name: ['name', 'asset name', 'title'],
    category: ['category', 'asset type'],
    location: ['location', 'site'],
    department: ['department', 'team'],
    manufacturer: ['manufacturer'],
    model: ['model'],
    serialNumber: ['serial number', 'serial'],
    installDate: ['install date', 'commissioned date'],
    status: ['status'],
    criticality: ['criticality', 'priority'],
    notes: ['notes', 'description'],
  },
  emaint: {
    name: ['asset name', 'name', 'description'],
    category: ['asset type', 'category', 'class'],
    location: ['location', 'site'],
    department: ['department', 'cost center'],
    manufacturer: ['manufacturer'],
    model: ['model'],
    serialNumber: ['serial number', 'serial'],
    installDate: ['install date', 'date in service'],
    status: ['status', 'asset status'],
    criticality: ['criticality', 'criticality code'],
    notes: ['notes', 'description'],
  },
  limble: {
    name: ['name', 'asset name', 'description'],
    category: ['category', 'asset type'],
    location: ['location', 'site', 'facility'],
    department: ['department', 'team'],
    manufacturer: ['manufacturer', 'make'],
    model: ['model'],
    serialNumber: ['serial number', 'serial'],
    installDate: ['install date', 'date acquired'],
    status: ['status', 'asset status'],
    criticality: ['criticality', 'priority'],
    notes: ['notes', 'description'],
  },
  upkeep: {
    name: ['name', 'asset name', 'title', 'description'],
    category: ['category', 'asset type'],
    location: ['location', 'site', 'facility'],
    department: ['department', 'team'],
    manufacturer: ['manufacturer', 'make'],
    model: ['model'],
    serialNumber: ['serial number', 'serial'],
    installDate: ['install date', 'date acquired'],
    status: ['status', 'asset status'],
    criticality: ['criticality', 'priority'],
    notes: ['notes', 'description'],
  },
};

const CATEGORY_MAP: Record<string, Asset['category']> = {
  mechanical: 'mechanical', pump: 'mechanical', motor: 'mechanical', turbine: 'mechanical',
  generator: 'mechanical', rotating: 'mechanical', compressor: 'mechanical', gearbox: 'mechanical',
  electrical: 'electrical', transformer: 'electrical', breaker: 'electrical', relay: 'electrical',
  switchgear: 'electrical', substation: 'electrical', 'control': 'electrical', instrumentation: 'electrical',
  hvac: 'hvac', air: 'hvac', chiller: 'hvac', boiler: 'hvac', 'heating': 'hvac',
  plumbing: 'plumbing', pipe: 'plumbing', valve: 'plumbing', sewer: 'plumbing',
  structural: 'structural', civil: 'structural', dam: 'structural', building: 'structural',
  vehicle: 'vehicle', truck: 'vehicle', forklift: 'vehicle', car: 'vehicle',
  it: 'it', computer: 'it', server: 'it', network: 'it', plc: 'it', scada: 'it',
  safety: 'safety', fire: 'safety', extinguisher: 'safety',
};

const STATUS_MAP: Record<string, Asset['status']> = {
  operational: 'operational', active: 'operational', running: 'operational', up: 'operational', ok: 'operational', 'in service': 'operational', inservice: 'operational',
  down: 'down', failed: 'down', broken: 'down', out: 'down', outage: 'down', 'out of service': 'down',
  maintenance: 'maintenance', 'in maintenance': 'maintenance', 'under repair': 'maintenance', repairing: 'maintenance', pm: 'maintenance',
  retired: 'retired', decommissioned: 'retired', disposed: 'retired', scrapped: 'retired', inactive: 'retired',
};

const CRITICALITY_MAP: Record<string, Asset['criticality']> = {
  critical: 'critical', '1': 'critical', high: 'high', '2': 'high', medium: 'medium', '3': 'medium', med: 'medium', low: 'low', '4': 'low', minor: 'low',
};

function pick(row: RawRow, aliases: string[]): string {
  for (const key of Object.keys(row)) {
    const lower = key.toLowerCase().trim();
    if (aliases.some(a => lower === a)) {
      const v = row[key];
      return v === null || v === undefined ? '' : String(v).trim();
    }
  }
  return '';
}

function norm(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function mapEnum<T extends string>(value: string, map: Record<string, T>, fallback: T): T {
  const v = norm(value);
  if (!v) return fallback;
  if (map[v]) return map[v];
  // partial match: e.g. "criticality: high - a" -> "high"
  for (const key of Object.keys(map)) {
    if (v.includes(key)) return map[key];
  }
  return fallback;
}

export function convertCmmsRow(source: CmmsSource, row: RawRow, index: number, now: string): ConvertedAsset {
  const warnings: string[] = [];
  const aliases = source === 'generic' ? {} : ALIASES[source];

  const name = source === 'generic' ? pick(row, ['name', 'asset name', 'description', 'title', 'equipment']) : pick(row, aliases.name);
  if (!name) warnings.push(`Row ${index + 1}: no recognizable asset name — using "Untitled Asset ${index + 1}".`);

  const rawCategory = source === 'generic' ? pick(row, ['category', 'type', 'asset type', 'class']) : pick(row, aliases.category);
  const category = mapEnum(rawCategory, CATEGORY_MAP, 'other');

  const rawStatus = source === 'generic' ? pick(row, ['status', 'asset status']) : pick(row, aliases.status);
  const status = mapEnum(rawStatus, STATUS_MAP, 'operational');

  const rawCriticality = source === 'generic' ? pick(row, ['criticality', 'priority', 'importance']) : pick(row, aliases.criticality);
  const criticality = mapEnum(rawCriticality, CRITICALITY_MAP, 'low');

  const id = 'AST-' + Date.now().toString(36).toUpperCase() + '-' + (index + 1) + Math.random().toString(36).slice(2, 5);

  const asset: Asset = {
    id,
    name: name || `Untitled Asset ${index + 1}`,
    category,
    location: source === 'generic' ? pick(row, ['location', 'site', 'facility']) : pick(row, aliases.location),
    department: source === 'generic' ? pick(row, ['department', 'dept', 'team']) : pick(row, aliases.department),
    manufacturer: source === 'generic' ? pick(row, ['manufacturer', 'make', 'vendor']) : pick(row, aliases.manufacturer),
    model: source === 'generic' ? pick(row, ['model', 'model number']) : pick(row, aliases.model),
    serialNumber: source === 'generic' ? pick(row, ['serial number', 'serial', 'serialnumber', 'serial_no']) : pick(row, aliases.serialNumber),
    installDate: source === 'generic' ? pick(row, ['install date', 'installation date', 'date installed', 'install_date']) : pick(row, aliases.installDate),
    warrantyExpiry: pick(row, ['warranty expiry', 'warranty date', 'warrantyexpiry', 'warranty_expiry']),
    status,
    criticality,
    notes: source === 'generic' ? pick(row, ['notes', 'description', 'comments']) : pick(row, aliases.notes),
    parentId: '',
    createdAt: now,
    updatedAt: now,
  };

  return { asset, warnings };
}

// Parse delimiter-separated text (CSV/TSV) into RawRow[]. Handles quoted
// fields and a header row. Delimiter is auto-detected from the first line.
export function parseDelimited(text: string): RawRow[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n').filter(l => l.trim().length > 0);
  if (lines.length === 0) return [];

  const delimiter = detectDelimiter(lines[0]);
  const headers = splitLine(lines[0], delimiter).map(h => h.trim());
  const rows: RawRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = splitLine(lines[i], delimiter);
    const row: RawRow = {};
    headers.forEach((h, idx) => { row[h] = cells[idx] ?? ''; });
    rows.push(row);
  }
  return rows;
}

function detectDelimiter(line: string): ',' | '\t' | ';' {
  const counts: Array<readonly [',' | '\t' | ';', number]> = [
    [',', line.split(',').length - 1],
    ['\t', line.split('\t').length - 1],
    [';', line.split(';').length - 1],
  ];
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][0];
}

function splitLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === delimiter && !inQuotes) {
      out.push(cur); cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map(c => c.replace(/^"|"$/g, '').trim());
}
