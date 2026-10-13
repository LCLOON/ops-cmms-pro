'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import DataTable, { type Column } from './DataTable';
import Modal from './Modal';
import { Trash2, Plus, Package, Clock, ListChecks } from 'lucide-react';

interface WorkOrder {
  id: string; assetId: string; title: string; description: string;
  type: string; priority: string; status: string; assignedTo: string;
  requestedBy: string; dueDate: string; completedDate: string;
  laborHours: number; partsCost: number; resolution: string;
  createdAt: string; updatedAt: string;
}
interface WoPart { id: number; workOrderId: string; inventoryItemId: string; inventoryName: string; partNumber: string; quantity: number; unitCost: number; }
interface WoLabor { id: number; workOrderId: string; userId: number; username: string; hours: number; loggedDate: string; notes: string; }
interface InventoryItem { id: string; name: string; partNumber: string; unitCost: number; }

const defaultWO: WorkOrder = {
  id: '', assetId: '', title: '', description: '', type: 'corrective',
  priority: 'medium', status: 'open', assignedTo: '', requestedBy: '',
  dueDate: '', completedDate: '', laborHours: 0, partsCost: 0, resolution: '',
  createdAt: '', updatedAt: '',
};

const TRANSITIONS: Record<string, string[]> = {
  open: ['in_progress', 'cancelled'], in_progress: ['on_hold', 'completed', 'cancelled'],
  on_hold: ['in_progress', 'cancelled'], completed: [], cancelled: [],
};
const statusColors: Record<string, string> = {
  open: 'bg-blue-500/20 text-blue-400 border-blue-500/30', in_progress: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  on_hold: 'bg-slate-500/20 text-slate-400 border-slate-500/30', completed: 'bg-green-500/20 text-green-400 border-green-500/30',
  cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
};
const priorityColors: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-400 border-red-500/30', high: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  medium: 'bg-blue-500/20 text-blue-400 border-blue-500/30', low: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
};

export default function WorkOrderPage() {
  const { canEdit, loading: authLoading } = useAuth();
  const [items, setItems] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [editItem, setEditItem] = useState<WorkOrder | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<WorkOrder>(defaultWO);
  const [saving, setSaving] = useState(false);

  const fetchItems = useCallback(() => {
    fetch('/api/work-orders').then(r => r.json()).then(setItems).catch(() => {}).finally(() => setLoading(false));
  }, []);
  useEffect(() => { if (!authLoading) fetchItems(); }, [authLoading, fetchItems]);

  const openNew = () => { setForm(defaultWO); setEditItem(null); setShowForm(true); };
  const openEdit = (item: WorkOrder) => { setForm({ ...item }); setEditItem(item); setShowForm(true); };

  const save = async () => {
    setSaving(true);
    try {
      const method = editItem ? 'PUT' : 'POST';
      const r = await fetch('/api/work-orders', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if (!r.ok) { alert((await r.json()).error); return; }
      setShowForm(false); fetchItems();
    } finally { setSaving(false); }
  };

  const transition = async (wo: WorkOrder, newStatus: string) => {
    const r = await fetch('/api/work-orders/transition', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: wo.id, status: newStatus }) });
    if (r.ok) fetchItems(); else alert((await r.json()).error);
  };
  const remove = async (item: WorkOrder) => {
    if (!confirm(`Delete WO "${item.title}"?`)) return;
    await fetch('/api/work-orders', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.id }) });
    fetchItems();
  };

  const columns: Column<WorkOrder>[] = [
    { key: 'id', header: 'WO #' },
    { key: 'title', header: 'Title' },
    { key: 'status', header: 'Status', render: w => (
      <div className="flex items-center gap-1">
        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${statusColors[w.status] || ''}`}>{w.status.replace('_', ' ')}</span>
        {(TRANSITIONS[w.status] || []).length > 0 && canEdit && (
          <select className="bg-slate-800 border border-slate-600 rounded text-xs text-slate-300 px-1 py-0.5" value="" onChange={e => { if (e.target.value) transition(w, e.target.value); }}>
            <option value="">→</option>
            {TRANSITIONS[w.status].map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
        )}
      </div>
    )},
    { key: 'priority', header: 'Priority', render: w => <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${priorityColors[w.priority] || ''}`}>{w.priority}</span> },
    { key: 'type', header: 'Type', render: w => <span className="capitalize">{w.type}</span> },
    { key: 'assignedTo', header: 'Assigned To' },
    { key: 'dueDate', header: 'Due Date' },
    { key: 'laborHours', header: 'Hours' },
    { key: 'partsCost', header: 'Parts $', render: w => <span className="font-mono">${w.partsCost.toFixed(2)}</span> },
  ];

  if (loading) return <div className="text-slate-400 p-8">Loading work orders...</div>;
  return (
    <div className="space-y-6">
      <div><h2 className="text-xl font-bold text-white">Work Orders</h2><p className="text-slate-400 text-sm mt-1">Create, assign, and track maintenance work orders</p></div>
      <DataTable data={items} columns={columns} onEdit={openEdit} onDelete={canEdit ? remove : undefined} onAdd={canEdit ? openNew : undefined}
        searchPlaceholder="Search work orders..." canEdit={canEdit} canDelete={canEdit} emptyMessage="No work orders found." />
      {showForm && (
        <Modal open={showForm} onClose={() => setShowForm(false)} title={editItem ? `Edit WO: ${editItem.id}` : 'New Work Order'}>
          <WOForm form={form} setForm={setForm} onSave={save} saving={saving} isEdit={!!editItem} />
        </Modal>
      )}
    </div>
  );
}

