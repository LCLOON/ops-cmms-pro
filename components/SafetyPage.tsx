'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import DataTable, { type Column } from './DataTable';
import Modal from './Modal';

interface Item { id: string; workOrderId: string; assetId: string; permitType: string; permitNumber: string; issuedBy: string; issuedDate: string; expiryDate: string; status: string; description: string; hazards: string; precautions: string; approvedBy: string; }

const defaultItem: Item = { id:'',workOrderId:'',assetId:'',permitType:'loto',permitNumber:'',issuedBy:'',issuedDate:new Date().toISOString().slice(0,10),expiryDate:'',status:'draft',description:'',hazards:'',precautions:'',approvedBy:'' };
const statusColors: Record<string,string> = { draft:'bg-slate-500/20 text-slate-400',issued:'bg-blue-500/20 text-blue-400',active:'bg-green-500/20 text-green-400',closed:'bg-slate-500/20 text-slate-300',expired:'bg-red-500/20 text-red-400',cancelled:'bg-red-500/20 text-red-400' };
const ptypes = ['loto','confined_space','hot_work','excavation','diving','crane','working_at_heights','other'];
const pstats = ['draft','issued','active','closed','expired','cancelled'];

export default function SafetyPage() {
  const { canEdit, isAdmin } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [form, setForm] = useState<Item>(defaultItem);
  const [saving, setSaving] = useState(false);

  const fetchItems = useCallback(() => {
    fetch('/api/safety').then(r => r.json()).then(setItems).catch(() => {}).finally(() => setLoading(false));
  }, []);
  useEffect(() => { fetchItems(); }, [fetchItems]);

  const openNew = () => { setForm(defaultItem); setEditItem(null); setShowForm(true); };
  const openEdit = (item: Item) => { setForm({...item}); setEditItem(item); setShowForm(true); };
  const save = async () => { setSaving(true); try { const method = 'POST'; const r = await fetch('/api/safety', { method, headers:{'Content-Type':'application/json'}, body:JSON.stringify(form) }); if(!r.ok){ alert((await r.json()).error); return; } setShowForm(false); fetchItems(); } finally { setSaving(false); } };
  const remove = async (item: Item) => { if(!confirm('Delete permit '+item.permitNumber+'?')) return; await fetch('/api/safety', { method:'DELETE', headers:{'Content-Type':'application/json'}, body:JSON.stringify({id:item.id}) }); fetchItems(); };
  const update = (k: keyof Item, v: string) => setForm({...form, [k]: v});

  const columns: Column<Item>[] = [
    { key:'permitType', header:'Type', render: p => <span className="capitalize">{p.permitType.replace(/_/g,' ')}</span> },
    { key:'permitNumber', header:'Permit #' },
    { key:'description', header:'Description' },
    { key:'assetId', header:'Asset' },
    { key:'workOrderId', header:'WO' },
    { key:'status', header:'Status', render: p => <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${statusColors[p.status]||''}`}>{p.status}</span> },
    { key:'issuedDate', header:'Issued' },
    { key:'expiryDate', header:'Expires' },
  ];

  if (loading) return <div className="text-slate-400 p-8">Loading...</div>;

  const f = (label: string, key: keyof Item, type='text') => (
    <div><label className="block text-xs text-slate-500 mb-1">{label}</label>
      <input type={type} value={(form[key] as string)??''} onChange={e => update(key, e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
  );
  const s = (label: string, key: keyof Item, opts: string[]) => (
    <div><label className="block text-xs text-slate-500 mb-1">{label}</label>
      <select value={form[key] as string} onChange={e => update(key, e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">{opts.map(o => <option key={o} value={o}>{o.replace(/_/g,' ')}</option>)}</select></div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between"><div><h2 className="text-xl font-bold text-white">Safety Permits</h2><p className="text-slate-400 text-sm mt-1">LOTO, confined space, hot work, excavation, diving, crane, working-at-heights</p></div></div>
      <DataTable data={items} columns={columns} onEdit={canEdit ? openEdit : undefined} onDelete={isAdmin ? remove : undefined} onAdd={canEdit ? openNew : undefined} searchPlaceholder="Search permits..." emptyMessage="No safety permits found." canEdit={canEdit} canDelete={isAdmin} />
      {showForm && (<Modal open={showForm} onClose={() => setShowForm(false)} title={editItem ? 'Edit Permit' : 'New Permit'}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {s('Type','permitType',ptypes)}
            {f('Permit #','permitNumber')}
            {f('Description','description')}
            {f('Asset ID','assetId')}
            {f('WO ID','workOrderId')}
            {f('Issued By','issuedBy')}
            {f('Issued Date','issuedDate','date')}
            {f('Expiry Date','expiryDate','date')}
            {s('Status','status',pstats)}
            {f('Approved By','approvedBy')}
          </div>
          <div className="grid grid-cols-1 gap-2">
            <div><label className="block text-xs text-slate-500 mb-1">Hazards</label><textarea value={form.hazards} onChange={e => update('hazards', e.target.value)} rows={2} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" /></div>
            <div><label className="block text-xs text-slate-500 mb-1">Precautions</label><textarea value={form.precautions} onChange={e => update('precautions', e.target.value)} rows={2} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" /></div>
          </div>
          <div className="flex justify-end gap-3 pt-2"><button onClick={save} disabled={saving} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-6 py-2 rounded-lg text-sm font-medium">{saving?'Saving...':'Save'}</button></div>
        </div>
      </Modal>)}
    </div>
  );
}
