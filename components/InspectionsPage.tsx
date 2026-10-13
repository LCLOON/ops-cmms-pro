'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import DataTable, { type Column } from './DataTable';
import Modal from './Modal';

interface Item { id: string; assetId: string; complianceObligationId: string; inspectionType: string; title: string; description: string; scheduledDate: string; completedDate: string; inspector: string; findings: string; recommendations: string; correctiveActions: string; status: string; priority: string; }

const defaultItem: Item = { id:'',assetId:'',complianceObligationId:'',inspectionType:'visual',title:'',description:'',scheduledDate:new Date().toISOString().slice(0,10),completedDate:'',inspector:'',findings:'',recommendations:'',correctiveActions:'',status:'scheduled',priority:'medium' };
const statusColors: Record<string,string> = { scheduled:'bg-blue-500/20 text-blue-400',in_progress:'bg-amber-500/20 text-amber-400',completed:'bg-green-500/20 text-green-400',deficient:'bg-red-500/20 text-red-400',overdue:'bg-red-500/20 text-red-400' };
const itypes = ['visual','detailed','regulatory','dam_safety','fish_passage','substation','safety','other'];
const istats = ['scheduled','in_progress','completed','deficient','overdue'];
const prios = ['critical','high','medium','low'];

export default function InspectionsPage() {
  const { canEdit, isAdmin } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [form, setForm] = useState<Item>(defaultItem);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('all');

  const fetchItems = useCallback(() => {
    fetch('/api/inspections').then(r => r.json()).then(setItems).catch(() => {}).finally(() => setLoading(false));
  }, []);
  useEffect(() => { fetchItems(); }, [fetchItems]);

  const openNew = () => { setForm(defaultItem); setEditItem(null); setShowForm(true); };
  const openEdit = (item: Item) => { setForm({...item}); setEditItem(item); setShowForm(true); };
  const save = async () => { setSaving(true); try { const method = 'POST'; const r = await fetch('/api/inspections', { method, headers:{'Content-Type':'application/json'}, body:JSON.stringify(form) }); if(!r.ok){ alert((await r.json()).error); return; } setShowForm(false); fetchItems(); } finally { setSaving(false); } };
  const remove = async (item: Item) => { if(!confirm('Delete "'+item.title+'"?')) return; await fetch('/api/inspections', { method:'DELETE', headers:{'Content-Type':'application/json'}, body:JSON.stringify({id:item.id}) }); fetchItems(); };
  const update = (k: keyof Item, v: string) => setForm({...form, [k]: v});

  const filtered = filter==='all' ? items : items.filter(i => i.status===filter);
  const columns: Column<Item>[] = [
    { key:'title', header:'Inspection' },
    { key:'inspectionType', header:'Type', render: i => <span className="capitalize text-xs">{i.inspectionType.replace(/_/g,' ')}</span> },
    { key:'status', header:'Status', render: i => <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${statusColors[i.status]||''}`}>{i.status.replace(/_/g,' ')}</span> },
    { key:'priority', header:'Priority' },
    { key:'scheduledDate', header:'Scheduled' },
    { key:'completedDate', header:'Completed' },
    { key:'inspector', header:'Inspector' },
    { key:'assetId', header:'Asset' },
  ];

  if (loading) return <div className="text-slate-400 p-8">Loading...</div>;

  const f = (l: string, k: keyof Item, t='text') => (<div><label className="block text-xs text-slate-500 mb-1">{l}</label><input type={t} value={(form[k] as string)??''} onChange={e => update(k, e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>);
  const s = (l: string, k: keyof Item, o: string[]) => (<div><label className="block text-xs text-slate-500 mb-1">{l}</label><select value={form[k] as string} onChange={e => update(k, e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm">{o.map(o2 => <option key={o2} value={o2}>{o2.replace(/_/g,' ')}</option>)}</select></div>);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between"><div><h2 className="text-xl font-bold text-white">Inspections</h2><p className="text-slate-400 text-sm mt-1">Dam safety, regulatory, fish passage, substation, and safety inspections</p></div></div>
      <div className="flex gap-3 flex-wrap">{['all','scheduled','in_progress','completed','deficient','overdue'].map(st => (<button key={st} onClick={() => setFilter(st)} className={`px-4 py-2 rounded-lg text-sm border transition-colors ${filter===st?'bg-blue-600/20 border-blue-500/30 text-blue-400':'bg-slate-800/50 border-slate-700/50 text-slate-400'}`}>{st==='all'?'All':st.replace(/_/g,' ')} ({st==='all'?items.length:items.filter(i=>i.status===st).length})</button>))}</div>
      <DataTable data={filtered} columns={columns} onEdit={canEdit ? openEdit : undefined} onDelete={isAdmin ? remove : undefined} onAdd={canEdit ? openNew : undefined} searchPlaceholder="Search inspections..." emptyMessage="No inspections recorded." canEdit={canEdit} canDelete={isAdmin} />
      {showForm && (<Modal open={showForm} onClose={() => setShowForm(false)} title={editItem ? 'Edit Inspection' : 'New Inspection'}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {f('Title','title')}
            {s('Type','inspectionType',itypes)}
            {f('Asset ID','assetId')}
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