function WOForm({ form, setForm, onSave, saving, isEdit }: { form: WorkOrder; setForm: (f: WorkOrder) => void; onSave: () => void; saving: boolean; isEdit: boolean; }) {
  const [tab, setTab] = useState<'details' | 'parts' | 'labor' | 'checklist'>('details');
  const update = (k: keyof WorkOrder, v: string | number) => setForm({ ...form, [k]: v });
  const field = (label: string, key: keyof WorkOrder, type = 'text') => (
    <div><label className="block text-xs text-slate-500 mb-1">{label}</label>
      <input type={type} value={type === 'number' ? (form[key] as number) : (form[key] as string) ?? ''}
        onChange={e => update(key, type === 'number' ? Number(e.target.value) : e.target.value)}
        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>);
  const select = (label: string, key: keyof WorkOrder, opts: string[]) => (
    <div><label className="block text-xs text-slate-500 mb-1">{label}</label>
      <select value={form[key] as string} onChange={e => update(key, e.target.value)}
        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
        {opts.map(o => <option key={o} value={o}>{o.replace('_', ' ')}</option>)}</select></div>);

  return (
    <div>
      <div className="flex gap-1 mb-4 border-b border-slate-800">
        {[{ id: 'details', label: 'Details' }, { id: 'checklist', label: 'Checklist', icon: <ListChecks className="w-3.5 h-3.5" /> }, { id: 'parts', label: 'Parts', icon: <Package className="w-3.5 h-3.5" /> }, { id: 'labor', label: 'Labor', icon: <Clock className="w-3.5 h-3.5" /> }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as typeof tab)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t.id ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
            {'icon' in t && t.icon}{t.label}
          </button>
        ))}</div>
      {tab === 'details' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {field('Title', 'title')}{field('Asset ID', 'assetId')}
            {select('Type', 'type', ['corrective','preventive','predictive','emergency','inspection'])}
            {select('Priority', 'priority', ['critical','high','medium','low'])}
            {select('Status', 'status', ['open','in_progress','on_hold','completed','cancelled'])}
            {field('Assigned To', 'assignedTo')}{field('Requested By', 'requestedBy')}
            {field('Due Date', 'dueDate', 'date')}{field('Completed Date', 'completedDate', 'date')}
          </div>
          <div><label className="block text-xs text-slate-500 mb-1">Description</label>
            <textarea value={form.description} onChange={e => update('description', e.target.value)} rows={2} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
          <div><label className="block text-xs text-slate-500 mb-1">Resolution</label>
            <textarea value={form.resolution} onChange={e => update('resolution', e.target.value)} rows={2} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
        </div>
      )}
      {tab === 'checklist' && isEdit && <ChecklistPanel workOrderId={form.id} />}
      {tab === 'checklist' && !isEdit && <p className="text-slate-500 text-sm py-4">Save the work order first to apply a procedure checklist.</p>}
      {tab === 'parts' && isEdit && <PartsPanel workOrderId={form.id} />}
      {tab === 'parts' && !isEdit && <p className="text-slate-500 text-sm py-4">Save the work order first to add parts.</p>}
      {tab === 'labor' && isEdit && <LaborPanel workOrderId={form.id} />}
      {tab === 'labor' && !isEdit && <p className="text-slate-500 text-sm py-4">Save the work order first to add labor.</p>}
      <div className="flex justify-end gap-3 pt-4 border-t border-slate-800 mt-4">
        <button onClick={onSave} disabled={saving} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors">
          {saving ? 'Saving...' : 'Save'}</button>
      </div>
    </div>);
