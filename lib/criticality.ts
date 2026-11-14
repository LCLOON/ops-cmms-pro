// Asset criticality & risk scoring.
//
// Deliberately a pure module: the server uses it to persist/report, the browser
// uses the same code to preview a score as the assessor moves the sliders, so a
// preview can never disagree with what gets saved.
//
// Model (a conventional criticality analysis, not a black box):
//   Consequence = worst of safety / environmental-regulatory / production
//     - production is the only dimension redundancy is allowed to reduce. A
//       standby unit does not make a dam-safety failure less serious.
//     - taking the MAX (not the sum) stops high throughput from inflating an
//       asset that is already dangerous.
//   Likelihood = failure history + wear against useful life + observed condition
//     + how much warning a failure gives.
//   Risk = Consequence x Likelihood (1..25), banded A..D.
//   Spares = lead time + unit cost + procurement difficulty + criticality,
//     which yields hold-on-site / min-max / on-demand.

export type Redundancy = 'none' | 'partial' | 'full';
export type Detectability = 'sudden' | 'gradual' | 'monitored';
export type Procurement = 'off_the_shelf' | 'configured' | 'custom' | 'sole_source_obsolete';

export interface CriticalityInput {
  safetyImpact: number;          // 1..5
  environmentalImpact: number;   // 1..5
  productionImpact: number;      // 1..5
  redundancy: Redundancy;
  detectability: Detectability;
  condition: number;             // 1 excellent .. 5 failed
  failureCount12m: number;       // derived from corrective/emergency work orders
  ageYears: number | null;       // derived from install date
  usefulLifeYears: number;       // 0 = unknown
  leadTimeDays: number;
  procurement: Procurement;
  unitCost: number;
  criticalSpareOnSite: boolean;
}

export type RiskBand = 'A' | 'B' | 'C' | 'D';
export type SpareStrategy = 'hold_on_site' | 'min_max' | 'on_demand';

