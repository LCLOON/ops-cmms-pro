'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, GitBranch, Search } from 'lucide-react';
import { useAuth } from './AuthContext';
import DataTable, { type Column } from './DataTable';
import Modal from './Modal';
import { navigate, type NavParams } from '@/lib/nav';
import type { RootCauseAnalysis, RootCauseStatus } from '@/lib/types';

interface AssetOption { id: string; name: string; }
interface WorkOrderOption { id: string; assetId: string; title: string; status: string; }

const emptyAnalysis = (): RootCauseAnalysis => ({
  id: '', assetId: '', workOrderId: '', failureDate: new Date().toISOString().slice(0, 10),
  failureMode: '', symptoms: '', causeCategory: 'unknown', rootCause: '', contributingFactors: '',
  correctiveAction: '', preventiveAction: '', actionOwner: '', dueDate: '', status: 'open',
  createdBy: '', createdAt: '', updatedAt: '',
});

const statusStyles: Record<RootCauseStatus, string> = {
  open: 'bg-red-500/20 text-red-300 border-red-500/40',
  investigating: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  actions_in_progress: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  verified: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  closed: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
};

const categories = ['design', 'installation', 'operation', 'maintenance', 'material', 'environment', 'human_factors', 'unknown', 'other'];
const statuses: RootCauseStatus[] = ['open', 'investigating', 'actions_in_progress', 'verified', 'closed'];
const humanize = (value: string) => value.replace(/_/g, ' ');

