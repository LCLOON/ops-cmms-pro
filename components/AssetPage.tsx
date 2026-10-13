'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import DataTable, { type Column } from './DataTable';
import Modal from './Modal';
import AssetTreeView from './AssetTreeView';
import { List, GitBranch } from 'lucide-react';

interface Asset {
  id: string; name: string; category: string; location: string; department: string;
  manufacturer: string; model: string; serialNumber: string; installDate: string;
  warrantyExpiry: string; status: string; criticality: string; notes: string;
  parentId: string; createdAt: string; updatedAt: string;
  replacementCost?: number; failureMode?: string;
}

const defaultAsset: Asset = {
  id: '', name: '', category: 'other', location: '', department: '',
  manufacturer: '', model: '', serialNumber: '', installDate: '', warrantyExpiry: '',
  status: 'operational', criticality: 'low', notes: '', parentId: '', createdAt: '', updatedAt: '',
};

const statusColors: Record<string, string> = {
  operational: 'bg-green-500/20 text-green-400 border-green-500/30',
  down: 'bg-red-500/20 text-red-400 border-red-500/30',
  maintenance: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  retired: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
};

const criticalityColors: Record<string, string> = {
  critical: 'text-red-400', high: 'text-amber-400', medium: 'text-blue-400', low: 'text-slate-400',
};

export default function AssetPage() {
  const { canEdit, isAdmin, loading: authLoading } = useAuth();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [editItem, setEditItem] = useState<Asset | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Asset>(defaultAsset);
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'tree'>('table');

  const fetchAssets = useCallback(() => {
    fetch('/api/assets').then(r => r.json()).then(setAssets).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { if (!authLoading) fetchAssets(); }, [authLoading, fetchAssets]);

  const openNew = () => { setForm(defaultAsset); setEditItem(null); setShowForm(true); };
  const openEdit = (item: Asset) => { setForm({ ...item }); setEditItem(item); setShowForm(true); };

  const save = async () => {
    setSaving(true);
    try {
      const method = editItem ? 'PUT' : 'POST';
      const r = await fetch('/api/assets', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if (!r.ok) { alert((await r.json()).error); return; }
      setShowForm(false);
      fetchAssets();
    } finally { setSaving(false); }
  };

  const remove = async (item: Asset) => {
    if (!confirm(`Delete asset "${item.name}"?`)) return;
    await fetch('/api/assets', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.id }) });
    fetchAssets();
  };

  const columns: Column<Asset>[] = [
    { key: 'name', header: 'Name' },
    { key: 'category', header: 'Category', render: a => <span className="capitalize">{a.category}</span> },
    { key: 'location', header: 'Location' },
    {
      key: 'status', header: 'Status',
      render: a => <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${statusColors[a.status] || ''}`}>{a.status.replace('_', ' ')}</span>,
    },
    {
      key: 'criticality', header: 'Criticality',
      render: a => <span className={`text-xs font-semibold capitalize ${criticalityColors[a.criticality] || ''}`}>{a.criticality}</span>,
    },
    { key: 'department', header: 'Department' },
    { key: 'parentId', header: 'Parent', render: a => a.parentId ? (assets.find(p => p.id === a.parentId)?.name || a.parentId) : <span className="text-slate-600">—</span> },
  ];

  if (loading) return <div className="text-slate-400 p-8">Loading assets...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Asset Management</h2>
          <p className="text-slate-400 text-sm mt-1">Track and manage all equipment and assets</p>
        </div>
        <div className="flex items-center gap-2 bg-slate-800/50 rounded-lg p-1">
          <button onClick={() => setViewMode('table')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${viewMode === 'table' ? 'bg-blue-600/30 text-blue-400' : 'text-slate-400 hover:text-slate-200'}`}><List className="w-3.5 h-3.5" />Table</button>
          <button onClick={() => setViewMode('tree')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${viewMode === 'tree' ? 'bg-blue-600/30 text-blue-400' : 'text-slate-400 hover:text-slate-200'}`}><GitBranch className="w-3.5 h-3.5" />Tree</button>
        </div>
      </div>
      {viewMode === 'tree' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1"><AssetTreeView assets={assets} onSelectAsset={(id) => { const el = document.getElementById('asset-'+id); el?.scrollIntoView({behavior:'smooth'}); }} /></div>
          <div className="lg:col-span-2"><DataTable data={assets} columns={columns} onEdit={openEdit} onDelete={isAdmin ? remove : undefined} onAdd={canEdit ? openNew : undefined} searchPlaceholder="Search assets..." canEdit={canEdit} canDelete={isAdmin} emptyMessage="No assets found." /></div>
        </div>
      ) : (
        <DataTable data={assets} columns={columns} onEdit={openEdit} onDelete={isAdmin ? remove : undefined} onAdd={canEdit ? openNew : undefined} searchPlaceholder="Search assets..." canEdit={canEdit} canDelete={isAdmin} emptyMessage="No assets found." />
      )}
      {showForm && (
        <Modal open={showForm} onClose={() => setShowForm(false)} title={editItem ? 'Edit Asset' : 'New Asset'}>
          <AssetForm form={form} setForm={setForm} onSave={save} saving={saving} allAssets={assets} />
        </Modal>
      )}
    </div>
  );
}

function AssetForm({ form, setForm, onSave, saving, allAssets }: {
  form: Asset; setForm: (f: Asset) => void; onSave: () => void; saving: boolean; allAssets: Asset[];
}) {
  const update = (k: keyof Asset, v: string) => setForm({ ...form, [k]: v });
  const field = (label: string, key: keyof Asset, type = 'text') => (
    <div>
      <label className="block text-xs text-slate-500 mb-1">{label}</label>
      <input type={type} value={(form[key] as string) ?? ''}
        onChange={e => update(key, e.target.value)}
        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
    </div>
  );
  const select = (label: string, key: keyof Asset, opts: string[]) => (
    <div>
      <label className="block text-xs text-slate-500 mb-1">{label}</label>
      <select value={form[key] as string}
        onChange={e => update(key, e.target.value)}
        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
        {opts.map(o => <option key={o} value={o}>{o.replace('_', ' ')}</option>)}
      </select>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {field('Name', 'name')}
        {select('Category', 'category', ['mechanical','electrical','hvac','plumbing','structural','vehicle','it','safety','other'])}
        {field('Location', 'location')}
        {field('Department', 'department')}
        {field('Manufacturer', 'manufacturer')}
        {field('Model', 'model')}
        {field('Serial Number', 'serialNumber')}
        {field('Install Date', 'installDate', 'date')}
        {field('Warranty Expiry', 'warrantyExpiry', 'date')}
        {select('Status', 'status', ['operational','down','maintenance','retired'])}
        {select('Criticality', 'criticality', ['critical','high','medium','low'])}
        {field('Replacement Cost ($)', 'replacementCost', 'number')}
        {field('Failure Mode', 'failureMode')}
        <div>
          <label className="block text-xs text-slate-500 mb-1">Parent Asset</label>
          <select value={form.parentId || ''} onChange={e => update('parentId', e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">None (top-level)</option>
            {allAssets.filter(a => a.id !== form.id).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs text-slate-500 mb-1">Notes</label>
        <textarea value={form.notes} onChange={e => update('notes', e.target.value)} rows={3}
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
