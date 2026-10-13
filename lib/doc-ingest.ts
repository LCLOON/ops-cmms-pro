// Document ingestion: turns unstructured text extracted from uploaded
// documents (O&M manuals, asset registers, nameplate scans, walkdown notes,
// spreadsheets exported as text) into reviewable asset candidates so an
// operator can build out the asset registry without hand-typing every record.
//
// Two extraction strategies run and are merged:
//   1. Delimited/tabular extraction — best for exported registers and CSVs.
//   2. Line/pattern extraction — best for prose, nameplates and manuals.
//
// Nothing here writes to the database. Callers preview first, then commit.

import type { Asset } from './types';

export interface AssetCandidate {
  tempId: string;
  name: string;
  category: Asset['category'];
  location: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  installYear: string;
  criticality: Asset['criticality'];
  notes: string;
  confidence: number; // 0..1 — how strongly the source text supports this row
  evidence: string;   // the source line the candidate came from
}

export interface IngestResult {
  candidates: AssetCandidate[];
  documentType: 'register' | 'manual' | 'nameplate' | 'notes' | 'unknown';
  warnings: string[];
  stats: { linesRead: number; rowsFound: number; dropped: number };
}

const CATEGORY_RULES: Array<[RegExp, Asset['category']]> = [
  [/\b(turbine|runner|wicket|pump|compressor|gearbox|bearing|coupling|motor)\b/i, 'mechanical'],
  [/\b(generator|transformer|breaker|switchgear|relay|exciter|bus|panel|substation|rectifier)\b/i, 'electrical'],
  [/\b(hvac|chiller|boiler|air handler|ahu|furnace|ventilation)\b/i, 'hvac'],
  [/\b(valve|pipe|piping|plumbing|sump|drain|penstock)\b/i, 'plumbing'],
  [/\b(dam|spillway|gate|trashrack|trash rack|abutment|crest|forebay|tailrace|concrete|embankment)\b/i, 'structural'],
  [/\b(truck|crane|forklift|trailer|vehicle|pickup)\b/i, 'vehicle'],
  [/\b(plc|scada|hmi|server|network|router|switch|ups|rtu|historian)\b/i, 'it'],
  [/\b(fire|extinguisher|eyewash|loto|guardrail|safety)\b/i, 'safety'],
];

const MANUFACTURERS = [
  'General Electric', 'Westinghouse', 'Allis-Chalmers', 'Allis Chalmers', 'Siemens', 'ABB', 'Schneider',
  'Eaton', 'Emerson', 'Rockwell', 'Allen-Bradley', 'Allen Bradley', 'Baldor', 'WEG', 'Vulcan',
  'Sullair', 'Ingersoll Rand', 'Grundfos', 'Goulds', 'Flowserve', 'Voith', 'Andritz', 'Hydro',
];

