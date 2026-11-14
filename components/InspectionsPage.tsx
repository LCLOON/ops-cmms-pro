'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import DataTable, { type Column } from './DataTable';
import Modal from './Modal';
import { navigate, type NavParams } from '@/lib/nav';
import type { ComplianceObligation, Site } from '@/lib/types';

interface Item {
  id: string; siteId: string; assetId: string; complianceObligationId: string; workOrderId?: string;
  inspectionType: string; title: string; description: string; scheduledDate: string; completedDate: string;
  inspector: string; findings: string; recommendations: string; correctiveActions: string;
  readings: string; photos: string; status: string; priority: string; createdAt: string; updatedAt: string;
}
interface AssetOption { id: string; name: string; siteId?: string; }

const defaultItem = (): Item => ({
  id: '', siteId: '', assetId: '', complianceObligationId: '', workOrderId: '',
  inspectionType: 'visual', title: '', description: '',
  scheduledDate: new Date().toISOString().slice(0, 10), completedDate: '',
  inspector: '', findings: '', recommendations: '', correctiveActions: '',
  readings: '', photos: '', status: 'scheduled', priority: 'medium',
  createdAt: '', updatedAt: '',
});
const statusColors: Record<string,string> = { scheduled:'bg-blue-500/20 text-blue-400',in_progress:'bg-amber-500/20 text-amber-400',completed:'bg-green-500/20 text-green-400',deficient:'bg-red-500/20 text-red-400',overdue:'bg-red-500/20 text-red-400' };
const itypes = ['visual','detailed','regulatory','dam_safety','fish_passage','substation','safety','other'];
const istats = ['scheduled','in_progress','completed','deficient','overdue'];
const prios = ['critical','high','medium','low'];