interface ChecklistItem {
  id: number; workOrderId: string; procedureId: string; stepOrder: number;
  instruction: string; expectedResult: string; responseType: 'checkbox' | 'reading' | 'pass_fail' | 'text';
  unit: string; safetyNote: string; completed: boolean; resultValue: string;
  resultStatus: '' | 'pass' | 'fail' | 'na'; notes: string; completedBy: string; completedAt: string;
}
interface ProcedureOption { id: string; title: string; version: string; stepCount?: number; active: boolean; }

function ChecklistPanel({ workOrderId }: { workOrderId: string }) {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [procedures, setProcedures] = useState<ProcedureOption[]>([]);
  const [procedureId, setProcedureId] = useState('');
  const [applying, setApplying] = useState(false);

  const fetchItems = useCallback(() => {
    fetch(`/api/work-orders/checklist?woId=${workOrderId}`).then(r => r.json()).then(setItems).catch(() => {});
  }, [workOrderId]);
  useEffect(() => {
    fetchItems();
    fetch('/api/procedures').then(r => r.json()).then((rows: ProcedureOption[]) => setProcedures(rows.filter(p => p.active))).catch(() => {});
  }, [fetchItems]);

  const apply = async () => {
    if (!procedureId) return;
    setApplying(true);
    try {
      const r = await fetch('/api/work-orders/checklist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workOrderId, procedureId }) });
      if (!r.ok) { alert((await r.json()).error); return; }
      setItems(await r.json());
      setProcedureId('');
    } finally { setApplying(false); }
  };

  const saveItem = async (item: ChecklistItem, patch: Partial<ChecklistItem>) => {
    const next = { ...item, ...patch };
    setItems(prev => prev.map(i => i.id === item.id ? next : i));
    await fetch('/api/work-orders/checklist', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id, completed: next.completed, resultValue: next.resultValue, resultStatus: next.resultStatus, notes: next.notes }),
    });
  };
  const removeItem = async (id: number) => {
    await fetch('/api/work-orders/checklist', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    fetchItems();
  };
  const done = items.filter(i => i.completed).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-white">Checklist ({done}/{items.length})</h4>
        <span className="text-xs text-slate-500">Copied from the procedure. Later SOP edits do not change this work order.</span>
      </div>
      {items.length > 0 ? items.map(item => (
        <div key={item.id} className={`border rounded-lg p-3 space-y-2 ${item.completed ? 'border-green-500/30 bg-green-500/5' : 'border-slate-800'}`}>
          <div className="flex items-start gap-2">
            <input type="checkbox" checked={item.completed} onChange={e => saveItem(item, { completed: e.target.checked })} className="mt-1" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white">{item.stepOrder}. {item.instruction}</p>
              {item.expectedResult && <p className="text-xs text-slate-500">Expected: {item.expectedResult}{item.unit ? ` ${item.unit}` : ''}</p>}
              {item.safetyNote && <p className="text-xs text-amber-400">Safety: {item.safetyNote}</p>}
            </div>
            <button onClick={() => removeItem(item.id)} className="text-slate-500 hover:text-red-400" aria-label="Remove step"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
          <div className="grid grid-cols-3 gap-2 pl-6">
            {(item.responseType === 'reading' || item.responseType === 'text') && (
              <input value={item.resultValue} onChange={e => saveItem(item, { resultValue: e.target.value, completed: true })} placeholder={item.responseType === 'reading' ? `Reading${item.unit ? ` (${item.unit})` : ''}` : 'Result'}
                className="col-span-2 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
            )}
            {(item.responseType === 'pass_fail' || item.responseType === 'reading') && (
              <select value={item.resultStatus} onChange={e => saveItem(item, { resultStatus: e.target.value as ChecklistItem['resultStatus'], completed: e.target.value !== '' })}
                className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Result</option>
                <option value="pass">Pass</option>
                <option value="fail">Fail</option>
                <option value="na">N/A</option>
              </select>
            )}
            <input value={item.notes} onChange={e => saveItem(item, { notes: e.target.value })} placeholder="Notes"
              className="col-span-3 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          {item.completedBy && <p className="text-[10px] text-slate-500 pl-6">{item.completedBy} · {item.completedAt}</p>}
        </div>
      )) : <p className="text-slate-500 text-sm">No checklist yet. Apply a procedure below.</p>}
      <div className="flex items-end gap-2 pt-2">
        <div className="flex-1">
          <label className="block text-xs text-slate-500 mb-1">Apply procedure</label>
          <select value={procedureId} onChange={e => setProcedureId(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Select procedure...</option>
            {procedures.map(p => <option key={p.id} value={p.id}>{p.title} v{p.version} ({p.stepCount ?? 0} steps)</option>)}
          </select>
        </div>
        <button onClick={apply} disabled={applying || !procedureId} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-3 py-2 rounded-lg text-sm transition-colors">
          {applying ? 'Applying...' : 'Apply'}
        </button>
      </div>
    </div>
  );
}

}

