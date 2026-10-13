'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import DataTable, { type Column } from './DataTable';
import Modal from './Modal';

interface Item { id: string; assetId: string; testType: string; testDate: string; results: string; nextDue: string; testedBy: string; status: string; notes: string; }

const defaultItem: Item = { id:'',assetId:'',testType:'other',testDate:new Date().toISOString().slice(0,10),results:'',nextDue:'',testedBy:'',status:'pending',notes:'' };
const ttypes = ['transformer_oil','dga','breaker_timing','relay_test','battery_test','charger_test','ir_scan','ground_test','cable_test','protection_settings','other'];
const tstatus = ['pending','passed','failed','attention'];
const sc: Record<string,string> = { pending:'bg-blue-500/20 text-blue-400',passed:'bg-green-500/20 text-green-400',failed:'bg-red-500/20 text-red-400',attention:'bg-amber-500/20 text-amber-400' };

export default function ElectricalTestsPage() {
  const { canEdit, isAdmin } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [form, setForm] = useState<Item>(defaultItem);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('all');

  const fetchItems = useCallback(() => {
    fetch('/api/electrical-tests').then(r => r.json()).then(setItems).catch(() => {}).finally(() => setLoading(false));
  }, []);
  useEffect(() => { fetchItems(); }, [fetchItems]);

  const openNew = () => { setForm(defaultItem); setEditItem(null); setShowForm(true); };
  const openEdit = (item: Item) => { setForm({...item}); setEditItem(item); setShowForm(true); };
  const save = async () => { setSaving(true); try { const method = 'POST'; const r = await fetch('/api/electrical-tests', { method, headers:{'Content-Type':'application/json'}, body:JSON.stringify(form) }); if(!r.ok){ alert((await r.json()).error); return; } setShowForm(false); fetchItems(); } finally { setSaving(false); } };
  const remove = async (item: Item) => { if(!confirm('Delete test?')) return; await fetch('/api/electrical-tests', { method:'DELETE', headers:{'Content-Type':'application/json'}, body:JSON.stringify({id:item.id}) }); fetchItems(); };
  const update = (k: keyof Item, v: string) => setForm({...form, [k]: v});

  const filtered = filter==='all' ? items : items.filter(i => i.status===filter);
  const columns: Column<Item>[] = [
    { key:'testType', header:'Test', render: t => <span className="capitalize text-xs">{t.testType.replace(/_/g,' ')}</span> },
    { key:'assetId', header:'Asset' },
    { key:'status', header:'Status', render: t => <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${sc[t.status]||''}`}>{t.status}</span> },
    { key:'testDate', header:'Date' },
    { key:'nextDue', header:'Next Due' },
    { key:'testedBy', header:'Tested By' },
    { key:'results', header:'Results' },
  ];

  if (loading) return <div className="text-slate-400 p-8">Loading...</div>;

  const f = (l: string, k: keyof Item, t='text') => (<div><label className="block text-xs text-slate-500 mb-1">{l}</label><input type={t} value={(form[k] as string)??''} onChange={e => update(k, e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>);
  const s = (l: string, k: keyof Item, o: string[]) => (<div><label className="block text-xs text-slate-500 mb-1">{l}</label><select value={form[k] as string} onChange={e => update(k, e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm">{o.map(o2 => <option key={o2} value={o2}>{o2.replace(/_/g,' ')}</option>)}</select></div>);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between"><div><h2 className="text-xl font-bold text-white">Electrical Tests</h2><p className="text-slate-400 text-sm mt-1">Transformer oil, DGA, breaker timing, relay testing, battery, IR scans, grounding</p></div></div>
      <div className="flex gap-3 flex-wrap">{['all','passed','failed','attention','pending'].map(st => (<button key={st} onClick={() => setFilter(st)} className={`px-4 py-2 rounded-lg text-sm border ${filter===st?'bg-blue-600/20 border-blue-500/30 text-blue-400':'bg-slate-800/50 border-slate-700/50 text-slate-400'}`}>{st==='all'?'All':st} ({st==='all'?items.length:items.filter(i=>i.status===st).length})</button>))}</div>
      <DataTable data={filtered} columns={columns} onEdit={canEdit ? openEdit : undefined} onDelete={isAdmin ? remove : undefined} onAdd={canEdit ? openNew : undefined} searchPlaceholder="Search tests..." emptyMessage="No electrical tests recorded." canEdit={canEdit} canDelete={isAdmin} />
      {showForm && (<Modal open={showForm} onClose={() => setShowForm(false)} title={editItem ? 'Edit Test' : 'New Test'}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {s('Test Type','testType',ttypes)}
            {f('Asset ID','assetId')}
            {f('Test Date','testDate','date')}
            {f('Next Due','nextDue','date')}
            {f('Tested By','testedBy')}
            {s('Status','status',tstatus)}
            {f('Results','results')}
          </div>
          <div><label className="block text-xs text-slate-500 mb-1">Notes</label><textarea value={form.notes} onChange={e => update('notes', e.target.value)} rows={3} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" /></div>
          <div className="flex justify-end gap-3 pt-2"><button onClick={save} disabled={saving} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-6 py-2 rounded-lg text-sm font-medium">{saving?'Saving...':'Save'}</button></div>
        </div>
      </Modal>)}
    </div>
  );
}
