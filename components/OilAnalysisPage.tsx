'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import DataTable, { type Column } from './DataTable';
import Modal from './Modal';
import { navigate, type NavParams } from '@/lib/nav';
import type { OilAnalysisRecord, OilAnalysisSampleType } from '@/lib/types';
import { oilAnalysisMetrics } from '@/lib/oil-analysis-catalog';

interface AssetOption { id: string; name: string; siteId?: string; }

const emptyRecord = (): OilAnalysisRecord => ({
  id: '', assetId: '', sampleType: 'bearing', sampleDate: new Date().toISOString().slice(0, 10),
  samplePoint: '', sampleId: '', sampledBy: '', labName: '', reportNumber: '',
  oilBrand: '', oilGrade: '', hoursOnOil: '', assessment: 'not_entered',
  assessmentNotes: '', recommendations: '', nextSampleDue: '', notes: '',
  measurements: {}, createdAt: '', updatedAt: '',
});
const fieldClass = 'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
const assessmentLabels: Record<OilAnalysisRecord['assessment'], string> = {
  not_entered: 'Not entered',
  satisfactory: 'Satisfactory',
  monitor: 'Monitor',
  action_required: 'Action required',
};
const assessmentStyles: Record<OilAnalysisRecord['assessment'], string> = {
  not_entered: 'text-slate-400 border-slate-600',
  satisfactory: 'text-green-400 border-green-500/30',
  monitor: 'text-amber-300 border-amber-500/30',
  action_required: 'text-red-300 border-red-500/30',
};
type TextFieldKey =
  | 'assetId' | 'sampleDate' | 'samplePoint' | 'sampleId' | 'sampledBy' | 'labName'
  | 'reportNumber' | 'oilBrand' | 'oilGrade' | 'hoursOnOil' | 'nextSampleDue';

