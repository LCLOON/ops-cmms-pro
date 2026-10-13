'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import DataTable, { type Column } from './DataTable';
import Modal from './Modal';

interface Item { id: string; siteId: string; obligationType: string; title: string; description: string; regulationRef: string; frequency: string; lastCompleted: string; nextDue: string; ownerRole: string; evidenceRequired: string; status: string; priority: string; notes: string; }

const defaultItem: Item = { id:'',siteId:'SITE-LOCK',obligationType:'dam_safety',title:'',description:'',regulationRef:'',frequency:'annual',lastCompleted:'',nextDue:'',ownerRole:'',evidenceRequired:'',status:'open',priority:'high',notes:'' };
const typeLabels: Record<string,string> = { dam_safety:'Dam Safety',ferc_license:'FERC License',fish_passage:'Fish Passage',environmental:'Environmental',water_quality:'Water Quality',public_safety:'Public Safety',eap:'EAP',dssmp:'DSSMP',nerc:'NERC',ot_cyber:'OT/Cyber',other:'Other' };
const sc: Record<string,string> = { open:'bg-blue-500/20 text-blue-400',in_progress:'bg-amber-500/20 text-amber-400',completed:'bg-green-500/20 text-green-400',overdue:'bg-red-500/20 text-red-400',waived:'bg-slate-500/20 text-slate-400' };
const siteNames: Record<string,string> = { 'SITE-LOCK':'Lockwood','SITE-KENN':'Hydro-Kennebec','SITE-SHAW':'Shawmut','SITE-WEST':'Weston' };

export default function CompliancePage() {
  const { canEdit, isAdmin } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [form, setForm] = useState<Item>(defaultItem);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('all');

  const fetchItems = useCallback(() => { fetch('/api/compliance').then(r => r.json()).then(setItems).catch(() => {}).finally(() => setLoading(false)); }, []);
  useEffect(() => { fetchItems(); }, [fetchItems]);

  const openNew = () => { setForm(defaultItem); setEditItem(null); setShowForm(true); };
  const openEdit = (item: Item) => { setForm({...item}); setEditItem(item); setShowForm(true); };
  const save = async () => { setSaving(true); try { const r = await fetch('/api/compliance', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(form) }); if(!r.ok){ alert((await r.json()).error); return; } setShowForm(false); fetchItems(); } finally { setSaving(false); } };
  const remove = async (item: Item) => { if(!confirm('Delete "'+item.title+'"?')) return; await fetch('/api/compliance', { method:'DELETE', headers:{'Content-Type':'application/json'}, body:JSON.stringify({id:item.id}) }); fetchItems(); };
  const update = (k: keyof Item, v: string) => setForm({...form, [k]: v});

  const filtered = filter==='all' ? items : filter==='overdue' ? items.filter(i => i.status==='overdue' || (i.nextDue && i.nextDue < new Date().toISOString().slice(0,10))) : items.filter(i => i.obligationType===filter);
  const typeCounts = items.reduce((acc,i) => { acc[i.obligationType]=(acc[i.obligationType]||0)+1; return acc; }, {} as Record<string,number>);
  const overdueCount = items.filter(i => i.status==='overdue' || (i.nextDue && i.nextDue < new Date().toISOString().slice(0,10))).length;

  const columns: Column<Item>[] = [
    { key:'title', header:'Obligation' },
    { key:'obligationType', header:'Type', render: o => <span className="text-xs">{typeLabels[o.obligationType]||o.obligationType}</span> },
    { key:'siteId', header:'Site', render: o => <span className="text-xs">{siteNames[o.siteId]||o.siteId}</span> },
    { key:'status', header:'Status', render: o => <span className={'inline-flex px-2 py-0.5 rounded-full text-xs font-medium border '+(sc[o.status]||'')}>{o.status.replace(/_/g,' ')}</span> },
    { key:'priority', header:'Priority' },
    { key:'nextDue', header:'Next Due' },
    { key:'frequency', header:'Freq' },
    { key:'ownerRole', header:'Owner' },
  ];

  if (loading) return <div className="text-slate-400 p-8">Loading...</div>;

  const f = (l: string, k: keyof Item, t='text') => (<div><label className="block text-xs text-slate-500 mb-1">{l}</label><input type={t} value={(form[k] as string)??''} onChange={e => update(k, e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>);
  const sl = (l: string, k: keyof Item, o: string[]) => (<div><label className="block text-xs text-slate-500 mb-1">{l}</label><select value={form[k] as string} onChange={e => update(k, e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm">{o.map(o2 => <option key={o2} value={o2}>{o2.replace(/_/g,' ')}</option>)}</select></div>);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between"><div><h2 className="text-xl font-bold text-white">FERC Compliance Calendar</h2><p className="text-slate-400 text-sm mt-1">Regulatory obligations across all 4 hydro facilities</p></div></div>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {[{k:'all',v:items.length},{k:'overdue',v:overdueCount},{k:'dam_safety',v:typeCounts.dam_safety||0},{k:'fish_passage',v:typeCounts.fish_passage||0},{k:'ferc_license',v:typeCounts.ferc_license||0},{k:'ot_cyber',v:typeCounts.ot_cyber||0},{k:'eap',v:typeCounts.eap||0}].map(t => (<button key={t.k} onClick={() => setFilter(t.k)} className={'rounded-lg p-3 text-center border transition-colors '+(filter===t.k ? 'bg-blue-600/20 border-blue-500/30 text-blue-400' : 'bg-slate-800/50 border-slate-700/50 text-slate-400 hover:border-slate-600')}><div className="text-lg font-bold">{t.v}</div><div className="text-xs">{(typeLabels[t.k]||t.k).replace(/_/g,' ')}</div></button>))}
      </div>
      <DataTable data={filtered} columns={columns} onEdit={canEdit ? openEdit : undefined} onDelete={isAdmin ? remove : undefined} onAdd={canEdit ? openNew : undefined} searchPlaceholder="Search obligations..." emptyMessage="No compliance obligations found." canEdit={canEdit} canDelete={isAdmin} />
      {showForm && (<Modal open={showForm} onClose={() => setShowForm(false)} title={editItem ? 'Edit Obligation' : 'New Obligation'}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {f('Title','title')}
            {sl('Site','siteId',['SITE-LOCK','SITE-KENN','SITE-SHAW','SITE-WEST'])}
            {sl('Type','obligationType',Object.keys(typeLabels))}
            {sl('Frequency','frequency',['daily','weekly','monthly','quarterly','semi_annual','annual','5-year','seasonal','as-needed'])}
            {f('Next Due','nextDue','date')}
            {f('Owner','ownerRole')}
            {sl('Status','status',['open','in_progress','completed','overdue','waived'])}
            {sl('Priority','priority',['critical','high','medium','low'])}
            {f('Regulation Ref','regulationRef')}
            {f('Evidence Required','evidenceRequired')}
          </div>
          <div><label className="block text-xs text-slate-500 mb-1">Description</label><textarea value={form.description} onChange={e => update('description', e.target.value)} rows={2} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" /></div>
          <div className="flex justify-end gap-3 pt-2"><button onClick={save} disabled={saving} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-6 py-2 rounded-lg text-sm font-medium">{saving?'Saving...':'Save'}</button></div>
        </div>
      </Modal>)}
    </div>
  );
}
