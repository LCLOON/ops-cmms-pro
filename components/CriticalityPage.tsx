'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import DataTable, { type Column } from './DataTable';
import Modal from './Modal';
import { Target, AlertTriangle } from 'lucide-react';
import {
  computeCriticality, bandToAssetCriticality, bandLabel, spareStrategyLabel,
  type CriticalityInput, type RiskBand,
} from '@/lib/criticality';
import { navigate } from '@/lib/nav';

interface Row extends CriticalityInput {
  assetId: string;
  assetName: string;
  assetStatus: string;
  legacyCriticality: string;
  assessed: boolean;
  assessedBy: string;
  assessedAt: string;
  notes: string;
  result: { consequence: number; likelihood: number; riskScore: number; band: RiskBand; drivers: string[]; spareStrategy: keyof typeof spareStrategyLabel; spareRationale: string; lifeRatio: number | null };
  id: string;
}

const bandStyles: Record<RiskBand, string> = {
  A: 'bg-red-500/20 text-red-300 border-red-500/40',
  B: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  C: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  D: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
};

const bandForCell = (consequence: number, likelihood: number): RiskBand => {
  const r = consequence * likelihood;
  return r >= 20 ? 'A' : r >= 12 ? 'B' : r >= 6 ? 'C' : 'D';
};

const cellStyles: Record<RiskBand, string> = {
  A: 'bg-red-500/25 hover:bg-red-500/35 text-red-100',
  B: 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-100',
  C: 'bg-blue-500/15 hover:bg-blue-500/25 text-blue-100',
  D: 'bg-slate-700/40 hover:bg-slate-700/60 text-slate-300',
};

const NUM = [1, 2, 3, 4, 5];

const defaultForm = (row: Row): CriticalityInput => ({
  safetyImpact: row.safetyImpact,
  environmentalImpact: row.environmentalImpact,
  productionImpact: row.productionImpact,
  redundancy: row.redundancy,
  detectability: row.detectability,
  condition: row.condition,
  failureCount12m: row.failureCount12m,
  ageYears: row.ageYears,
  usefulLifeYears: row.usefulLifeYears,
  leadTimeDays: row.leadTimeDays,
  procurement: row.procurement,
  unitCost: row.unitCost,
  criticalSpareOnSite: row.criticalSpareOnSite,
});

