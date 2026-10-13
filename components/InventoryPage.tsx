'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import DataTable, { type Column } from './DataTable';
import Modal from './Modal';

interface InventoryItem {
  id: string; name: string; partNumber: string; category: string;
  quantityOnHand: number; minQuantity: number; unitCost: number;
  supplier: string; location: string; notes: string;
  createdAt: string; updatedAt: string;
}

const defaultItem: InventoryItem = {
  id: '', name: '', partNumber: '', category: 'general', quantityOnHand: 0,
  minQuantity: 0, unitCost: 0, supplier: '', location: '', notes: '',
  createdAt: '', updatedAt: '',
};

export default function InventoryPage() {
  const { canEdit, loading: authLoading } = useAuth();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<InventoryItem>(defaultItem);
  const [saving, setSaving] = useState(false);

  const fetchItems = useCallback(() => {
    fetch('/api/inventory').then(r => r.json()).then(setItems).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { if (!authLoading) fetchItems(); }, [authLoading, fetchItems]);

  const openNew = () => { setForm(defaultItem); setEditItem(null); setShowForm(true); };
  const openEdit = (item: InventoryItem) => { setForm({ ...item }); setEditItem(item); setShowForm(true); };

  const save = async () => {
    setSaving(true);
    try {
      const method = editItem ? 'PUT' : 'POST';
      const r = await fetch('/api/inventory', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if (!r.ok) { alert((await r.json()).error); return; }
      setShowForm(false);
      fetchItems();
    } finally { setSaving(false); }
  };

  const remove = async (item: InventoryItem) => {
    if (!confirm(`Delete "${item.name}"?`)) return;
    await fetch('/api/inventory', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.id }) });
    fetchItems();
  };

  const columns: Column<InventoryItem>[] = [
    { key: 'name', header: 'Name' },
    { key: 'partNumber', header: 'Part #' },
    { key: 'category', header: 'Category', render: i => <span className="capitalize">{i.category}</span> },
    {
      key: 'quantityOnHand', header: 'Qty',
      render: i => {
        const low = i.quantityOnHand <= i.minQuantity && i.minQuantity > 0;
        return <span className={`font-mono font-semibold ${low ? 'text-red-400' : 'text-slate-300'}`}>{i.quantityOnHand} {low && '⚠'}</span>;
      },
    },
    { key: 'minQuantity', header: 'Min' },
    { key: 'unitCost', header: 'Cost', render: i => <span className="font-mono">${i.unitCost.toFixed(2)}</span> },
    { key: 'supplier', header: 'Supplier' },
    { key: 'location', header: 'Location' },
  ];

  if (loading) return <div className="text-slate-400 p-8">Loading inventory...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Inventory</h2>
        <p className="text-slate-400 text-sm mt-1">Manage spare parts, supplies, and materials</p>
      </div>
      <DataTable
        data={items} columns={columns}
        onEdit={openEdit} onDelete={canEdit ? remove : undefined}
        onAdd={canEdit ? openNew : undefined}
        searchPlaceholder="Search inventory..."
        canEdit={canEdit} canDelete={canEdit}
        emptyMessage="No inventory items found."
      />
      {showForm && (
        <Modal open={showForm} onClose={() => setShowForm(false)} title={editItem ? 'Edit Inventory Item' : 'New Inventory Item'}>
          <InvForm form={form} setForm={setForm} onSave={save} saving={saving} />
        </Modal>
      )}
    </div>
  );
}

function InvForm({ form, setForm, onSave, saving }: {
  form: InventoryItem; setForm: (f: InventoryItem) => void; onSave: () => void; saving: boolean;
}) {
  const update = (k: keyof InventoryItem, v: string | number) => setForm({ ...form, [k]: v });
  const field = (label: string, key: keyof InventoryItem, type = 'text') => (
    <div>
      <label className="block text-xs text-slate-500 mb-1">{label}</label>
      <input type={type} value={type === 'number' ? (form[key] as number) : (form[key] as string) ?? ''}
        onChange={e => update(key, type === 'number' ? Number(e.target.value) : e.target.value)}
        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
    </div>
  );
  const select = (label: string, key: keyof InventoryItem, opts: string[]) => (
    <div>
      <label className="block text-xs text-slate-500 mb-1">{label}</label>
      <select value={form[key] as string} onChange={e => update(key, e.target.value)}
        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
        {opts.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {field('Name', 'name')}
        {field('Part Number', 'partNumber')}
        {select('Category', 'category', ['mechanical','electrical','hvac','plumbing','safety','consumable','general'])}
        {field('Quantity On Hand', 'quantityOnHand', 'number')}
        {field('Min Quantity', 'minQuantity', 'number')}
        {field('Unit Cost', 'unitCost', 'number')}
        {field('Supplier', 'supplier')}
        {field('Location', 'location')}
      </div>
      <div>
        <label className="block text-xs text-slate-500 mb-1">Notes</label>
        <textarea value={form.notes} onChange={e => update('notes', e.target.value)} rows={2}
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button onClick={onSave} disabled={saving}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors">
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
}