export default function InspectionsPage({ params }: { params?: NavParams }) {
  const { canEdit, isAdmin } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [assets, setAssets] = useState<AssetOption[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [obligations, setObligations] = useState<ComplianceObligation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [form, setForm] = useState<Item>(defaultItem);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('all');

  const fetchItems = useCallback(() => {
    fetch('/api/inspections')
      .then(response => { if (!response.ok) throw new Error(`Inspections request failed (${response.status})`); return response.json(); })
      .then((rows: Item[]) => { if (!Array.isArray(rows)) throw new Error('Inspections response was not a list'); setItems(rows); setLoadError(false); })
      .catch(error => { console.error('[inspections] Failed to load inspections', error); setLoadError(true); })
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { fetchItems(); }, [fetchItems]);
  useEffect(() => {
    Promise.all([
      fetch('/api/assets').then(response => { if (!response.ok) throw new Error(`Assets request failed (${response.status})`); return response.json(); }),
      fetch('/api/config?type=sites').then(response => { if (!response.ok) throw new Error(`Sites request failed (${response.status})`); return response.json(); }),
      fetch('/api/compliance').then(response => { if (!response.ok) throw new Error(`Compliance request failed (${response.status})`); return response.json(); }),
    ]).then(([assetRows, siteData, obligationRows]) => {
      if (Array.isArray(assetRows)) setAssets(assetRows);
      if (Array.isArray(siteData.sites)) setSites(siteData.sites);
      if (Array.isArray(obligationRows)) setObligations(obligationRows);
    }).catch(error => console.error('[inspections] Failed to load relationship options', error));
  }, []);

  const openNew = () => {
    const asset = assets.find(item => item.id === params?.assetId);
    setForm({ ...defaultItem(), assetId: asset?.id ?? '', siteId: asset?.siteId ?? '' });
    setEditItem(null);
    setShowForm(true);
  };
  const openEdit = (item: Item) => { setForm({...item}); setEditItem(item); setShowForm(true); };
  const save = async () => { setSaving(true); try { const r = await fetch('/api/inspections', { method: 'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(form) }); if(!r.ok){ alert((await r.json()).error); return; } setShowForm(false); fetchItems(); } finally { setSaving(false); } };
  const remove = async (item: Item) => {
    if (!confirm(`Delete "${item.title}"?`)) return;
    const response = await fetch('/api/inspections', { method:'DELETE', headers:{'Content-Type':'application/json'}, body:JSON.stringify({id:item.id}) });
    if (!response.ok) { alert((await response.json()).error); return; }
    fetchItems();
  };
  const update = (k: keyof Item, v: string) => setForm({...form, [k]: v});

  const assetName = (id: string) => assets.find(asset => asset.id === id)?.name ?? id;
  const siteName = (id: string) => sites.find(site => site.id === id)?.name ?? id;
  const visibleItems = params?.assetId ? items.filter(item => item.assetId === params.assetId) : items;
  const filtered = filter==='all' ? visibleItems : visibleItems.filter(i => i.status===filter);
  const raiseWorkOrder = (item: Item) => navigate('work-orders', {
    assetId: item.assetId,
    workOrderDraft: {
      title: `Corrective work from inspection: ${item.title}`,
      description: [
        `Inspection status: ${item.status}.`,
        item.findings ? `Findings: ${item.findings}` : '',
        item.recommendations ? `Recommendations: ${item.recommendations}` : '',
        item.correctiveActions ? `Corrective actions: ${item.correctiveActions}` : '',
      ].filter(Boolean).join('\n'),
      type: 'corrective',
      siteId: item.siteId,
      sourceInspectionId: item.id,
    },
  });
  const columns: Column<Item>[] = [
    { key:'title', header:'Inspection' },
    { key:'inspectionType', header:'Type', render: i => <span className="capitalize text-xs">{i.inspectionType.replace(/_/g,' ')}</span> },
    { key:'status', header:'Status', render: i => <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${statusColors[i.status]||''}`}>{i.status.replace(/_/g,' ')}</span> },
    { key:'priority', header:'Priority' },
    { key:'scheduledDate', header:'Scheduled' },
    { key:'completedDate', header:'Completed' },
    { key:'inspector', header:'Inspector' },
    { key:'siteId', header:'Site', render: item => item.siteId ? siteName(item.siteId) : <span className="text-slate-600">-</span> },
    { key:'complianceObligationId', header:'Compliance', render: item => obligations.find(obligation => obligation.id === item.complianceObligationId)?.title || <span className="text-slate-600">-</span> },
    { key:'assetId', header:'Asset', render: i => i.assetId ? (
      <button onClick={() => navigate('assets', { focusId: i.assetId })} className="text-blue-400 hover:text-blue-300 hover:underline text-xs" title="Open this asset">{assetName(i.assetId)}</button>
    ) : <span className="text-slate-600">-</span> },
    { key:'workOrderId', header:'Work order', render: item => item.workOrderId ? (
      <button onClick={() => navigate('work-orders', { focusId: item.workOrderId })}
        className="text-blue-400 hover:text-blue-300 hover:underline text-xs">{item.workOrderId}</button>
    ) : <span className="text-slate-600">-</span> },
    { key:'followUp', header:'Follow-up', render: item => ['deficient', 'overdue'].includes(item.status) ? (
      item.workOrderId
        ? <span className="text-xs text-green-400">Work order linked</span>
        : canEdit && (item.assetId || item.siteId)
          ? <button onClick={() => raiseWorkOrder(item)} className="text-amber-300 hover:text-amber-200 underline text-xs">Raise corrective WO</button>
          : <span className="text-xs text-slate-500">Link a site or asset first</span>
    ) : <span className="text-slate-600">-</span> },
  ];

  if (loading) return <div className="text-slate-400 p-8">Loading...</div>;

  const f = (l: string, k: keyof Item, t='text') => (<div><label className="block text-xs text-slate-500 mb-1">{l}</label><input type={t} value={(form[k] as string)??''} onChange={e => update(k, e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>);
  const s = (l: string, k: keyof Item, o: string[]) => (<div><label className="block text-xs text-slate-500 mb-1">{l}</label><select value={form[k] as string} onChange={e => update(k, e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm">{o.map(o2 => <option key={o2} value={o2}>{o2.replace(/_/g,' ')}</option>)}</select></div>);
  const scopedAssets = assets.filter(asset => !form.siteId || !asset.siteId || asset.siteId === form.siteId);
  const scopedObligations = obligations.filter(obligation => !form.siteId || !obligation.siteId || obligation.siteId === form.siteId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between"><div><h2 className="text-xl font-bold text-white">Inspections</h2><p className="text-slate-400 text-sm mt-1">Dam safety, regulatory, fish passage, substation, and safety inspections</p></div></div>
      <div className="flex gap-3 flex-wrap">{['all','scheduled','in_progress','completed','deficient','overdue'].map(st => (<button key={st} onClick={() => setFilter(st)} className={`px-4 py-2 rounded-lg text-sm border transition-colors ${filter===st?'bg-blue-600/20 border-blue-500/30 text-blue-400':'bg-slate-800/50 border-slate-700/50 text-slate-400'}`}>{st==='all'?'All':st.replace(/_/g,' ')} ({st==='all'?visibleItems.length:visibleItems.filter(i=>i.status===st).length})</button>))}</div>
      {loadError && <p className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">Could not load inspections. Refresh to try again.</p>}
      <DataTable data={filtered} columns={columns} onEdit={canEdit ? openEdit : undefined} onDelete={isAdmin ? remove : undefined} onAdd={canEdit ? openNew : undefined} searchPlaceholder="Search inspections..." emptyMessage="No inspections recorded." canEdit={canEdit} canDelete={isAdmin} initialSearch={params?.search ?? ''} highlightId={params?.focusId} />
      {showForm && (<Modal open={showForm} onClose={() => setShowForm(false)} title={editItem ? 'Edit Inspection' : 'New Inspection'}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {f('Title','title')}
            {s('Type','inspectionType',itypes)}
            <div><label className="block text-xs text-slate-500 mb-1">Site</label>
              <select value={form.siteId} onChange={event => {
                const siteId = event.target.value;
                const asset = assets.find(item => item.id === form.assetId);
                const obligation = obligations.find(item => item.id === form.complianceObligationId);
                setForm({
                  ...form,
                  siteId,
                  assetId: asset && (!asset.siteId || asset.siteId === siteId) ? asset.id : '',
                  complianceObligationId: obligation && (!obligation.siteId || obligation.siteId === siteId) ? obligation.id : '',
                });
              }} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm">
                <option value="">Unassigned / inferred</option>
                {sites.map(site => <option key={site.id} value={site.id}>{site.name}</option>)}
              </select>
            </div>
            <div><label className="block text-xs text-slate-500 mb-1">Asset</label>
              <select value={form.assetId} onChange={event => {
                const asset = assets.find(item => item.id === event.target.value);
                const siteId = asset?.siteId || form.siteId;
                const obligation = obligations.find(item => item.id === form.complianceObligationId);
                setForm({
                  ...form,
                  assetId: asset?.id ?? '',
                  siteId,
                  complianceObligationId: obligation && obligation.siteId && siteId && obligation.siteId !== siteId ? '' : form.complianceObligationId,
                });
              }} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm">
                <option value="">No asset (site-level)</option>
                {scopedAssets.map(asset => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
              </select>
            </div>
            <div><label className="block text-xs text-slate-500 mb-1">Compliance obligation</label>
              <select value={form.complianceObligationId} onChange={event => {
                const obligation = obligations.find(item => item.id === event.target.value);
                const siteId = obligation?.siteId || form.siteId;
                const asset = assets.find(item => item.id === form.assetId);
                setForm({
                  ...form,
                  complianceObligationId: obligation?.id ?? '',
                  siteId,
                  assetId: asset && asset.siteId && siteId && asset.siteId !== siteId ? '' : form.assetId,
                });
              }} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm">
                <option value="">No linked obligation</option>
                {scopedObligations.map(obligation => <option key={obligation.id} value={obligation.id}>
                  {obligation.title}{obligation.siteId ? ` · ${siteName(obligation.siteId)}` : ''}
                </option>)}
              </select>
            </div>
            {f('Scheduled Date','scheduledDate','date')}
            {f('Completed Date','completedDate','date')}
            {f('Inspector','inspector')}
            {s('Status','status',istats)}
            {s('Priority','priority',prios)}
          </div>
          <div><label className="block text-xs text-slate-500 mb-1">Findings</label><textarea value={form.findings} onChange={e => update('findings', e.target.value)} rows={3} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" /></div>
          <div><label className="block text-xs text-slate-500 mb-1">Recommendations</label><textarea value={form.recommendations} onChange={e => update('recommendations', e.target.value)} rows={2} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" /></div>
          <div><label className="block text-xs text-slate-500 mb-1">Corrective Actions</label><textarea value={form.correctiveActions} onChange={e => update('correctiveActions', e.target.value)} rows={2} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" /></div>
          <div className="flex justify-end gap-3 pt-2"><button onClick={save} disabled={saving} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-6 py-2 rounded-lg text-sm font-medium">{saving?'Saving...':'Save'}</button></div>
        </div>
      </Modal>)}
    </div>
  );
}
