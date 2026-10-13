'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import DataTable, { type Column } from './DataTable';
import Modal from './Modal';
import { Plus, Trash2, Package } from 'lucide-react';

interface PurchaseOrder {
  id: string; vendorId: string; vendorName?: string; poNumber: string;
  status: string; orderDate: string; expectedDate: string; receivedDate: string;
  totalCost: number; notes: string; createdBy: string; createdAt: string; updatedAt: string;
}
interface Vendor { id: string; name: string; }
interface PoItem { id: number; poId: string; inventoryItemId: string; itemName: string; quantity: number; unitCost: number; }
interface InventoryItem { id: string; name: string; unitCost: number; }

const defaultPO: PurchaseOrder = {
  id: '', vendorId: '', poNumber: '', status: 'draft', orderDate: new Date().toISOString().slice(0, 10),
  expectedDate: '', receivedDate: '', totalCost: 0, notes: '', createdBy: '',
  createdAt: '', updatedAt: '',
};
const statusColors: Record<string, string> = {
  draft: 'bg-slate-500/20 text-slate-400 border-slate-500/30', sent: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  received: 'bg-green-500/20 text-green-400 border-green-500/30', cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
};

export default function PurchaseOrderPage() {
  const { canEdit, loading: authLoading, user } = useAuth();
  const [items, setItems] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [editItem, setEditItem] = useState<PurchaseOrder | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<PurchaseOrder>(defaultPO);
  const [saving, setSaving] = useState(false);

  const fetchItems = useCallback(() => {
    fetch('/api/purchase-orders').then(r => r.json()).then(setItems).catch(() => {}).finally(() => setLoading(false));
  }, []);
  useEffect(() => { if (!authLoading) fetchItems(); }, [authLoading, fetchItems]);

  const openNew = () => { setForm({ ...defaultPO, createdBy: user?.displayName || '' }); setEditItem(null); setShowForm(true); };
  const openEdit = (item: PurchaseOrder) => { setForm({ ...item }); setEditItem(item); setShowForm(true); };

  const save = async () => {
    setSaving(true);
    try {
      const method = editItem ? 'PUT' : 'POST';
      const r = await fetch('/api/purchase-orders', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if (!r.ok) { alert((await r.json()).error); return; }
      setShowForm(false); fetchItems();
    } finally { setSaving(false); }
  };

  const remove = async (item: PurchaseOrder) => {
    if (!confirm(`Delete PO "${item.id}"?`)) return;
    await fetch('/api/purchase-orders', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.id }) });
    fetchItems();
  };

  const columns: Column<PurchaseOrder>[] = [
    { key: 'id', header: 'PO #' },
    { key: 'vendorName', header: 'Vendor', render: p => p.vendorName || <span className="text-slate-600">—</span> },
    { key: 'status', header: 'Status', render: p => <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${statusColors[p.status]}`}>{p.status}</span> },
    { key: 'orderDate', header: 'Order Date' },
    { key: 'expectedDate', header: 'Expected' },
    { key: 'totalCost', header: 'Total', render: p => <span className="font-mono">${p.totalCost.toFixed(2)}</span> },
    { key: 'createdBy', header: 'Created By' },
  ];

  if (loading) return <div className="text-slate-400 p-8">Loading purchase orders...</div>;
  return (
    <div className="space-y-6">
      <div><h2 className="text-xl font-bold text-white">Purchase Orders</h2><p className="text-slate-400 text-sm mt-1">Create and track purchase orders with vendors</p></div>
      <DataTable data={items} columns={columns} onEdit={openEdit} onDelete={canEdit ? remove : undefined} onAdd={canEdit ? openNew : undefined}
        searchPlaceholder="Search POs..." canEdit={canEdit} canDelete={canEdit} emptyMessage="No purchase orders found." />
      {showForm && (
        <Modal open={showForm} onClose={() => setShowForm(false)} title={editItem ? `Edit PO: ${editItem.id}` : 'New Purchase Order'}>
          <POForm form={form} setForm={setForm} onSave={save} saving={saving} isEdit={!!editItem} />
        </Modal>
      )}
    </div>
  );
}

function POForm({ form, setForm, onSave, saving, isEdit }: { form: PurchaseOrder; setForm: (f: PurchaseOrder) => void; onSave: () => void; saving: boolean; isEdit: boolean; }) {
  const [tab, setTab] = useState<'details' | 'items'>('details');
  const [vendors, setVendors] = useState<Vendor[]>([]);
  useEffect(() => { fetch('/api/vendors').then(r => r.json()).then(setVendors); }, []);

  const f = (k: keyof PurchaseOrder, v: string | number) => setForm({ ...form, [k]: v });

  return (
    <div>
      <div className="flex gap-1 mb-4 border-b border-slate-800">
        {['Details', 'Items'].map(t => (
          <button key={t} onClick={() => setTab(t.toLowerCase() as typeof tab)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t.toLowerCase() ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
            {t === 'Items' && <Package className="w-3.5 h-3.5" />}{t}
          </button>
        ))}</div>
      {tab === 'details' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-xs text-slate-500 mb-1">Vendor</label>
              <select value={form.vendorId} onChange={e => f('vendorId', e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm">
                <option value="">Select vendor...</option>{vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select></div>
            <div><label className="block text-xs text-slate-500 mb-1">PO Number</label><input value={form.poNumber} onChange={e => f('poNumber', e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" /></div>
            <div><label className="block text-xs text-slate-500 mb-1">Status</label>
              <select value={form.status} onChange={e => f('status', e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"><option>draft</option><option>sent</option><option>received</option><option>cancelled</option></select></div>
            <div><label className="block text-xs text-slate-500 mb-1">Created By</label><input value={form.createdBy} onChange={e => f('createdBy', e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" /></div>
            <div><label className="block text-xs text-slate-500 mb-1">Order Date</label><input type="date" value={form.orderDate} onChange={e => f('orderDate', e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" /></div>
            <div><label className="block text-xs text-slate-500 mb-1">Expected Date</label><input type="date" value={form.expectedDate} onChange={e => f('expectedDate', e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" /></div>
            <div><label className="block text-xs text-slate-500 mb-1">Received Date</label><input type="date" value={form.receivedDate} onChange={e => f('receivedDate', e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" /></div>
          </div>
          <div><label className="block text-xs text-slate-500 mb-1">Notes</label><textarea value={form.notes} onChange={e => f('notes', e.target.value)} rows={2} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" /></div>
        </div>
      )}
      {tab === 'items' && isEdit && <POItemsPanel poId={form.id} />}
      {tab === 'items' && !isEdit && <p className="text-slate-500 text-sm py-4">Save the PO first to add items.</p>}
      <div className="flex justify-end gap-3 pt-4 border-t border-slate-800 mt-4">
        <button onClick={onSave} disabled={saving} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-6 py-2 rounded-lg text-sm font-medium">{saving ? 'Saving...' : 'Save'}</button>
      </div>
    </div>
  );
}

function POItemsPanel({ poId }: { poId: string }) {
  const [items, setItems] = useState<PoItem[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [selItem, setSelItem] = useState(''); const [qty, setQty] = useState(1);

  const fetchItems = useCallback(() => {
    fetch(`/api/purchase-orders/items?poId=${poId}`).then(r => r.json()).then(setItems).catch(() => {});
  }, [poId]);
  useEffect(() => { fetchItems(); fetch('/api/inventory').then(r => r.json()).then(setInventory); }, [fetchItems]);

  const add = async () => {
    if (!selItem) return; const inv = inventory.find(i => i.id === selItem);
    await fetch('/api/purchase-orders/items', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ poId, inventoryItemId: selItem, itemName: inv?.name || '', quantity: qty, unitCost: inv?.unitCost || 0 }) });
    fetchItems(); setSelItem(''); setQty(1);
  };
  const remove = async (id: number) => { await fetch('/api/purchase-orders/items', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }); fetchItems(); };

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-white">PO Line Items</h4>
      {items.length > 0 ? (
        <table className="w-full text-sm"><thead><tr className="text-xs text-slate-500 border-b border-slate-800"><th className="text-left py-2">Item</th><th className="text-right py-2">Qty</th><th className="text-right py-2">Cost</th><th className="text-right py-2">Total</th><th className="py-2"></th></tr></thead>
          <tbody>{items.map(i => (
            <tr key={i.id} className="border-b border-slate-800/50"><td className="py-2 text-slate-300">{i.itemName}</td><td className="py-2 text-right text-slate-300">{i.quantity}</td><td className="py-2 text-right text-slate-300">${i.unitCost.toFixed(2)}</td><td className="py-2 text-right text-slate-300">${(i.quantity * i.unitCost).toFixed(2)}</td>
              <td className="py-2 text-right"><button onClick={() => remove(i.id)} className="text-slate-500 hover:text-red-400"><Trash2 className="w-3 h-3" /></button></td></tr>))}</tbody></table>
      ) : <p className="text-slate-500 text-sm">No items added yet.</p>}
      <div className="flex items-end gap-2 pt-2">
        <div className="flex-1"><label className="block text-xs text-slate-500 mb-1">Add Item</label>
          <select value={selItem} onChange={e => setSelItem(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"><option value="">Select inventory item...</option>{inventory.map(i => <option key={i.id} value={i.id}>{i.name} — ${i.unitCost.toFixed(2)}</option>)}</select></div>
        <div className="w-20"><label className="block text-xs text-slate-500 mb-1">Qty</label><input type="number" min={1} value={qty} onChange={e => setQty(Number(e.target.value))} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" /></div>
        <button onClick={add} className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-lg text-sm"><Plus className="w-4 h-4" /></button>
      </div>
    </div>
  );
}
