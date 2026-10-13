'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import DataTable, { type Column } from './DataTable';
import Modal from './Modal';

interface Vendor {
  id: string; name: string; contactName: string; email: string; phone: string;
  address: string; website: string; paymentTerms: string; notes: string;
  active: boolean; createdAt: string; updatedAt: string;
}

const defaultVendor: Vendor = {
  id: '', name: '', contactName: '', email: '', phone: '', address: '',
  website: '', paymentTerms: 'Net 30', notes: '', active: true, createdAt: '', updatedAt: '',
};

export default function VendorPage() {
  const { canEdit, isAdmin, loading: authLoading } = useAuth();
  const [items, setItems] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [editItem, setEditItem] = useState<Vendor | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Vendor>(defaultVendor);
  const [saving, setSaving] = useState(false);

  const fetchItems = useCallback(() => {
    fetch('/api/vendors').then(r => r.json()).then(setItems).catch(() => {}).finally(() => setLoading(false));
  }, []);
  useEffect(() => { if (!authLoading) fetchItems(); }, [authLoading, fetchItems]);

  const openNew = () => { setForm(defaultVendor); setEditItem(null); setShowForm(true); };
  const openEdit = (item: Vendor) => { setForm({ ...item }); setEditItem(item); setShowForm(true); };

  const save = async () => {
    setSaving(true);
    try {
      const method = editItem ? 'PUT' : 'POST';
      const r = await fetch('/api/vendors', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if (!r.ok) { alert((await r.json()).error); return; }
      setShowForm(false); fetchItems();
    } finally { setSaving(false); }
  };
  const remove = async (item: Vendor) => {
    if (!confirm(`Delete vendor "${item.name}"?`)) return;
    await fetch('/api/vendors', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.id }) });
    fetchItems();
  };

  const columns: Column<Vendor>[] = [
    { key: 'name', header: 'Name' },
    { key: 'contactName', header: 'Contact' },
    { key: 'email', header: 'Email' },
    { key: 'phone', header: 'Phone' },
    { key: 'paymentTerms', header: 'Terms' },
    { key: 'active', header: 'Active', render: v => <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${v.active ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-slate-500/20 text-slate-400 border-slate-500/30'}`}>{v.active ? 'Yes' : 'No'}</span> },
  ];

  if (loading) return <div className="text-slate-400 p-8">Loading vendors...</div>;
  return (
    <div className="space-y-6">
      <div><h2 className="text-xl font-bold text-white">Vendors</h2><p className="text-slate-400 text-sm mt-1">Manage suppliers and service providers</p></div>
      <DataTable data={items} columns={columns} onEdit={openEdit} onDelete={isAdmin ? remove : undefined} onAdd={canEdit ? openNew : undefined}
        searchPlaceholder="Search vendors..." canEdit={canEdit} canDelete={isAdmin} emptyMessage="No vendors found." />
      {showForm && (
        <Modal open={showForm} onClose={() => setShowForm(false)} title={editItem ? 'Edit Vendor' : 'New Vendor'}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Name" value={form.name} onChange={v => setForm({ ...form, name: v })} />
              <Field label="Contact Name" value={form.contactName} onChange={v => setForm({ ...form, contactName: v })} />
              <Field label="Email" value={form.email} onChange={v => setForm({ ...form, email: v })} type="email" />
              <Field label="Phone" value={form.phone} onChange={v => setForm({ ...form, phone: v })} />
              <Field label="Address" value={form.address} onChange={v => setForm({ ...form, address: v })} />
              <Field label="Website" value={form.website} onChange={v => setForm({ ...form, website: v })} />
              <div><label className="block text-xs text-slate-500 mb-1">Payment Terms</label>
                <select value={form.paymentTerms} onChange={e => setForm({ ...form, paymentTerms: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"><option>Net 15</option><option>Net 30</option><option>Net 60</option><option>Due on Receipt</option></select></div>
              <div><label className="block text-xs text-slate-500 mb-1">Active</label>
                <button onClick={() => setForm({ ...form, active: !form.active })}
                  className={`w-full px-3 py-2 rounded-lg text-sm font-medium border ${form.active ? 'bg-green-600/20 text-green-400 border-green-500/30' : 'bg-slate-700/50 text-slate-400 border-slate-600'}`}>{form.active ? 'Active' : 'Inactive'}</button></div>
            </div>
            <div><label className="block text-xs text-slate-500 mb-1">Notes</label>
              <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" /></div>
            <div className="flex justify-end"><button onClick={save} disabled={saving} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-6 py-2 rounded-lg text-sm font-medium">{saving ? 'Saving...' : 'Save'}</button></div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div><label className="block text-xs text-slate-500 mb-1">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
  );
}
