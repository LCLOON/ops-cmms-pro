// Shared asset shapes and helpers for the asset explorer. Kept in one place so
// the tree, the detail panel and the form cannot drift apart.

export interface AssetRecord {
  id: string;
  name: string;
  category: string;
  location: string;
  department: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  installDate: string;
  warrantyExpiry: string;
  status: string;
  criticality: string;
  notes: string;
  parentId: string;
  createdAt: string;
  updatedAt: string;
  replacementCost?: number;
  failureMode?: string;
  area?: string;
  system?: string;
}

export const ASSET_CATEGORIES = ['mechanical', 'electrical', 'hvac', 'plumbing', 'structural', 'vehicle', 'it', 'safety', 'other'];
export const ASSET_STATUSES = ['operational', 'down', 'maintenance', 'retired'];
export const ASSET_CRITICALITIES = ['critical', 'high', 'medium', 'low'];

export const statusColors: Record<string, string> = {
  operational: 'bg-green-500/20 text-green-400 border-green-500/30',
  down: 'bg-red-500/20 text-red-400 border-red-500/30',
  maintenance: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  retired: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
};

export const statusDots: Record<string, string> = {
  operational: 'bg-green-400', down: 'bg-red-400', maintenance: 'bg-amber-400', retired: 'bg-slate-500',
};

export const criticalityColors: Record<string, string> = {
  critical: 'text-red-400', high: 'text-amber-400', medium: 'text-blue-400', low: 'text-slate-400',
};

// A blank asset, optionally already parented to the node the user clicked.
export function emptyAsset(parentId = ''): AssetRecord {
  return {
    id: '', name: '', category: 'mechanical', location: '', department: '',
    manufacturer: '', model: '', serialNumber: '', installDate: '', warrantyExpiry: '',
    status: 'operational', criticality: 'low', notes: '', parentId,
    createdAt: '', updatedAt: '', replacementCost: 0, failureMode: '',
  };
}

export function indexById(assets: AssetRecord[]): Map<string, AssetRecord> {
  return new Map(assets.map(a => [a.id, a]));
}

// Root-to-asset chain. Guards against a cycle so a bad parent id can never hang
// the UI.
export function buildPath(asset: AssetRecord | undefined, byId: Map<string, AssetRecord>): AssetRecord[] {
  const path: AssetRecord[] = [];
  const seen = new Set<string>();
  let current: AssetRecord | undefined = asset;
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    path.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return path;
}

// Human-readable location in the hierarchy, used in the form's parent picker so
// two similarly named components are distinguishable.
export function pathLabel(asset: AssetRecord, byId: Map<string, AssetRecord>): string {
  return buildPath(asset, byId).map(a => a.name).join(' / ');
}

// Days until warranty expiry; negative means already expired.
export function warrantyDaysLeft(expiry: string): number | null {
  if (!expiry) return null;
  const end = new Date(`${expiry}T00:00:00`);
  if (Number.isNaN(end.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((end.getTime() - today.getTime()) / 86_400_000);
}