export interface CriticalityResult {
  consequence: number;
  likelihood: number;
  riskScore: number;
  band: RiskBand;
  lifeRatio: number | null;
  drivers: string[];
  spareStrategy: SpareStrategy;
  spareScore: number;
  spareRationale: string;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const round1 = (n: number) => Math.round(n * 10) / 10;

function consequenceOf(input: CriticalityInput): { value: number; driver: string } {
  const safety = clamp(Math.round(input.safetyImpact), 1, 5);
  const environmental = clamp(Math.round(input.environmentalImpact), 1, 5);
  const productionRaw = clamp(Math.round(input.productionImpact), 1, 5);
  const production = input.redundancy === 'full'
    ? Math.max(1, productionRaw - 2)
    : input.redundancy === 'partial' ? Math.max(1, productionRaw - 1) : productionRaw;

  const candidates: { value: number; driver: string }[] = [
    { value: safety, driver: `Safety impact ${safety}/5` },
    { value: environmental, driver: `Environmental/regulatory impact ${environmental}/5` },
    { value: production, driver: input.redundancy === 'none'
      ? `Production impact ${production}/5`
      : `Production impact ${productionRaw}/5 reduced to ${production} by ${input.redundancy} redundancy` },
  ];
  return candidates.reduce((a, b) => (b.value > a.value ? b : a));
}

function likelihoodOf(input: CriticalityInput, lifeRatio: number | null): { value: number; drivers: string[] } {
  const drivers: string[] = [];
  let score = 1;

  const failures = Math.max(0, Math.round(input.failureCount12m));
  const historyBase = failures === 0 ? 1 : failures === 1 ? 2 : failures <= 3 ? 3 : failures <= 5 ? 4 : 5;
  score = historyBase;
  if (failures > 0) drivers.push(`${failures} corrective job${failures === 1 ? '' : 's'} in 12 months`);

  if (lifeRatio !== null && input.usefulLifeYears > 0) {
    if (lifeRatio >= 1) { score += 1; drivers.push(`Beyond useful life (${Math.round(lifeRatio * 100)}% of ${input.usefulLifeYears}y)`); }
    else if (lifeRatio >= 0.75) { score += 0.5; drivers.push(`Late in life (${Math.round(lifeRatio * 100)}% of ${input.usefulLifeYears}y)`); }
  }

  const condition = clamp(Math.round(input.condition), 1, 5);
  if (condition >= 4) { score += 1; drivers.push(`Poor condition ${condition}/5`); }
  else if (condition === 3) { score += 0.5; drivers.push('Fair condition 3/5'); }

  if (input.detectability === 'sudden') { score += 1; drivers.push('Fails without warning'); }
  else if (input.detectability === 'monitored') { score -= 1; drivers.push('Monitored - degradation is visible early'); }

  return { value: clamp(Math.round(score), 1, 5), drivers };
}

function bandOf(riskScore: number): RiskBand {
  if (riskScore >= 20) return 'A';
  if (riskScore >= 12) return 'B';
  if (riskScore >= 6) return 'C';
  return 'D';
}

function sparesOf(input: CriticalityInput, band: RiskBand): { strategy: SpareStrategy; score: number; rationale: string } {
  const lead = input.leadTimeDays >= 90 ? 3 : input.leadTimeDays >= 30 ? 2 : input.leadTimeDays >= 7 ? 1 : 0;
  const cost = input.unitCost >= 25000 ? 2 : input.unitCost >= 5000 ? 1 : 0;
  const proc = input.procurement === 'custom' || input.procurement === 'sole_source_obsolete' ? 2
    : input.procurement === 'configured' ? 1 : 0;
  const crit = band === 'A' ? 3 : band === 'B' ? 2 : band === 'C' ? 1 : 0;

  const score = lead + cost + proc + crit;
  const strategy: SpareStrategy = score >= 6 ? 'hold_on_site' : score >= 3 ? 'min_max' : 'on_demand';

  const reasons: string[] = [];
  if (lead > 0) reasons.push(`${input.leadTimeDays}d lead time`);
  if (cost > 0) reasons.push(`$${Math.round(input.unitCost).toLocaleString()} unit cost`);
  if (proc > 0) reasons.push(input.procurement.replace(/_/g, ' '));
  reasons.push(`risk band ${band}`);
  if (input.criticalSpareOnSite) reasons.push('critical spare already held');

  return { strategy, score, rationale: reasons.join(', ') };
}

export function computeCriticality(input: CriticalityInput): CriticalityResult {
  const lifeRatio = input.usefulLifeYears > 0 && input.ageYears !== null
    ? round1(input.ageYears / input.usefulLifeYears)
    : null;

  const consequence = consequenceOf(input);
  const likelihood = likelihoodOf(input, lifeRatio);
  const riskScore = consequence.value * likelihood.value;
  const band = bandOf(riskScore);
  const spares = sparesOf(input, band);

  return {
    consequence: consequence.value,
    likelihood: likelihood.value,
    riskScore,
    band,
    lifeRatio,
    drivers: [consequence.driver, ...likelihood.drivers],
    spareStrategy: spares.strategy,
    spareScore: spares.score,
    spareRationale: spares.rationale,
  };
}

// The assessed band becomes the asset's criticality level so the rest of the app
// (PM lists, dashboard ordering) reflects the analysis rather than a guess.
export function bandToAssetCriticality(band: RiskBand): 'critical' | 'high' | 'medium' | 'low' {
  return band === 'A' ? 'critical' : band === 'B' ? 'high' : band === 'C' ? 'medium' : 'low';
}

export const spareStrategyLabel: Record<SpareStrategy, string> = {
  hold_on_site: 'Hold on site',
  min_max: 'Min / max stock',
  on_demand: 'Order on demand',
};

export const bandLabel: Record<RiskBand, string> = {
  A: 'A - Critical',
  B: 'B - High',
  C: 'C - Medium',
  D: 'D - Low',
};
