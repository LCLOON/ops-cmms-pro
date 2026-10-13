// Hydroelectric Plant Seed Data — Lower Kennebec River Projects
// Source: Lower_Kennebec_Hydro_CMMS_Maintenance_Dropdowns.xlsx
// Lockwood (P-2574), Hydro-Kennebec (P-2611), Shawmut (P-2322), Weston (P-2325)

import { EXCEL_ASSETS } from "./excel-assets";
import { EXCEL_PM_TASKS } from "./excel-pm-tasks";

// Plant Research Data
export interface HydroPlant {
  fercNo: string;
  facility: string;
  riverMile: number;
  capacityMW: string;
  units: string;
  unitTypes: string;
  yearBuilt: number;
  fishPassage: string;
}

export const HYDRO_PLANTS: HydroPlant[] = [
  { fercNo: "P-2574", facility: "Lockwood Hydro", riverMile: 63, capacityMW: "6.915 MW", units: "7 total: U1-U6 plus U7", unitTypes: "U1-U6 vertical Francis; U7 horizontal Kaplan", yearBuilt: 1919, fishPassage: "Anadromous fish lift/trap-and-haul, upstream eelway, downstream fish bypass sluice, surface sluice, floating guidance boom" },
  { fercNo: "P-2611", facility: "Hydro-Kennebec Hydro", riverMile: 64, capacityMW: "15.433 MW", units: "2", unitTypes: "Two Kaplan turbine-generator units", yearBuilt: 1989, fishPassage: "Fish lift (2017), upstream eelway, downstream surface bypass, perforated-plate guidance boom" },
  { fercNo: "P-2322", facility: "Shawmut Hydro", riverMile: 66, capacityMW: "8.65 MW", units: "8 total: U1-U6 plus U7-U8", unitTypes: "U1-U6 horizontal Francis; U7-U8 horizontal tube-type", yearBuilt: 1912, fishPassage: "Two upstream eelways; downstream sluice/Tainter/deep gates. Proposed fish passage under EIS/WQC" },
  { fercNo: "P-2325", facility: "Weston Station", riverMile: 81.5, capacityMW: "15.98 MW", units: "4", unitTypes: "Four vertical Francis turbine-generator units", yearBuilt: 1920, fishPassage: "Upstream eelway; downstream log sluice/concrete flume" },
];

// Seed types
export interface AssetSeed {
  assetId: string; name: string; category: string; location: string; department: string;
  manufacturer: string; model: string; serialNumber: string; installDate: string;
  status: string; criticality: string; parentId: string;
  area: string; system: string;
}

export interface PmSeed {
  pmId: string; assetId: string;
  title: string; description: string;
  frequencyType: string; frequencyValue: number;
  assignedTo: string; estimatedHours: number;
}

// Map Excel asset class to CMMS category
function mapCategory(assetClass: string): string {
  const m: Record<string, string> = {
    "Civil Structure": "structural",
    "Mechanical Rotating": "mechanical",
    "Mechanical Stationary": "mechanical",
    "Electrical Generation": "electrical",
    "Electrical Distribution": "electrical",
    "Electrical Balance of Plant": "electrical",
    "Controls/Automation": "electrical",
    "Hydraulic Equipment": "mechanical",
    "Safety/Regulatory": "safety",
    "Environmental/Fish Passage": "other",
    "HVAC/Plumbing": "hvac",
    "Structural/Misc": "structural",
    "Cyber/OT": "electrical",
    "Facilities": "structural",
  };
  return m[assetClass] || "other";
}

function mapCriticality(c: string): string {
  const m: Record<string, string> = { Critical: "critical", High: "high", Medium: "medium", Low: "low" };
  return m[c] || "medium";
}

function mapFrequency(f: string): { type: string; value: number } {
  const fl = f.toLowerCase();
  if (fl.includes("daily")) return { type: "daily", value: 1 };
  if (fl.includes("weekly")) return { type: "weekly", value: 1 };
  if (fl.includes("monthly")) return { type: "monthly", value: 1 };
  if (fl.includes("quarterly")) return { type: "quarterly", value: 1 };
  if (fl.includes("semi-annual") || fl.includes("semi_annual") || fl.includes("biannual")) return { type: "semi_annual", value: 1 };
  if (fl.includes("annual") || fl.includes("yearly")) return { type: "annual", value: 1 };
  if (fl.includes("3-year") || fl.includes("triennial")) return { type: "annual", value: 3 };
  if (fl.includes("5-year") || fl.includes("quinquennial")) return { type: "annual", value: 5 };
  if (fl.includes("overhaul")) return { type: "annual", value: 5 };
  if (fl.includes("seasonal") || fl.includes("season")) return { type: "semi_annual", value: 1 };
  if (fl.includes("as-needed") || fl.includes("condition-based")) return { type: "annual", value: 1 };
  return { type: "annual", value: 1 };
}