function PartsPanel({ workOrderId }: { workOrderId: string }) {
  const [parts, setParts] = useState<WoPart[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [selItem, setSelItem] = useState(''); const [qty, setQty] = useState(1);
  const fetchParts = useCallback(() => {
    fetch(`/api/work-orders/parts?woId=${workOrderId}`).then(r => r.json()).then(setParts).catch(() => {});
  }, [workOrderId]);
  useEffect(() => { fetchParts(); fetch('/api/inventory').then(r => r.json()).then(setInventory); }, [fetchParts]);

  const addPart = async () => {
    if (!selItem) return; const invItem = inventory.find(i => i.id === selItem);
    await fetch('/api/work-orders/parts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workOrderId, inventoryItemId: selItem, quantity: qty, unitCost: invItem?.unitCost || 0 }) });
    fetchParts(); setSelItem(''); setQty(1);
  };
  const removePart = async (id: number) => { await fetch('/api/work-orders/parts', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }); fetchParts(); };

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-white">Parts Used</h4>
      {parts.length > 0 ? (
        <table className="w-full text-sm"><thead><tr className="text-xs text-slate-500 border-b border-slate-800"><th className="text-left py-2">Item</th><th className="text-right py-2">Qty</th><th className="text-right py-2">Cost</th><th className="text-right py-2">Total</th><th className="py-2"></th></tr></thead>
          <tbody>{parts.map(p => (
            <tr key={p.id} className="border-b border-slate-800/50"><td className="py-2 text-slate-300">{p.inventoryName || p.inventoryItemId} <span className="text-slate-500 text-xs">{p.partNumber}</span></td>
              <td className="py-2 text-right text-slate-300">{p.quantity}</td><td className="py-2 text-right text-slate-300">${p.unitCost.toFixed(2)}</td>
              <td className="py-2 text-right text-slate-300">${(p.quantity * p.unitCost).toFixed(2)}</td>
              <td className="py-2 text-right"><button onClick={() => removePart(p.id)} className="text-slate-500 hover:text-red-400"><Trash2 className="w-3 h-3" /></button></td></tr>))}</tbody></table>
      ) : <p className="text-slate-500 text-sm">No parts added yet.</p>}
      <div className="flex items-end gap-2 pt-2">
        <div className="flex-1"><label className="block text-xs text-slate-500 mb-1">Add Part</label>
          <select value={selItem} onChange={e => setSelItem(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Select inventory item...</option>
            {inventory.map(i => <option key={i.id} value={i.id}>{i.name} ({i.partNumber}) — ${i.unitCost.toFixed(2)}</option>)}</select></div>
        <div className="w-20"><label className="block text-xs text-slate-500 mb-1">Qty</label>
          <input type="number" min={1} value={qty} onChange={e => setQty(Number(e.target.value))} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
        <button onClick={addPart} className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-lg text-sm transition-colors"><Plus className="w-4 h-4" /></button>
      </div>
    </div>);
}

function LaborPanel({ workOrderId }: { workOrderId: string }) {
  const { user } = useAuth();
  const [entries, setEntries] = useState<WoLabor[]>([]); const [hours, setHours] = useState(1); const [notes, setNotes] = useState('');
  const fetchLabor = useCallback(() => {
    fetch(`/api/work-orders/labor?woId=${workOrderId}`).then(r => r.json()).then(setEntries).catch(() => {});
  }, [workOrderId]);
  useEffect(() => { fetchLabor(); }, [fetchLabor]);

  const addEntry = async () => {
    if (hours <= 0 || !user) return;
    await fetch('/api/work-orders/labor', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workOrderId, hours, notes, userId: user.id, username: user.displayName }) });
    fetchLabor(); setHours(1); setNotes('');
  };
  const removeEntry = async (id: number) => { await fetch('/api/work-orders/labor', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }); fetchLabor(); };
  const total = entries.reduce((s, e) => s + e.hours, 0);

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-white">Labor Entries ({total.toFixed(1)} hrs total)</h4>
      {entries.length > 0 ? (
        <table className="w-full text-sm"><thead><tr className="text-xs text-slate-500 border-b border-slate-800"><th className="text-left py-2">User</th><th className="text-right py-2">Hours</th><th className="text-left py-2">Date</th><th className="text-left py-2">Notes</th><th className="py-2"></th></tr></thead>
          <tbody>{entries.map(e => (
            <tr key={e.id} className="border-b border-slate-800/50"><td className="py-2 text-slate-300">{e.username}</td><td className="py-2 text-right text-slate-300 font-mono">{e.hours.toFixed(1)}</td>
              <td className="py-2 text-slate-400 text-xs">{e.loggedDate}</td><td className="py-2 text-slate-400 text-xs">{e.notes}</td>
              <td className="py-2 text-right"><button onClick={() => removeEntry(e.id)} className="text-slate-500 hover:text-red-400"><Trash2 className="w-3 h-3" /></button></td></tr>))}</tbody></table>
      ) : <p className="text-slate-500 text-sm">No labor logged yet.</p>}
      <div className="flex items-end gap-2 pt-2">
        <div className="w-24"><label className="block text-xs text-slate-500 mb-1">Hours</label>
          <input type="number" min={0.5} step={0.5} value={hours} onChange={e => setHours(Number(e.target.value))} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
        <div className="flex-1"><label className="block text-xs text-slate-500 mb-1">Notes</label>
          <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="What was done?" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
        <button onClick={addEntry} className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-lg text-sm transition-colors"><Plus className="w-4 h-4" /></button>
      </div>
    </div>);
}
