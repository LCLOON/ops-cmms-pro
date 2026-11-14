import type { OilAnalysisSampleType } from './types';

export interface OilMetricDefinition {
  key: string;
  label: string;
  unit: string;
  input: 'number' | 'text';
  trendable: boolean;
}

export const oilAnalysisMetrics: Record<OilAnalysisSampleType, OilMetricDefinition[]> = {
  bearing: [
    { key: 'viscosity40', label: 'Kinematic viscosity at 40°C', unit: 'cSt', input: 'number', trendable: true },
    { key: 'viscosity100', label: 'Kinematic viscosity at 100°C', unit: 'cSt', input: 'number', trendable: true },
    { key: 'waterPpm', label: 'Water', unit: 'ppm', input: 'number', trendable: true },
    { key: 'isoCleanliness', label: 'ISO cleanliness code', unit: '', input: 'text', trendable: false },
    { key: 'pqIndex', label: 'PQ index', unit: '', input: 'number', trendable: true },
    { key: 'ironPpm', label: 'Iron (Fe)', unit: 'ppm', input: 'number', trendable: true },
    { key: 'copperPpm', label: 'Copper (Cu)', unit: 'ppm', input: 'number', trendable: true },
    { key: 'leadPpm', label: 'Lead (Pb)', unit: 'ppm', input: 'number', trendable: true },
    { key: 'tinPpm', label: 'Tin (Sn)', unit: 'ppm', input: 'number', trendable: true },
    { key: 'chromiumPpm', label: 'Chromium (Cr)', unit: 'ppm', input: 'number', trendable: true },
    { key: 'aluminumPpm', label: 'Aluminum (Al)', unit: 'ppm', input: 'number', trendable: true },
    { key: 'siliconPpm', label: 'Silicon (Si)', unit: 'ppm', input: 'number', trendable: true },
    { key: 'sodiumPpm', label: 'Sodium (Na)', unit: 'ppm', input: 'number', trendable: true },
    { key: 'acidNumber', label: 'Acid number', unit: 'mg KOH/g', input: 'number', trendable: true },
  ],
  transformer: [
    { key: 'hydrogenPpm', label: 'Hydrogen (H₂)', unit: 'ppm', input: 'number', trendable: true },
    { key: 'methanePpm', label: 'Methane (CH₄)', unit: 'ppm', input: 'number', trendable: true },
    { key: 'ethanePpm', label: 'Ethane (C₂H₆)', unit: 'ppm', input: 'number', trendable: true },
    { key: 'ethylenePpm', label: 'Ethylene (C₂H₄)', unit: 'ppm', input: 'number', trendable: true },
    { key: 'acetylenePpm', label: 'Acetylene (C₂H₂)', unit: 'ppm', input: 'number', trendable: true },
    { key: 'carbonMonoxidePpm', label: 'Carbon monoxide (CO)', unit: 'ppm', input: 'number', trendable: true },
    { key: 'carbonDioxidePpm', label: 'Carbon dioxide (CO₂)', unit: 'ppm', input: 'number', trendable: true },
    { key: 'moisturePpm', label: 'Moisture', unit: 'ppm', input: 'number', trendable: true },
    { key: 'dielectricBreakdownKv', label: 'Dielectric breakdown', unit: 'kV', input: 'number', trendable: true },
    { key: 'acidity', label: 'Acidity', unit: 'mg KOH/g', input: 'number', trendable: true },
    { key: 'interfacialTension', label: 'Interfacial tension', unit: 'mN/m', input: 'number', trendable: true },
    { key: 'furansPpm', label: 'Furans', unit: 'ppm', input: 'number', trendable: true },
    { key: 'powerFactorPercent', label: 'Power factor', unit: '%', input: 'number', trendable: true },
  ],
};
