'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import DataTable, { type Column } from './DataTable';
import Modal from './Modal';

interface Item { id: string; assetId: string; documentType: string; title: string; description: string; fileUrl: string; version: string; reviewDueDate: string; tags: string; active: boolean; }

const defaultItem: Item = { id:'',assetId:'',documentType:'other',title:'',description:'',fileUrl:'',version:'1.0',reviewDueDate:'',tags:'',active:true };
const dtypeLabels: Record<string,string> = { om_manual:'O&M Manual',drawing:'Drawing',one_line:'One-Line',relay_settings:'Relay Settings',plc_backup:'PLC Backup',sop:'SOP',eap:'EAP',loto:'LOTO',inspection_report:'Inspection Report',test_report:'Test Report',photo:'Photo',certification:'Certification',other:'Other' };
const dtypes = Object.keys(dtypeLabels);

export default function DocumentPage() {
  const { canEdit, isAdmin } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [form, setForm] = useState<Item>(defaultItem);
  const [saving, setSaving] = useState(false);

  const fetchItems = useCallback(() => {
    fetch('/api/documents').then(r => r.json()).then(setItems).catch(() => {}).finally(() => setLoading(false));
  }, []);
  useEffect(() => { fetchItems(); }, [fetchItems]);

  const openNew = () => { setForm(defaultItem); setEditItem(null); setShowForm(true); };
  const openEdit = (item: Item) => { setForm({...item}); setEditItem(item); setShowForm(true); };
  const save = async () => { setSaving(true); try { const method = 'POST'; const r = await fetch('/api/documents', { method, headers:{'Content-Type':'application/json'}, body:JSON.stringify(form) }); if(!r.ok){ alert((await r.json()).error); return; } setShowForm(false); fetchItems(); } finally { setSaving(false); } };
  const remove = async (item: Item) => { if(!confirm('Delete "'+item.title+'"?')) return; await fetch('/api/documents', { method:'DELETE', headers:{'Content-Type':'application/json'}, body:JSON.stringify({id:item.id}) }); fetchItems(); };
  const update = (k: keyof Item, v: Item[keyof Item]) => setForm({...form, [k]: v});

  const columns: Column<Item>[] = [
    { key:'title', header:'Title' },
    { key:'documentType', header:'Type', render: d => <span className="text-xs">{dtypeLabels[d.documentType]||d.documentType}</span> },
    { key:'version', header:'Ver' },
    { key:'reviewDueDate', header:'Review Due' },
    { key:'assetId', header:'Asset' },
    { key:'tags', header:'Tags' },
  ];

  if (loading) return <div className="text-slate-400 p-8">Loading...</div>;

  const f = (l: string, k: keyof Item, t='text') => (<div><label className="block text-xs text-slate-500 mb-1">{l}</label><input type={t} value={(form[k] as string)??''} onChange={e => update(k, e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>);
  const s = (l: string, k: keyof Item, o: string[]) => (<div><label className="block text-xs text-slate-500 mb-1">{l}</label><select value={form[k] as string} onChange={e => update(k, e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm">{o.map(o2 => <option key={o2} value={o2}>{dtypeLabels[o2]||o2.replace(/_/g,' ')}</option>)}</select></div>);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between"><div><h2 className="text-xl font-bold text-white">Document Library</h2><p className="text-slate-400 text-sm mt-1">O&M manuals, drawings, one-lines, SOPs, EAPs, LOTO procedures, test reports</p></div></div>
      <DataTable data={items} columns={columns} onEdit={canEdit ? openEdit : undefined} onDelete={isAdmin ? remove : undefined} onAdd={canEdit ? openNew : undefined} searchPlaceholder="Search documents..." emptyMessage="No documents found." canEdit={canEdit} canDelete={isAdmin} />
      {showForm && (<Modal open={showForm} onClose={() => setShowForm(false)} title={editItem ? 'Edit Document' : 'New Document'}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {f('Title','title')}
            {s('Type','documentType',dtypes)}
            {f('Version','version')}
            {f('File URL','fileUrl')}
            {f('Asset ID','assetId')}
            {f('Review Due','reviewDueDate','date')}
            {f('Tags','tags')}
          </div>
          <div><label className="block text-xs text-slate-500 mb-1">Description</label><textarea value={form.description} onChange={e => update('description', e.target.value)} rows={3} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" /></div>
          <div className="flex justify-end gap-3 pt-2"><button onClick={save} disabled={saving} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-6 py-2 rounded-lg text-sm font-medium">{saving?'Saving...':'Save'}</button></div>
        </div>
      </Modal>)}
    </div>
  );
}