// Fields an operator would recognize on a nameplate. Order matters: the first
// pattern that matches a line claims that line.
const FIELD_PATTERNS: Array<{ field: keyof AssetCandidate; re: RegExp }> = [
  { field: 'serialNumber', re: /\b(?:s\/?n|serial(?:\s*(?:no|number|#))?)\s*[:#-]?\s*([A-Za-z0-9][A-Za-z0-9._\-/]{2,})/i },
  { field: 'model', re: /\b(?:model(?:\s*(?:no|number|#))?|mdl|type)\s*[:#-]?\s*([A-Za-z0-9][A-Za-z0-9._\-/]{1,})/i },
  { field: 'manufacturer', re: /\b(?:mfr|manufacturer|make|built by)\s*[:#-]?\s*([A-Za-z][A-Za-z0-9 .&\-]{1,30})/i },
  { field: 'installYear', re: /\b(?:installed|install(?:ation)?\s*(?:date|year)|year built|mfg\.?\s*date)\s*[:#-]?\s*((?:19|20)\d{2})/i },
  { field: 'location', re: /\b(?:location|area|system|station|unit|bay)\s*[:#-]?\s*([A-Za-z0-9][A-Za-z0-9 .&\-/]{1,40})/i },
];

function detectCategory(text: string): Asset['category'] {
  for (const [re, cat] of CATEGORY_RULES) if (re.test(text)) return cat;
  return 'other';
}

function detectManufacturer(text: string): string {
  for (const m of MANUFACTURERS) if (text.toLowerCase().includes(m.toLowerCase())) return m;
  return '';
}

function detectCriticality(text: string): Asset['criticality'] {
  if (/\b(critical|safety[- ]related|life safety|regulatory|FERC)\b/i.test(text)) return 'critical';
  if (/\b(high|primary|main)\b/i.test(text)) return 'high';
  if (/\b(low|spare|standby backup)\b/i.test(text)) return 'low';
  return 'medium';
}

// Strip the boilerplate that fills manuals and registers so phrase matching
// sees real content instead of page furniture.
function meaningfulLines(text: string): string[] {
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(l => l.replace(/[ \t]+/g, ' ').trim())
    .filter(l => l.length >= 3)
    .filter(l => !/^(page|rev|revision|table of contents|appendix|section|\d+\.\d+|[-=_*]{3,})\b/i.test(l))
    .filter(l => /[A-Za-z]{3,}/.test(l));
}

function looksLikeAssetName(line: string): boolean {
  if (line.length < 3 || line.length > 90) return false;
  if (/\b(shall|shall be|must|please|note that|the following|refer to|see section)\b/i.test(line)) return false;
  if (line.split(' ').length > 14) return false;
  return CATEGORY_RULES.some(([re]) => re.test(line)) || /\b(unit|station|system|assembly|panel|vault)\b/i.test(line);
}

function makeCandidate(
  name: string,
  context: string,
  evidence: string,
  index: number,
  baseConfidence: number,
): AssetCandidate {
  const combined = `${name} ${context}`;
  const category = detectCategory(combined);
  const manufacturer = detectManufacturer(combined);
  const criticality = detectCriticality(combined);

  let confidence = baseConfidence;
  if (category !== 'other') confidence += 0.15;
  if (manufacturer) confidence += 0.1;
  if (/\b(serial|s\/n)\b/i.test(combined)) confidence += 0.1;

  return {
    tempId: `CAND-${index + 1}`,
    name: name.slice(0, 120),
    category,
    location: '',
    manufacturer,
    model: '',
    serialNumber: '',
    installYear: (combined.match(/\b((?:19|20)\d{2})\b/)?.[1]) ?? '',
    criticality,
    notes: '',
    confidence: Math.max(0, Math.min(1, Number(confidence.toFixed(2)))),
    evidence: evidence.slice(0, 240),
  };
}

// Tabular path: a header row naming asset-ish columns, then data rows.
function extractTabular(lines: string[], startIndex: number): { candidates: AssetCandidate[]; consumed: number } {
  const candidates: AssetCandidate[] = [];
  const header = lines[startIndex];
  const delim = (['\t', ',', ';', '|'] as const).find(d => header.split(d).length >= 3);
  if (!delim) return { candidates, consumed: 0 };

  const headers = header.split(delim).map(h => h.trim().toLowerCase());
  const nameIdx = headers.findIndex(h => /name|description|asset|equipment|title/.test(h));
  if (nameIdx === -1) return { candidates, consumed: 0 };

  const find = (re: RegExp) => headers.findIndex(h => re.test(h));
  const catIdx = find(/categor|type|class/);
  const locIdx = find(/location|site|area|system|facility/);
  const mfrIdx = find(/manufactur|make|vendor|mfr/);
  const modelIdx = find(/model/);
  const serIdx = find(/serial|s\/n/);
  const yearIdx = find(/year|install|date/);
  const critIdx = find(/critical|priorit|importance/);

  let consumed = 0;
  for (let i = startIndex + 1; i < lines.length; i++) {
    const cells = lines[i].split(delim).map(c => c.trim());
    if (cells.length < 2) break;
    const rawName = cells[nameIdx];
    if (!rawName || rawName.length < 2) continue;

    const ctx = cells.join(' ');
    const c = makeCandidate(rawName, ctx, lines[i], candidates.length, 0.7);
    if (catIdx >= 0 && cells[catIdx]) c.category = normalizeCategory(cells[catIdx]);
    if (locIdx >= 0) c.location = cells[locIdx] ?? '';
    if (mfrIdx >= 0 && cells[mfrIdx]) c.manufacturer = cells[mfrIdx];
    if (modelIdx >= 0) c.model = cells[modelIdx] ?? '';
    if (serIdx >= 0) c.serialNumber = cells[serIdx] ?? '';
    if (yearIdx >= 0) {
      const yr = (cells[yearIdx] ?? '').match(/\b((?:19|20)\d{2})\b/);
      if (yr) c.installYear = yr[1];
    }
    if (critIdx >= 0 && cells[critIdx]) c.criticality = normalizeCriticality(cells[critIdx]);
    c.confidence = Math.max(0, Math.min(1, Number((c.confidence + 0.1).toFixed(2))));
    candidates.push(c);
    consumed++;
  }
  return { candidates, consumed };
}

function normalizeCategory(value: string): Asset['category'] {
  const v = value.toLowerCase();
  const direct: Asset['category'][] = ['mechanical', 'electrical', 'hvac', 'plumbing', 'structural', 'vehicle', 'it', 'safety', 'other'];
  const hit = direct.find(d => v.includes(d));
  return hit ?? detectCategory(value);
}

function normalizeCriticality(value: string): Asset['criticality'] {
  const v = value.toLowerCase();
  if (v.includes('critical')) return 'critical';
  if (v.includes('high')) return 'high';
  if (v.includes('low')) return 'low';
  if (v.includes('med')) return 'medium';
  return detectCriticality(value);
}

export function ingestDocument(text: string, opts: { filename?: string } = {}): IngestResult {
  // The source filename is accepted for the API but not needed for extraction;
  // mark it used so callers can keep passing it without a lint warning.
  void opts;
  const warnings: string[] = [];
  const lines = meaningfulLines(text);
  const stats = { linesRead: lines.length, rowsFound: 0, dropped: 0 };

  if (lines.length === 0) {
    warnings.push('No readable text found. If this is a PDF or scanned image, paste the text or upload a CSV/TSV export instead — binary OCR is not performed in-app.');
    return { candidates: [], documentType: 'unknown', warnings, stats };
  }

  const candidates: AssetCandidate[] = [];
  const seen = new Set<string>();
  const push = (c: AssetCandidate) => {
    const key = c.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (key.length < 3 || seen.has(key)) { stats.dropped++; return; }
    seen.add(key);
    candidates.push({ ...c, tempId: `CAND-${candidates.length + 1}` });
  };

  // Pass 1 — tabular wherever a header row is detected.
  for (let i = 0; i < lines.length; i++) {
    const tab = extractTabular(lines, i);
    if (tab.candidates.length > 0) {
      tab.candidates.forEach(push);
      i += tab.consumed;
    }
  }

  const tabularCount = candidates.length;

  // Pass 2 — prose/nameplate lines, but never re-add rows already found in a table.
  let idx = candidates.length;
  for (const line of lines) {
    if (!looksLikeAssetName(line)) continue;
    push(makeCandidate(line, line, line, idx, 0.35));
    idx++;
  }

  // Pass 3 — nameplate key/value blocks: a strong nameplate signal upgrades an
  // existing near-match instead of creating a duplicate.
  let current: AssetCandidate | null = null;
  for (const line of lines) {
    const nameplate = /^(?:asset|equipment|tag|unit|item)\s*(?:name|id|no|number|#)?\s*[:#-]\s*(.+)$/i.exec(line);
    if (nameplate) {
      current = makeCandidate(nameplate[1].trim(), line, line, candidates.length, 0.55);
      push(current);
      continue;
    }
    if (!current) continue;
    for (const { field, re } of FIELD_PATTERNS) {
      const m = re.exec(line);
      if (!m || !m[1]) continue;
      const value = m[1].trim();
      if (!value) continue;
      if (field === 'serialNumber' && !current.serialNumber) current.serialNumber = value;
      else if (field === 'model' && !current.model) current.model = value;
      else if (field === 'manufacturer' && !current.manufacturer) current.manufacturer = value;
      else if (field === 'installYear' && /^\d{4}$/.test(value)) current.installYear = value;
      else if (field === 'location' && !current.location) current.location = value;
      current.confidence = Math.max(0, Math.min(1, Number((current.confidence + 0.05).toFixed(2))));
      break;
    }
  }

  stats.rowsFound = candidates.length;

  let documentType: IngestResult['documentType'] = 'unknown';
  if (tabularCount > 0) documentType = 'register';
  else if (candidates.some(c => c.serialNumber || c.model)) documentType = 'nameplate';
  else if (/\b(manual|procedure|section|shall|chapter)\b/i.test(text)) documentType = 'manual';
  else if (candidates.length > 0) documentType = 'notes';

  if (documentType === 'manual') {
    warnings.push('This looks like a manual or procedure. Extracted names are candidates only — review before importing, and consider linking the source document to the assets it describes.');
  }
  if (documentType === 'unknown' && candidates.length === 0) {
    warnings.push('No asset-like content detected.');
  }

  candidates.sort((a, b) => b.confidence - a.confidence);
  return { candidates, documentType, warnings, stats };
}

// Turn a reviewed candidate into a persistable Asset.
export function candidateToAsset(c: AssetCandidate, now: string): Asset {
  const notes = [
    c.notes,
    c.installYear ? `Install year: ${c.installYear}` : '',
    `Imported from document ingestion (confidence ${Math.round(c.confidence * 100)}%).`,
    c.evidence ? `Source: ${c.evidence}` : '',
  ].filter(Boolean).join(' | ');

  return {
    id: 'AST-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5),
    name: c.name,
    category: c.category,
    location: c.location,
    department: '',
    manufacturer: c.manufacturer,
    model: c.model,
    serialNumber: c.serialNumber,
    installDate: c.installYear ? `${c.installYear}-01-01` : '',
    warrantyExpiry: '',
    status: 'operational',
    criticality: c.criticality,
    notes,
    parentId: '',
    createdAt: now,
    updatedAt: now,
  };
}