export default function RootCauseAnalysisPage({ params }: { params?: NavParams }) {
  const { canEdit, isAdmin } = useAuth();
  const [rows, setRows] = useState<RootCauseAnalysis[]>([]);
  const [assets, setAssets] = useState<AssetOption[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrderOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<RootCauseAnalysis | null>(null);
  const [form, setForm] = useState<RootCauseAnalysis>(emptyAnalysis);
  const [saving, setSaving] = useState(false);
  const [handledWorkOrderId, setHandledWorkOrderId] = useState('');

  const fetchRows = useCallback(() => {
    fetch('/api/root-cause-analyses')
      .then(response => { if (!response.ok) throw new Error(`RCA request failed (${response.status})`); return response.json(); })
      .then((data: RootCauseAnalysis[]) => {
        if (!Array.isArray(data)) throw new Error('RCA response was not a list');
        setRows(data);
        setLoadError(false);
      })
      .catch(error => {
        console.error('[root-cause] Failed to load analyses', error);
        setLoadError(true);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchRows(); }, [fetchRows]);
  useEffect(() => {
    fetch('/api/assets')
      .then(response => { if (!response.ok) throw new Error(`Assets request failed (${response.status})`); return response.json(); })
      .then((data: AssetOption[]) => { if (Array.isArray(data)) setAssets(data.map(asset => ({ id: asset.id, name: asset.name }))); })
      .catch(error => console.error('[root-cause] Failed to load assets', error));
    fetch('/api/work-orders')
      .then(response => { if (!response.ok) throw new Error(`Work orders request failed (${response.status})`); return response.json(); })
      .then((data: WorkOrderOption[]) => { if (Array.isArray(data)) setWorkOrders(data); })
      .catch(error => console.error('[root-cause] Failed to load work orders', error));
  }, []);

  useEffect(() => {
    if (loading || !params?.workOrderId || handledWorkOrderId === params.workOrderId) return;
    const existing = rows.find(row => row.workOrderId === params.workOrderId);
    if (existing) {
      setEditItem(existing);
      setForm({ ...existing });
    } else {
      setEditItem(null);
      setForm({ ...emptyAnalysis(), assetId: params.assetId ?? '', workOrderId: params.workOrderId });
    }
    setHandledWorkOrderId(params.workOrderId);
    setShowForm(true);
  }, [handledWorkOrderId, loading, params?.assetId, params?.workOrderId, rows]);

  const openNew = () => { setForm(emptyAnalysis()); setEditItem(null); setShowForm(true); };
  const openEdit = (row: RootCauseAnalysis) => { setForm({ ...row }); setEditItem(row); setShowForm(true); };
  const update = (key: keyof RootCauseAnalysis, value: string) => setForm({ ...form, [key]: value });

  const save = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/root-cause-analyses', {
        method: editItem ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!response.ok) { alert((await response.json()).error); return; }
      setShowForm(false);
      fetchRows();
    } finally { setSaving(false); }
  };

  const remove = async (row: RootCauseAnalysis) => {
    if (!confirm(`Delete root cause analysis for ${assetName(row.assetId)}?`)) return;
    const response = await fetch('/api/root-cause-analyses', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: row.id }),
    });
    if (!response.ok) { alert((await response.json()).error); return; }
    fetchRows();
  };

  const assetName = (id: string) => assets.find(asset => asset.id === id)?.name ?? id;
  const visibleRows = params?.assetId ? rows.filter(row => row.assetId === params.assetId) : rows;
  const openCount = useMemo(() => visibleRows.filter(row => !['verified', 'closed'].includes(row.status)).length, [visibleRows]);
  const actionCount = useMemo(() => visibleRows.filter(row => row.status === 'actions_in_progress').length, [visibleRows]);
  const repeatCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const row of visibleRows) {
      if (!row.failureMode.trim()) continue;
      const key = `${row.assetId.toLowerCase()}|${row.failureMode.trim().toLowerCase()}`;
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }, [visibleRows]);
  const repeatedFailureModes = Object.values(repeatCounts).filter(count => count > 1).length;
  const columns: Column<RootCauseAnalysis>[] = [
    { key: 'failureMode', header: 'Failure', render: row => (
      <div>
        <div className="font-medium text-slate-200">{row.failureMode || 'Unspecified failure'}</div>
        <div className="text-[11px] text-slate-500">{row.failureDate}</div>
      </div>
    ) },
    { key: 'assetId', header: 'Asset', render: row => (
      <button onClick={() => navigate('assets', { focusId: row.assetId })} className="text-blue-400 hover:text-blue-300 hover:underline text-left">
        {assetName(row.assetId)}
      </button>
    ) },
    { key: 'repeatCount', header: 'Same failure / asset', render: row => {
      const key = `${row.assetId.toLowerCase()}|${row.failureMode.trim().toLowerCase()}`;
      return row.failureMode.trim() ? repeatCounts[key] ?? 1 : 1;
    } },
    { key: 'workOrderId', header: 'Work order', render: row => row.workOrderId ? (
      <button onClick={() => navigate('work-orders', { focusId: row.workOrderId })} className="text-blue-400 hover:text-blue-300 hover:underline text-left">
        {row.workOrderId}
      </button>
    ) : <span className="text-slate-500">-</span> },
    { key: 'causeCategory', header: 'Cause', render: row => <span className="capitalize">{humanize(row.causeCategory)}</span> },
    { key: 'status', header: 'Status', render: row => (
      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${statusStyles[row.status]}`}>{humanize(row.status)}</span>
    ) },
    { key: 'actionOwner', header: 'Action owner', render: row => row.actionOwner || <span className="text-slate-600">Unassigned</span> },
    { key: 'dueDate', header: 'Action due', render: row => row.dueDate || <span className="text-slate-600">-</span> },
  ];

  if (loading) return <div className="text-slate-400 p-8">Loading root cause register...</div>;

  const fieldClass = 'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
  const textarea = (label: string, key: keyof RootCauseAnalysis, rows = 3) => (
    <div>
      <label className="block text-xs text-slate-500 mb-1">{label}</label>
      <textarea value={String(form[key] ?? '')} onChange={event => update(key, event.target.value)} rows={rows} className={fieldClass} />
    </div>
  );
  const input = (label: string, key: keyof RootCauseAnalysis, type = 'text') => (
    <div>
      <label className="block text-xs text-slate-500 mb-1">{label}</label>
      <input type={type} value={String(form[key] ?? '')} onChange={event => update(key, event.target.value)} className={fieldClass} />
    </div>
  );
  const select = (label: string, key: keyof RootCauseAnalysis, options: string[]) => (
    <div>
      <label className="block text-xs text-slate-500 mb-1">{label}</label>
      <select value={String(form[key])} onChange={event => update(key, event.target.value)} className={fieldClass}>
        {options.map(option => <option key={option} value={option}>{humanize(option)}</option>)}
      </select>
    </div>
  );
  const availableWorkOrders = workOrders.filter(order => !order.assetId || order.assetId === form.assetId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2"><GitBranch className="w-5 h-5 text-amber-400" /> Root Cause Analysis</h2>
          <p className="text-slate-400 text-sm mt-1">Turn equipment failures into verified corrective and preventive actions.</p>
        </div>
        {canEdit && (
          <button onClick={openNew} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium">
            <Search className="w-4 h-4" /> New analysis
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <div className="text-2xl font-bold text-amber-300">{visibleRows.length}</div><div className="text-xs text-slate-400 mt-1">Total analyses</div>
        </div>
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
          <div className="text-2xl font-bold text-red-300">{openCount}</div><div className="text-xs text-slate-400 mt-1">Open / not yet verified</div>
        </div>
        <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-4">
          <div className="text-2xl font-bold text-blue-300">{actionCount}</div><div className="text-xs text-slate-400 mt-1">Actions in progress</div>
        </div>
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
          <div className="text-2xl font-bold text-red-300">{repeatedFailureModes}</div><div className="text-xs text-slate-400 mt-1">Repeated failure modes</div>
        </div>
      </div>

      {loadError && <div className="flex items-center gap-2 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2"><AlertTriangle className="w-4 h-4" />Could not load root cause analyses. Refresh to try again.</div>}

      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-white mb-2">Failure learning loop</h3>
        <p className="text-xs text-slate-400 leading-relaxed">
          Start an analysis from a corrective or emergency work order. Record the failure mode, symptoms, cause, and action owner; keep it open until corrective actions are verified. Failed test results can raise a corrective work order from the Testing tab.
        </p>
      </div>

      <DataTable data={visibleRows} columns={columns} onEdit={canEdit ? openEdit : undefined} onDelete={isAdmin ? remove : undefined}
        searchPlaceholder="Search failures, assets, work orders..." emptyMessage="No root cause analyses recorded yet."
        canEdit={canEdit} canDelete={isAdmin} initialSearch={params?.search ?? ''} highlightId={params?.focusId} />

      {showForm && (
        <Modal open onClose={() => setShowForm(false)} title={editItem ? `Edit RCA: ${editItem.id}` : 'New Root Cause Analysis'}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Asset</label>
                <select value={form.assetId} onChange={event => {
                  const assetId = event.target.value;
                  const linked = workOrders.find(order => order.id === form.workOrderId);
                  setForm({ ...form, assetId, workOrderId: linked && linked.assetId && linked.assetId !== assetId ? '' : form.workOrderId });
                }} className={fieldClass}>
                  <option value="">Select an asset</option>
                  {assets.map(asset => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Linked work order</label>
                <select value={form.workOrderId} onChange={event => update('workOrderId', event.target.value)} className={fieldClass}>
                  <option value="">No linked work order</option>
                  {availableWorkOrders.map(order => <option key={order.id} value={order.id}>{order.id} · {order.title}</option>)}
                </select>
              </div>
              {input('Failure date', 'failureDate', 'date')}
              {select('Cause category', 'causeCategory', categories)}
              {input('Failure mode', 'failureMode')}
              {input('Action owner', 'actionOwner')}
              {input('Action due date', 'dueDate', 'date')}
              {select('Status', 'status', statuses)}
            </div>
            {textarea('Symptoms / evidence', 'symptoms')}
            {textarea('Root cause', 'rootCause')}
            {textarea('Contributing factors', 'contributingFactors', 2)}
            {textarea('Corrective action', 'correctiveAction', 2)}
            {textarea('Preventive action', 'preventiveAction', 2)}
            <div className="flex justify-end gap-3 pt-2 border-t border-slate-800">
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-white px-4 py-2 rounded-lg text-sm">Cancel</button>
              <button onClick={save} disabled={saving || !form.assetId} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-6 py-2 rounded-lg text-sm font-medium">
                {saving ? 'Saving...' : 'Save analysis'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