// Generate assets and PMs from Excel data
export function generateHydroAssets(): { assets: AssetSeed[]; pmSchedules: PmSeed[] } {
  const assets: AssetSeed[] = [];
  const pms: PmSeed[] = [];

  // Create facility-level parent assets for the 4 hydro plants
  const facilityParents: { id: string; name: string; facility: string }[] = [
    { id: 'FAC-LOCKWOOD', name: 'Lockwood Hydro Station', facility: 'Lockwood Hydro' },
    { id: 'FAC-KENNEBEC', name: 'Hydro-Kennebec Station', facility: 'Hydro-Kennebec Hydro' },
    { id: 'FAC-SHAWMUT', name: 'Shawmut Hydro Station', facility: 'Shawmut Hydro' },
    { id: 'FAC-WESTON', name: 'Weston Station', facility: 'Weston Station' },
  ];

  for (const fp of facilityParents) {
    const plant = HYDRO_PLANTS.find(p => p.facility === fp.facility);
    assets.push({
      assetId: fp.id,
      name: fp.name,
      category: 'structural',
      location: plant ? `River Mile ${plant.riverMile}, Kennebec River, ME` : 'Kennebec River, ME',
      department: 'Operations',
      manufacturer: 'Various',
      model: plant ? plant.capacityMW : '',
      serialNumber: plant ? `FERC ${plant.fercNo}` : '',
      installDate: plant ? `${plant.yearBuilt}-01-01` : '',
      status: 'operational',
      criticality: 'critical',
      parentId: '',
      area: 'Facility',
      system: 'Facility',
    });
  }

  // Assets from Excel Asset Register — link to facility parents
  const facilityMap: Record<string, string> = {
    'Lockwood Hydro': 'FAC-LOCKWOOD',
    'Hydro-Kennebec Hydro': 'FAC-KENNEBEC',
    'Shawmut Hydro': 'FAC-SHAWMUT',
    'Weston Station': 'FAC-WESTON',
  };

  for (const ea of EXCEL_ASSETS) {
    assets.push({
      assetId: ea.assetId,
      name: ea.assetName,
      category: mapCategory(ea.assetClass),
      location: ea.area,
      department: "Operations",
      manufacturer: ea.manufacturer,
      model: ea.modelSerial,
      serialNumber: ea.assetId,
      installDate: ea.installYear ? ea.installYear + "-01-01" : "",
      status: "operational",
      criticality: mapCriticality(ea.criticality),
      parentId: facilityMap[ea.facility] || ea.parentAsset,
      area: ea.area,
      system: ea.system,
    });
  }

  // PM Tasks from Excel Maintenance Task Library — tiered matching
  for (const pt of EXCEL_PM_TASKS) {
    const freq = mapFrequency(pt.frequency);
    // Tier 1: exact match on facility + system + assetClass + assetType
    let matching = assets.filter(a => {
      const ea = EXCEL_ASSETS.find(x => x.assetId === a.assetId);
      if (!ea || ea.facility !== pt.facility) return false;
      return ea.system === pt.system && ea.assetClass === pt.assetClass && ea.assetType === pt.assetType;
    });
    // Tier 2: match on facility + system + assetClass (broader type match)
    if (matching.length === 0) {
      matching = assets.filter(a => {
        const ea = EXCEL_ASSETS.find(x => x.assetId === a.assetId);
        if (!ea || ea.facility !== pt.facility) return false;
        return ea.system === pt.system && ea.assetClass === pt.assetClass;
      });
    }
    // Tier 3: match on facility + system only
    if (matching.length === 0) {
      matching = assets.filter(a => {
        const ea = EXCEL_ASSETS.find(x => x.assetId === a.assetId);
        if (!ea || ea.facility !== pt.facility) return false;
        return ea.system === pt.system;
      });
    }

    for (const ma of matching) {
      pms.push({
        pmId: "PM-" + pt.taskId + "-" + ma.assetId,
        assetId: ma.assetId,
        title: pt.maintenanceItem,
        description: pt.taskDescription,
        frequencyType: freq.type,
        frequencyValue: freq.value,
        assignedTo: pt.discipline,
        estimatedHours: pt.estHours,
      });
    }
  }

  return { assets, pmSchedules: pms };
}

// Generate spare parts inventory from PM tasks
export interface InvSeed {
  id: string; name: string; partNumber: string; category: string;
  quantityOnHand: number; minQuantity: number; unitCost: number;
  supplier: string; location: string; notes: string;
}

export function generateHydroInventory(): InvSeed[] {
  const items: InvSeed[] = [];
  const seen = new Set<string>();

  for (const pt of EXCEL_PM_TASKS) {
    if (!pt.spareParts || pt.spareParts.toLowerCase().includes("none")) continue;
    const parts = pt.spareParts.split(/[,;]+/).map(s => s.trim()).filter(Boolean);
    for (const part of parts) {
      const key = part.toLowerCase();
      if (seen.has(key) || key.length < 3) continue;
      seen.add(key);
      items.push({
        id: "INV-H-" + String(items.length + 1).padStart(3, "0"),
        name: part,
        partNumber: "",
        category: "mechanical",
        quantityOnHand: Math.floor(Math.random() * 10) + 1,
        minQuantity: 1,
        unitCost: Math.floor(Math.random() * 500) + 10,
        supplier: pt.manufacturer || "Unknown",
        location: "Hydro Warehouse",
        notes: "Used in: " + pt.maintenanceItem,
      });
    }
  }

  return items;
}