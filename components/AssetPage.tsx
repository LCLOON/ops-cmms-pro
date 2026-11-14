'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import DataTable, { type Column } from './DataTable';
import Modal from './Modal';
import AssetTreeView from './AssetTreeView';
import AssetDetailPanel from './AssetDetailPanel';
import AssetForm from './AssetForm';
import ImportTools from './ImportTools';
import { List, GitBranch, Plus } from 'lucide-react';
import { AssetRecord, emptyAsset, statusColors, criticalityColors, indexById } from './asset-types';
import { type NavParams } from '@/lib/nav';

export default function AssetPage({ params }: { params?: NavParams }) {
  const { canEdit, isAdmin, loading: authLoading } = useAuth();
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [sites, setSites] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [editItem, setEditItem] = useState<AssetRecord | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<AssetRecord>(emptyAsset());
  const [saving, setSaving] = useState(false);
  // The hierarchy is how people actually navigate a plant, so it is the default
  // view rather than an optional extra next to the table.
  const [viewMode, setViewMode] = useState<'tree' | 'table'>('tree');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const fetchAssets = useCallback(() => {
    fetch('/api/assets')
      .then(r => r.json())
      .then((rows: AssetRecord[]) => { if (Array.isArray(rows)) setAssets(rows); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { if (!authLoading) fetchAssets(); }, [authLoading, fetchAssets]);
  useEffect(() => {
    fetch('/api/config?type=sites')
      .then(response => { if (!response.ok) throw new Error(`Sites request failed (${response.status})`); return response.json(); })
      .then(data => { if (Array.isArray(data.sites)) setSites(data.sites); })
      .catch(error => console.error('[assets] Failed to load sites', error));
  }, []);

  // Presetting parentId is what makes "add equipment under this node" one click.
  const openNew = (parentId = '') => {
    const parent = assets.find(asset => asset.id === parentId);
    setForm({ ...emptyAsset(parentId), siteId: parent?.siteId ?? '' });
    setEditItem(null);
    setShowForm(true);
  };
  const openEdit = (item: AssetRecord) => { setForm({ ...item }); setEditItem(item); setShowForm(true); };

  const save = async () => {
    setSaving(true);
    try {
      const method = editItem ? 'PUT' : 'POST';
      const r = await fetch('/api/assets', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if (!r.ok) { alert((await r.json()).error); return; }
      const saved = await r.json().catch(() => null);
      setShowForm(false);
      if (saved?.id) setSelectedId(saved.id);
      fetchAssets();
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item: AssetRecord) => {
    if (!confirm(`Delete asset "${item.name}"?`)) return;
    await fetch('/api/assets', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.id }) });
    setSelectedId(prev => (prev === item.id ? null : prev));
    fetchAssets();
  };

  const byId = indexById(assets);
  // A link from search or another tab selects that asset; once the user clicks
  // around the tree their own selection takes over.
  const activeId = selectedId ?? params?.focusId ?? null;
  const selected = activeId ? byId.get(activeId) ?? null : null;

  const columns: Column<AssetRecord>[] = [
    { key: 'name', header: 'Name' },
    { key: 'siteId', header: 'Site', render: a => a.siteId ? sites.find(site => site.id === a.siteId)?.name ?? a.siteId : <span className="text-slate-600">Unassigned</span> },
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
    { key: 'parentId', header: 'Parent', render: a => a.parentId ? (byId.get(a.parentId)?.name || a.parentId) : <span className="text-slate-600">none</span> },
  ];

  if (loading) return <div className="text-slate-400 p-8">Loading assets...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">Asset Management</h2>
          <p className="text-slate-400 text-sm mt-1">Click an asset in the tree to open it, edit it, or add equipment beneath it</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ImportTools canEdit={canEdit} onImported={fetchAssets} />
          <div className="flex items-center gap-2 bg-slate-800/50 rounded-lg p-1">
            <button onClick={() => setViewMode('tree')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${viewMode === 'tree' ? 'bg-blue-600/30 text-blue-400' : 'text-slate-400 hover:text-slate-200'}`}><GitBranch className="w-3.5 h-3.5" />Tree</button>
            <button onClick={() => setViewMode('table')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${viewMode === 'table' ? 'bg-blue-600/30 text-blue-400' : 'text-slate-400 hover:text-slate-200'}`}><List className="w-3.5 h-3.5" />Table</button>
          </div>
          {canEdit && (
            <button onClick={() => openNew()} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors">
              <Plus className="w-4 h-4" /> New asset
            </button>
          )}
        </div>
      </div>

      {viewMode === 'tree' ? (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
          <div className="lg:col-span-2">
            <AssetTreeView
              assets={assets}
              selectedId={activeId}
              onSelect={setSelectedId}
              onAddChild={parentId => openNew(parentId)}
              canEdit={canEdit}
            />
          </div>
          <div className="lg:col-span-3">
            <AssetDetailPanel
              asset={selected}
              assets={assets}
              sites={sites}
              canEdit={canEdit}
              isAdmin={isAdmin}
              onSelect={setSelectedId}
              onEdit={openEdit}
              onAddChild={parentId => openNew(parentId)}
              onDelete={remove}
              onAddRoot={() => openNew()}
            />
          </div>
        </div>
      ) : (
        <DataTable
          data={assets}
          columns={columns}
          onEdit={openEdit}
          onDelete={isAdmin ? remove : undefined}
          onAdd={canEdit ? () => openNew() : undefined}
          searchPlaceholder="Search assets..."
          canEdit={canEdit}
          canDelete={isAdmin}
          emptyMessage="No assets found."
        />
      )}

      {showForm && (
        <Modal open={showForm} onClose={() => setShowForm(false)} title={editItem ? `Edit asset: ${editItem.name}` : 'New asset'}>
          <AssetForm
            form={form}
            setForm={setForm}
            onSave={save}
            onCancel={() => setShowForm(false)}
            saving={saving}
            allAssets={assets}
            sites={sites}
            isNew={!editItem}
          />
        </Modal>
      )}
    </div>
  );
}