export default function CriticalityPage() {
  const { canEdit, loading: authLoading } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [assessing, setAssessing] = useState<Row | null>(null);
  const [form, setForm] = useState<CriticalityInput | null>(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [cellFilter, setCellFilter] = useState<{ c: number; l: number } | null>(null);
  const [onlyUnassessed, setOnlyUnassessed] = useState(false);

  const fetchRows = useCallback(() => {
    fetch('/api/criticality')
      .then(r => r.json())
      .then((d: { rows?: Row[] }) => {
        if (Array.isArray(d.rows)) setRows(d.rows.map(r => ({ ...r, id: r.assetId })));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { if (!authLoading) fetchRows(); }, [authLoading, fetchRows]);

  const openAssess = (row: Row) => {
    setAssessing(row);
    setForm(defaultForm(row));
    setNotes(row.notes);
  };

  const preview = useMemo(() => (form ? computeCriticality(form) : null), [form]);

  const save = async () => {
    if (!assessing || !form) return;
    setSaving(true);
    try {
      const r = await fetch('/api/criticality', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId: assessing.assetId, ...form, notes }),
      });
      if (!r.ok) { alert((await r.json()).error); return; }
      setAssessing(null);
      fetchRows();
    } finally {
      setSaving(false);
    }
  };

  const counts = useMemo(() => {
    const c: Record<RiskBand, number> = { A: 0, B: 0, C: 0, D: 0 };
    for (const r of rows) if (r.assessed) c[r.result.band] += 1;
    return c;
  }, [rows]);

  const assessedCount = useMemo(() => rows.filter(r => r.assessed).length, [rows]);

  const grid = useMemo(() => {
    const g: Record<string, number> = {};
    for (const r of rows) if (r.assessed) {
      const key = `${r.result.consequence}-${r.result.likelihood}`;
      g[key] = (g[key] ?? 0) + 1;
    }
    return g;
  }, [rows]);

  // Highest risk first; unassessed assets sink to the bottom rather than
  // appearing to be low risk.
  const data = useMemo(() => {
    let list = [...rows];
    if (cellFilter) list = list.filter(r => r.assessed && r.result.consequence === cellFilter.c && r.result.likelihood === cellFilter.l);
    else if (onlyUnassessed) list = list.filter(r => !r.assessed);
    return list.sort((a, b) => {
      if (a.assessed !== b.assessed) return a.assessed ? -1 : 1;
      return b.result.riskScore - a.result.riskScore;
    });
  }, [rows, cellFilter, onlyUnassessed]);

  const columns: Column<Row>[] = [
    { key: 'assetName', header: 'Asset', render: r => (
      <button onClick={() => navigate('assets', { focusId: r.assetId })} className="text-blue-400 hover:text-blue-300 hover:underline text-left" title="Open this asset">
        {r.assetName}
      </button>
    ) },
    { key: 'band', header: 'Risk', render: r => r.assessed
      ? <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${bandStyles[r.result.band]}`}>{bandLabel[r.result.band]}</span>
      : <span className="text-xs text-slate-500">Not assessed</span> },
    { key: 'consequence', header: 'C x L', render: r => r.assessed
      ? <span className="font-mono text-xs text-slate-300">{r.result.consequence} x {r.result.likelihood} = <span className="text-white">{r.result.riskScore}</span></span>
      : <span className="text-slate-600">-</span> },
    { key: 'spareStrategy', header: 'Spares', render: r => r.assessed
      ? <span className="text-xs text-slate-300">{spareStrategyLabel[r.result.spareStrategy]}</span>
      : <span className="text-slate-600">-</span> },
    { key: 'leadTimeDays', header: 'Lead time', render: r => <span className="text-xs text-slate-400">{r.leadTimeDays ? `${r.leadTimeDays}d` : '-'}</span> },
    { key: 'failures', header: '12m failures', render: r => <span className="text-xs text-slate-400">{r.failureCount12m}</span> },
    { key: 'legacyCriticality', header: 'Asset level', render: r => <span className="text-xs capitalize text-slate-400">{r.legacyCriticality}</span> },
    { key: 'assessedAt', header: 'Assessed', render: r => <span className="text-xs text-slate-500">{r.assessed ? `${r.assessedBy} · ${r.assessedAt}` : '-'}</span> },
  ];

  if (loading) return <div className="text-slate-400 p-8">Loading criticality register...</div>;

  const pct = rows.length ? Math.round((assessedCount / rows.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2"><Target className="w-5 h-5 text-red-400" /> Critical Equipment &amp; Risk</h2>
          <p className="text-slate-400 text-sm mt-1">
            Consequence x likelihood per asset. This is what should drive maintenance priority and spares stocking.
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-white">{pct}%</div>
          <div className="text-xs text-slate-500">{assessedCount} of {rows.length} assessed</div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {(['A', 'B', 'C', 'D'] as RiskBand[]).map(b => (
          <div key={b} className={`rounded-xl border p-4 ${bandStyles[b]}`}>
            <div className="text-3xl font-bold">{counts[b]}</div>
            <div className="text-xs mt-1">{bandLabel[b]}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-1 bg-slate-900/50 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white">Risk matrix</h3>
            {cellFilter && (
              <button onClick={() => setCellFilter(null)} className="text-[10px] text-blue-400 hover:text-blue-300 underline">Clear filter</button>
            )}
          </div>
          <div className="flex gap-1">
            <div className="flex flex-col justify-around text-[10px] text-slate-500 pr-1">
              <span className="[writing-mode:vertical-rl] rotate-180 py-2">Consequence</span>
            </div>
            <div className="flex-1">
              {[5, 4, 3, 2, 1].map(c => (
                <div key={c} className="flex gap-1 mb-1">
                  <div className="w-4 text-[10px] text-slate-500 flex items-center justify-center">{c}</div>
                  {NUM.map(l => {
                    const b = bandForCell(c, l);
                    const n = grid[`${c}-${l}`] ?? 0;
                    const active = cellFilter?.c === c && cellFilter?.l === l;
                    return (
                      <button key={l} onClick={() => setCellFilter(active ? null : { c, l })}
                        title={`Consequence ${c} x Likelihood ${l} = ${c * l} (band ${b}) - ${n} asset(s)`}
                        className={`flex-1 aspect-square rounded flex items-center justify-center text-xs font-medium transition-colors ${cellStyles[b]} ${active ? 'ring-2 ring-white/60' : ''}`}>
                        {n > 0 ? n : <span className="text-[10px] opacity-40">{c * l}</span>}
                      </button>
                    );
                  })}
                </div>
              ))}
              <div className="flex gap-1 mt-1">
                <div className="w-4" />
                {NUM.map(l => <div key={l} className="flex-1 text-center text-[10px] text-slate-500">{l}</div>)}
              </div>
              <div className="text-center text-[10px] text-slate-500 mt-1">Likelihood</div>
            </div>
          </div>
          <p className="text-[10px] text-slate-600 mt-3">
            Click a cell to list the assets in it. Assessed assets only.
          </p>
        </div>

        <div className="lg:col-span-2 bg-slate-900/50 border border-slate-800 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-white">How the score works</h3>
          <div className="text-xs text-slate-400 space-y-2 leading-relaxed">
            <p><span className="text-slate-200 font-medium">Consequence (1-5)</span> takes the <em>worst</em> of safety, environmental/regulatory and production. Taking the worst rather than a sum stops high throughput from inflating an asset that is already dangerous.</p>
            <p><span className="text-slate-200 font-medium">Redundancy</span> only reduces the production dimension (a standby unit does not make a dam-safety failure less serious).</p>
            <p><span className="text-slate-200 font-medium">Likelihood (1-5)</span> comes from corrective jobs in the last 12 months, wear against useful life, observed condition, and how much warning a failure gives.</p>
            <p><span className="text-slate-200 font-medium">Risk = consequence x likelihood</span>, banded below. Spares strategy is a separate judgement from lead time, unit cost, procurement difficulty and criticality.</p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-2 py-1.5 text-red-200">A: risk 20-25</div>
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-amber-200">B: risk 12-19</div>
            <div className="rounded-lg border border-blue-500/40 bg-blue-500/10 px-2 py-1.5 text-blue-200">C: risk 6-11</div>
            <div className="rounded-lg border border-slate-500/40 bg-slate-500/10 px-2 py-1.5 text-slate-200">D: risk 1-5</div>
          </div>
          <p className="text-[10px] text-slate-600">Saving an assessment also sets the asset&apos;s criticality level, so PM lists and dashboards agree with the analysis.</p>
        </div>
      </div>

      <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs">
            <button onClick={() => { setOnlyUnassessed(false); setCellFilter(null); }}
              className={`px-3 py-1.5 rounded-lg border ${!onlyUnassessed && !cellFilter ? 'bg-blue-600/30 text-blue-300 border-blue-500/40' : 'text-slate-400 border-slate-700 hover:text-slate-200'}`}>All assets</button>
            <button onClick={() => { setOnlyUnassessed(true); setCellFilter(null); }}
              className={`px-3 py-1.5 rounded-lg border ${onlyUnassessed ? 'bg-amber-600/20 text-amber-300 border-amber-500/40' : 'text-slate-400 border-slate-700 hover:text-slate-200'}`}>
              Not assessed ({rows.length - assessedCount})
            </button>
            {!canEdit && <span className="text-slate-500">Read-only</span>}
          </div>
          <DataTable
            data={data}
            columns={columns}
            onEdit={canEdit ? openAssess : undefined}
            addLabel="Assess"
            searchPlaceholder="Search assets..."
            canEdit={canEdit}
            canDelete={false}
            emptyMessage="No assets match this filter."
          />
      </div>

      {assessing && form && preview && (
        <Modal open onClose={() => setAssessing(null)} title={`Assess: ${assessing.assetName}`}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <ScoreSelect id="crit-safety" label="Safety impact" value={form.safetyImpact} onChange={v => setForm({ ...form, safetyImpact: v })} />
              <ScoreSelect id="crit-environmental" label="Environmental / regulatory" value={form.environmentalImpact} onChange={v => setForm({ ...form, environmentalImpact: v })} />
              <ScoreSelect id="crit-production" label="Production / service" value={form.productionImpact} onChange={v => setForm({ ...form, productionImpact: v })} />
              <ScoreSelect id="crit-condition" label="Condition (1 good - 5 failed)" value={form.condition} onChange={v => setForm({ ...form, condition: v })} />

              <div>
                <label htmlFor="redundancy" className="block text-xs text-slate-500 mb-1">Redundancy</label>
                <select id="redundancy" value={form.redundancy} onChange={e => setForm({ ...form, redundancy: e.target.value as CriticalityInput['redundancy'] })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm">
                  <option value="none">None - single point</option>
                  <option value="partial">Partial / N+1</option>
                  <option value="full">Full standby</option>
                </select>
              </div>
              <div>
                <label htmlFor="detectability" className="block text-xs text-slate-500 mb-1">Failure warning</label>
                <select id="detectability" value={form.detectability} onChange={e => setForm({ ...form, detectability: e.target.value as CriticalityInput['detectability'] })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm">
                  <option value="sudden">Fails without warning</option>
                  <option value="gradual">Gradual degradation</option>
                  <option value="monitored">Monitored / instrumented</option>
                </select>
              </div>
              <div>
                <label htmlFor="usefulLife" className="block text-xs text-slate-500 mb-1">Useful life (years)</label>
                <input id="usefulLife" type="number" min={0} value={form.usefulLifeYears}
                  onChange={e => setForm({ ...form, usefulLifeYears: Number(e.target.value) })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" />
              </div>
              <div>
                <label htmlFor="leadTime" className="block text-xs text-slate-500 mb-1">Lead time (days)</label>
                <input id="leadTime" type="number" min={0} value={form.leadTimeDays}
                  onChange={e => setForm({ ...form, leadTimeDays: Number(e.target.value) })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" />
              </div>
              <div>
                <label htmlFor="procurement" className="block text-xs text-slate-500 mb-1">Procurement</label>
                <select id="procurement" value={form.procurement} onChange={e => setForm({ ...form, procurement: e.target.value as CriticalityInput['procurement'] })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm">
                  <option value="off_the_shelf">Off the shelf</option>
                  <option value="configured">Configured / made to order</option>
                  <option value="custom">Custom engineered</option>
                  <option value="sole_source_obsolete">Sole source / obsolete</option>
                </select>
              </div>
              <div>
                <label htmlFor="unitCost" className="block text-xs text-slate-500 mb-1">Unit / replacement cost ($)</label>
                <input id="unitCost" type="number" min={0} value={form.unitCost}
                  onChange={e => setForm({ ...form, unitCost: Number(e.target.value) })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" />
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input type="checkbox" checked={form.criticalSpareOnSite} onChange={e => setForm({ ...form, criticalSpareOnSite: e.target.checked })} />
              A critical spare is already held on site
            </label>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-800/50 rounded-lg px-3 py-2">
                <span className="text-slate-500">Age</span>
                <div className="text-slate-200">{form.ageYears === null ? 'unknown' : `${form.ageYears}y`}</div>
              </div>
              <div className="bg-slate-800/50 rounded-lg px-3 py-2">
                <span className="text-slate-500">Corrective jobs (12m)</span>
                <div className="text-slate-200">{form.failureCount12m}</div>
              </div>
            </div>

            <div className="border border-slate-700 rounded-xl p-4 bg-slate-800/30">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs uppercase tracking-wide text-slate-500">Result</span>
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${bandStyles[preview.band]}`}>{bandLabel[preview.band]}</span>
              </div>
              <div className="text-2xl font-bold text-white mb-1">{preview.riskScore}<span className="text-sm text-slate-500"> / 25</span></div>
              <div className="text-xs text-slate-400 mb-2">Consequence {preview.consequence} x Likelihood {preview.likelihood}</div>
              <ul className="text-[11px] text-slate-400 space-y-0.5 list-disc list-inside mb-2">
                {preview.drivers.slice(0, 5).map((d, i) => <li key={i}>{d}</li>)}
              </ul>
              <div className="text-xs">
                <span className="text-slate-500">Spares: </span>
                <span className="text-slate-200 font-medium">{spareStrategyLabel[preview.spareStrategy]}</span>
                <span className="text-slate-500"> ({preview.spareRationale})</span>
              </div>
              <p className="text-[10px] text-slate-600 mt-2">
                Saving sets this asset&apos;s criticality level to &quot;{bandToAssetCriticality(preview.band)}&quot; across the app.
              </p>
            </div>

            <div>
              <label htmlFor="notes" className="block text-xs text-slate-500 mb-1">Notes / rationale</label>
              <textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" />
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t border-slate-800">
              <button onClick={() => setAssessing(null)} className="text-slate-400 hover:text-white px-4 py-2 rounded-lg text-sm">Cancel</button>
              <button onClick={save} disabled={saving} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-6 py-2 rounded-lg text-sm font-medium">
                {saving ? 'Saving...' : 'Save assessment'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {assessedCount === 0 && (
        <div className="flex items-start gap-2 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>Nothing has been assessed yet. Until an asset is assessed it carries no risk score, so it will not influence prioritisation or spares planning.</span>
        </div>
      )}
    </div>
  );
}

function ScoreSelect({ id, label, value, onChange }: { id: string; label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs text-slate-500 mb-1">{label}</label>
      <select id={id} value={value} onChange={e => onChange(Number(e.target.value))}
        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm">
        {NUM.map(n => <option key={n} value={n}>{n}</option>)}
      </select>
    </div>
  );
}