export default function OilAnalysisPage({ params }: { params?: NavParams }) {
  const { canEdit, isAdmin } = useAuth();
  const [items, setItems] = useState<OilAnalysisRecord[]>([]);
  const [assets, setAssets] = useState<AssetOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<OilAnalysisRecord | null>(null);
  const [form, setForm] = useState<OilAnalysisRecord>(emptyRecord);
  const [saving, setSaving] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState(params?.assetId ?? '');
  const [trendType, setTrendType] = useState<OilAnalysisSampleType>('bearing');
  const [trendMetric, setTrendMetric] = useState(oilAnalysisMetrics.bearing[0].key);

  const fetchItems = useCallback(() => {
    fetch('/api/oil-analysis')
      .then(response => { if (!response.ok) throw new Error(`Oil analysis request failed (${response.status})`); return response.json(); })
      .then((rows: OilAnalysisRecord[]) => {
        if (!Array.isArray(rows)) throw new Error('Oil analysis response was not a list');
        setItems(rows);
        setLoadError(false);
      })
      .catch(error => {
        console.error('[oil-analysis] Failed to load sample records', error);
        setLoadError(true);
      })
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { fetchItems(); }, [fetchItems]);

  useEffect(() => {
    fetch('/api/assets')
      .then(response => { if (!response.ok) throw new Error(`Assets request failed (${response.status})`); return response.json(); })
      .then((rows: AssetOption[]) => { if (Array.isArray(rows)) setAssets(rows); })
      .catch(error => console.error('[oil-analysis] Failed to load assets', error));
  }, []);

  useEffect(() => { setSelectedAssetId(params?.assetId ?? ''); }, [params?.assetId]);
  useEffect(() => {
    const metrics = oilAnalysisMetrics[trendType].filter(metric => metric.trendable);
    if (!metrics.some(metric => metric.key === trendMetric)) setTrendMetric(metrics[0].key);
  }, [trendMetric, trendType]);

  const openNew = () => {
    setForm({ ...emptyRecord(), assetId: selectedAssetId || params?.assetId || '' });
    setEditItem(null);
    setShowForm(true);
  };
  const openEdit = (record: OilAnalysisRecord) => {
    setForm({ ...record, measurements: { ...record.measurements } });
    setEditItem(record);
    setShowForm(true);
  };
  const save = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/oil-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!response.ok) { alert((await response.json()).error); return; }
      setShowForm(false);
      fetchItems();
    } finally { setSaving(false); }
  };
  const remove = async (record: OilAnalysisRecord) => {
    if (!confirm(`Delete oil sample ${record.sampleId || record.id}?`)) return;
    const response = await fetch('/api/oil-analysis', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: record.id }),
    });
    if (!response.ok) { alert((await response.json()).error); return; }
    fetchItems();
  };
  const update = (key: TextFieldKey, value: string) => setForm(previous => ({ ...previous, [key]: value }));
  const assetName = (id: string) => assets.find(asset => asset.id === id)?.name ?? id;
  const visibleItems = useMemo(
    () => selectedAssetId ? items.filter(item => item.assetId === selectedAssetId) : items,
    [items, selectedAssetId],
  );
  const trendRows = useMemo(() => items
    .filter(item => item.assetId === selectedAssetId && item.sampleType === trendType)
    .map(item => ({ item, value: Number(item.measurements[trendMetric]) }))
    .filter(point => itemHasTrendValue(point.item, trendMetric) && Number.isFinite(point.value))
    .sort((a, b) => a.item.sampleDate.localeCompare(b.item.sampleDate)), [items, selectedAssetId, trendMetric, trendType]);
  const trendValues = trendRows.map(row => row.value);
  const minValue = Math.min(...trendValues);
  const maxValue = Math.max(...trendValues);
  const valueRange = maxValue - minValue || 1;
  const trendPoints = trendRows.map((row, index) => {
    const x = trendRows.length === 1 ? 300 : 28 + index * (544 / (trendRows.length - 1));
    const y = 132 - ((row.value - minValue) / valueRange) * 112;
    return `${x},${y}`;
  }).join(' ');

  const raiseWorkOrder = (record: OilAnalysisRecord) => {
    const metrics = oilAnalysisMetrics[record.sampleType]
      .filter(metric => record.measurements[metric.key]?.trim())
      .map(metric => `${metric.label}: ${record.measurements[metric.key]}${metric.unit ? ` ${metric.unit}` : ''}`);
    navigate('work-orders', {
      assetId: record.assetId,
      workOrderDraft: {
        title: `Review ${record.sampleType} oil analysis for ${assetName(record.assetId)}`,
        description: [
          `Lab assessment: ${assessmentLabels[record.assessment]}.`,
          `Sample date: ${record.sampleDate}`,
          record.samplePoint ? `Sample point: ${record.samplePoint}` : '',
          record.sampleId ? `Sample ID: ${record.sampleId}` : '',
          record.labName ? `Lab: ${record.labName}` : '',
          record.reportNumber ? `Report: ${record.reportNumber}` : '',
          ...metrics,
          record.assessmentNotes ? `Assessment notes: ${record.assessmentNotes}` : '',
          record.recommendations ? `Lab recommendations: ${record.recommendations}` : '',
          record.notes ? `Notes: ${record.notes}` : '',
        ].filter(Boolean).join('\n'),
        type: 'corrective',
        siteId: assets.find(asset => asset.id === record.assetId)?.siteId ?? '',
        sourceOilAnalysisId: record.id,
      },
    });
  };

  const columns: Column<OilAnalysisRecord>[] = [
    { key: 'id', header: 'Record #' },
    { key: 'sampleDate', header: 'Sample date' },
    { key: 'assetId', header: 'Asset', render: record => (
      <button onClick={() => navigate('assets', { focusId: record.assetId })} className="text-blue-400 hover:text-blue-300 hover:underline text-xs">
        {assetName(record.assetId)}
      </button>
    ) },
    { key: 'sampleType', header: 'Equipment', render: record => record.sampleType === 'bearing' ? 'Rotating / bearing' : 'Transformer' },
    { key: 'sampleId', header: 'Sample / report', render: record => record.sampleId || record.reportNumber || '-' },
    { key: 'samplePoint', header: 'Sample point' },
    { key: 'labName', header: 'Lab' },
    { key: 'assessment', header: 'Lab assessment', render: record => (
      <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${assessmentStyles[record.assessment]}`}>{assessmentLabels[record.assessment]}</span>
    ) },
    { key: 'nextSampleDue', header: 'Next sample' },
    { key: 'followUp', header: 'Follow-up', render: record => record.followUpWorkOrderId ? (
      <button onClick={() => navigate('work-orders', { focusId: record.followUpWorkOrderId })}
        className="text-blue-400 hover:text-blue-300 hover:underline text-xs">{record.followUpWorkOrderId}</button>
    ) : record.assessment === 'action_required' && canEdit ? (
      <button onClick={() => raiseWorkOrder(record)} className="text-amber-300 hover:text-amber-200 underline text-xs">Raise corrective WO</button>
    ) : <span className="text-slate-600">-</span> },
  ];

  if (loading) return <div className="text-slate-400 p-8">Loading oil analysis records...</div>;

  const input = (label: string, key: TextFieldKey, type = 'text') => (
    <div>
      <label htmlFor={`oil-${key}`} className="block text-xs text-slate-500 mb-1">{label}</label>
      <input id={`oil-${key}`} type={type} value={form[key]} onChange={event => update(key, event.target.value)} className={fieldClass} />
    </div>
  );
  const textArea = (label: string, key: 'assessmentNotes' | 'recommendations' | 'notes', rows = 2) => (
    <div>
      <label htmlFor={`oil-${key}`} className="block text-xs text-slate-500 mb-1">{label}</label>
      <textarea id={`oil-${key}`} value={form[key]} onChange={event => setForm(previous => ({ ...previous, [key]: event.target.value }))}
        rows={rows} className={fieldClass} />
    </div>
  );
  const trendOptions = oilAnalysisMetrics[form.sampleType];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Oil Analysis</h2>
        <p className="text-slate-400 text-sm mt-1">Track lab results and trends for rotating-equipment bearings and transformers.</p>
        <p className="text-slate-500 text-xs mt-1">Record the laboratory’s assessment and recommendations; the app does not apply diagnostic thresholds.</p>
      </div>
      {loadError && <p role="alert" className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">Could not load oil analysis. Refresh to try again.</p>}

      <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px]">
            <label htmlFor="oil-trend-asset" className="block text-xs text-slate-500 mb-1">Trend asset</label>
            <select id="oil-trend-asset" value={selectedAssetId} onChange={event => setSelectedAssetId(event.target.value)} className={fieldClass}>
              <option value="">Select an asset</option>
              {assets.map(asset => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="oil-trend-type" className="block text-xs text-slate-500 mb-1">Sample profile</label>
            <select id="oil-trend-type" value={trendType} onChange={event => setTrendType(event.target.value as OilAnalysisSampleType)} className={fieldClass}>
              <option value="bearing">Rotating / bearing</option>
              <option value="transformer">Transformer</option>
            </select>
          </div>
          <div className="min-w-[220px]">
            <label htmlFor="oil-trend-metric" className="block text-xs text-slate-500 mb-1">Metric</label>
            <select id="oil-trend-metric" value={trendMetric} onChange={event => setTrendMetric(event.target.value)} className={fieldClass}>
              {oilAnalysisMetrics[trendType].filter(metric => metric.trendable).map(metric => (
                <option key={metric.key} value={metric.key}>{metric.label}{metric.unit ? ` (${metric.unit})` : ''}</option>
              ))}
            </select>
          </div>
        </div>
        {!selectedAssetId
          ? <p className="text-xs text-slate-500">Choose an asset to compare reported readings over time.</p>
          : trendRows.length === 0
            ? <p className="text-xs text-slate-500">No numeric readings are recorded for this metric yet.</p>
            : <div>
              <svg viewBox="0 0 600 160" role="img" aria-label={`${trendMetric} history for ${assetName(selectedAssetId)}`} className="h-40 w-full">
                <line x1="28" y1="132" x2="572" y2="132" stroke="#334155" strokeWidth="1" />
                {trendRows.length > 1 && <polyline points={trendPoints} fill="none" stroke="#60a5fa" strokeWidth="3" />}
                {trendRows.map((row, index) => {
                  const x = trendRows.length === 1 ? 300 : 28 + index * (544 / (trendRows.length - 1));
                  const y = 132 - ((row.value - minValue) / valueRange) * 112;
                  return <circle key={row.item.id} cx={x} cy={y} r="4" fill="#93c5fd">
                    <title>{row.item.sampleDate}: {row.value}</title>
                  </circle>;
                })}
              </svg>
              <div className="flex flex-wrap gap-3 text-[11px] text-slate-500">
                {trendRows.map(row => <span key={row.item.id}>{row.item.sampleDate}: {row.value}</span>)}
              </div>
            </div>}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-xs text-slate-400">
          Filter asset
          <select value={selectedAssetId} onChange={event => setSelectedAssetId(event.target.value)} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white">
            <option value="">All assets</option>
            {assets.map(asset => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
          </select>
        </label>
      </div>
      <DataTable data={selectedAssetId ? visibleItems : items} columns={columns}
        onEdit={canEdit ? openEdit : undefined} onDelete={isAdmin ? remove : undefined}
        onAdd={canEdit ? openNew : undefined} searchPlaceholder="Search oil samples..."
        emptyMessage="No oil analysis samples found." canEdit={canEdit} canDelete={isAdmin}
        initialSearch={params?.focusId ?? ''} highlightId={params?.focusId} />

      {showForm && (
        <Modal open={showForm} onClose={() => setShowForm(false)} title={editItem ? 'Edit Oil Analysis Sample' : 'New Oil Analysis Sample'}>
          <div className="space-y-5">
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-white">Sample context</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="oil-sampleType" className="block text-xs text-slate-500 mb-1">Sample profile</label>
                  <select id="oil-sampleType" value={form.sampleType} onChange={event => {
                    setForm(previous => ({ ...previous, sampleType: event.target.value as OilAnalysisSampleType, measurements: {} }));
                  }} className={fieldClass}>
                    <option value="bearing">Rotating equipment / bearing</option>
                    <option value="transformer">Transformer</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="oil-assetId" className="block text-xs text-slate-500 mb-1">Asset</label>
                  <select id="oil-assetId" value={form.assetId} onChange={event => update('assetId', event.target.value)} className={fieldClass}>
                    <option value="">Select an asset</option>
                    {assets.map(asset => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
                  </select>
                </div>
                {input('Sample date', 'sampleDate', 'date')}
                {input('Sample point', 'samplePoint')}
                {input('Sample ID', 'sampleId')}
                {input('Collected by', 'sampledBy')}
                {input('Laboratory', 'labName')}
                {input('Lab report number', 'reportNumber')}
                {input('Oil brand', 'oilBrand')}
                {input('Oil grade', 'oilGrade')}
                {input('Hours on oil', 'hoursOnOil', 'number')}
                {input('Next sample due', 'nextSampleDue', 'date')}
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-white">Laboratory results</h3>
              <div className="grid grid-cols-2 gap-4">
                {trendOptions.map(metric => (
                  <div key={metric.key}>
                    <label htmlFor={`oil-metric-${metric.key}`} className="block text-xs text-slate-500 mb-1">
                      {metric.label}{metric.unit ? ` (${metric.unit})` : ''}
                    </label>
                    <input id={`oil-metric-${metric.key}`} type={metric.input} value={form.measurements[metric.key] ?? ''}
                      onChange={event => setForm(previous => ({ ...previous, measurements: { ...previous.measurements, [metric.key]: event.target.value } }))}
                      className={fieldClass} />
                  </div>
                ))}
                <div>
                  <label htmlFor="oil-assessment" className="block text-xs text-slate-500 mb-1">Lab assessment</label>
                  <select id="oil-assessment" value={form.assessment} onChange={event => setForm(previous => ({
                    ...previous,
                    assessment: event.target.value as OilAnalysisRecord['assessment'],
                  }))} className={fieldClass}>
                    {Object.entries(assessmentLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </div>
              </div>
              {textArea('Lab assessment notes', 'assessmentNotes')}
              {textArea('Lab recommendations', 'recommendations')}
              {textArea('Additional notes', 'notes')}
            </section>
            <div className="flex justify-end gap-3 border-t border-slate-800 pt-4">
              <button onClick={save} disabled={saving} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-6 py-2 rounded-lg text-sm font-medium">
                {saving ? 'Saving...' : 'Save sample'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function itemHasTrendValue(record: OilAnalysisRecord, metric: string): boolean {
  return Boolean(record.measurements[metric]?.trim());
}
