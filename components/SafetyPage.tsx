'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import DataTable, { type Column } from './DataTable';
import Modal from './Modal';
import { navigate, type NavParams } from '@/lib/nav';

interface Item {
  id: string;
  workOrderId: string;
  assetId: string;
  permitType: string;
  permitNumber: string;
  issuedBy: string;
  issuedDate: string;
  expiryDate: string;
  status: string;
  description: string;
  hazards: string;
  precautions: string;
  approvedBy: string;
  attachments: string;
  createdAt: string;
  updatedAt: string;
}

interface WorkOrderOption { id: string; title: string; assetId: string; siteId?: string; }
interface AssetOption { id: string; name: string; siteId?: string; }

const defaultItem = (): Item => ({
  id: '', workOrderId: '', assetId: '', permitType: 'loto', permitNumber: '',
  issuedBy: '', issuedDate: new Date().toISOString().slice(0, 10), expiryDate: '',
  status: 'draft', description: '', hazards: '', precautions: '', approvedBy: '',
  attachments: '', createdAt: '', updatedAt: '',
});
const statusColors: Record<string, string> = {
  draft: 'bg-slate-500/20 text-slate-400',
  issued: 'bg-blue-500/20 text-blue-400',
  active: 'bg-green-500/20 text-green-400',
  closed: 'bg-slate-500/20 text-slate-300',
  expired: 'bg-red-500/20 text-red-400',
  cancelled: 'bg-red-500/20 text-red-400',
};
const permitTypes = ['loto', 'confined_space', 'hot_work', 'excavation', 'diving', 'crane', 'working_at_heights', 'other'];
const permitStatuses = ['draft', 'issued', 'active', 'closed', 'expired', 'cancelled'];
const fieldClass = 'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

export default function SafetyPage({ params }: { params?: NavParams }) {
  const { canEdit, isAdmin } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrderOption[]>([]);
  const [assets, setAssets] = useState<AssetOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [form, setForm] = useState<Item>(defaultItem);
  const [saving, setSaving] = useState(false);

  const fetchItems = useCallback(() => {
    fetch('/api/safety')
      .then(response => { if (!response.ok) throw new Error(`Safety permits request failed (${response.status})`); return response.json(); })
      .then((rows: Item[]) => { if (!Array.isArray(rows)) throw new Error('Safety permits response was not a list'); setItems(rows); })
      .catch(error => console.error('[safety] Failed to load permits', error))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { fetchItems(); }, [fetchItems]);

  useEffect(() => {
    Promise.all([
      fetch('/api/work-orders').then(response => { if (!response.ok) throw new Error(`Work orders request failed (${response.status})`); return response.json(); }),
      fetch('/api/assets').then(response => { if (!response.ok) throw new Error(`Assets request failed (${response.status})`); return response.json(); }),
    ]).then(([workOrderRows, assetRows]) => {
      if (Array.isArray(workOrderRows)) setWorkOrders(workOrderRows);
      if (Array.isArray(assetRows)) setAssets(assetRows);
    }).catch(error => console.error('[safety] Failed to load relationship options', error));
  }, []);

  const openNew = () => {
    const workOrder = workOrders.find(item => item.id === params?.workOrderId);
    setForm({
      ...defaultItem(),
      workOrderId: workOrder?.id ?? params?.workOrderId ?? '',
      assetId: params?.assetId || workOrder?.assetId || '',
    });
    setEditItem(null);
    setShowForm(true);
  };
  const openEdit = (item: Item) => { setForm({ ...item }); setEditItem(item); setShowForm(true); };
  const save = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/safety', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!response.ok) { alert((await response.json()).error); return; }
      setShowForm(false);
      fetchItems();
    } finally { setSaving(false); }
  };
  const remove = async (item: Item) => {
    if (!confirm(`Delete permit ${item.permitNumber}?`)) return;
    const response = await fetch('/api/safety', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.id }),
    });
    if (!response.ok) { alert((await response.json()).error); return; }
    fetchItems();
  };
  const update = (key: keyof Item, value: string) => setForm(previous => ({ ...previous, [key]: value }));

  const visibleItems = params?.workOrderId ? items.filter(item => item.workOrderId === params.workOrderId) : items;
  const selectedWorkOrder = workOrders.find(item => item.id === form.workOrderId);
  const focusedWorkOrder = workOrders.find(item => item.id === params?.workOrderId);
  const assetName = (id: string) => assets.find(asset => asset.id === id)?.name ?? id;
  const columns: Column<Item>[] = [
    { key: 'permitType', header: 'Type', render: permit => <span className="capitalize">{permit.permitType.replace(/_/g, ' ')}</span> },
    { key: 'permitNumber', header: 'Permit #' },
    { key: 'description', header: 'Description' },
    { key: 'assetId', header: 'Asset', render: permit => permit.assetId ? (
      <button onClick={() => navigate('assets', { focusId: permit.assetId })} className="text-blue-400 hover:text-blue-300 hover:underline text-xs" title="Open this asset">{assetName(permit.assetId)}</button>
    ) : <span className="text-slate-600">-</span> },
    { key: 'workOrderId', header: 'Work order', render: permit => permit.workOrderId ? (
      <button onClick={() => navigate('work-orders', { focusId: permit.workOrderId })} className="text-blue-400 hover:text-blue-300 hover:underline text-xs">{permit.workOrderId}</button>
    ) : <span className="text-slate-600">Unlinked</span> },
    { key: 'status', header: 'Status', render: permit => <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${statusColors[permit.status] || ''}`}>{permit.status}</span> },
    { key: 'issuedDate', header: 'Issued' },
    { key: 'expiryDate', header: 'Expires' },
  ];

  if (loading) return <div className="text-slate-400 p-8">Loading safety permits...</div>;

  const textField = (label: string, key: keyof Item, type = 'text') => (
    <div>
      <label htmlFor={`permit-${key}`} className="block text-xs text-slate-500 mb-1">{label}</label>
      <input id={`permit-${key}`} type={type} value={form[key]} onChange={event => update(key, event.target.value)} className={fieldClass} />
    </div>
  );
  const selectField = (label: string, key: 'permitType' | 'status', options: string[]) => (
    <div>
      <label htmlFor={`permit-${key}`} className="block text-xs text-slate-500 mb-1">{label}</label>
      <select id={`permit-${key}`} value={form[key]} onChange={event => update(key, event.target.value)} className={fieldClass}>
        {options.map(option => <option key={option} value={option}>{option.replace(/_/g, ' ')}</option>)}
      </select>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Safety Permits</h2>
        <p className="text-slate-400 text-sm mt-1">Link each permit to the work order and asset covered by the permit.</p>
      </div>
      {params?.workOrderId && (
        <div className="flex items-center justify-between bg-blue-500/10 border border-blue-500/30 rounded-lg px-3 py-2 text-xs">
          <span className="text-blue-300">
            {focusedWorkOrder ? <>Permits for <strong>{focusedWorkOrder.id}: {focusedWorkOrder.title}</strong></> : <>Permits linked to work order <strong>{params.workOrderId}</strong></>}
            {' '}({visibleItems.length})
          </span>
          <button onClick={() => navigate('safety')} className="text-blue-400 hover:text-blue-300 underline">Show all permits</button>
        </div>
      )}
      <DataTable
        data={visibleItems}
        columns={columns}
        onEdit={canEdit ? openEdit : undefined}
        onDelete={isAdmin ? remove : undefined}
        onAdd={canEdit ? openNew : undefined}
        searchPlaceholder="Search permits..."
        emptyMessage="No safety permits found."
        canEdit={canEdit}
        canDelete={isAdmin}
      />
      {showForm && (
        <Modal open={showForm} onClose={() => setShowForm(false)} title={editItem ? 'Edit Permit' : 'New Permit'}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {selectField('Type', 'permitType', permitTypes)}
              {textField('Permit #', 'permitNumber')}
              {textField('Description', 'description')}
              <div>
                <label htmlFor="permit-workOrderId" className="block text-xs text-slate-500 mb-1">Work order</label>
                <select id="permit-workOrderId" value={form.workOrderId} onChange={event => {
                  const workOrderId = event.target.value;
                  const workOrder = workOrders.find(item => item.id === workOrderId);
                  setForm(previous => ({ ...previous, workOrderId, assetId: workOrder?.assetId ?? '' }));
                }} className={fieldClass}>
                  <option value="">No linked work order</option>
                  {workOrders.map(workOrder => <option key={workOrder.id} value={workOrder.id}>{workOrder.id} · {workOrder.title}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="permit-assetId" className="block text-xs text-slate-500 mb-1">Asset</label>
                <select id="permit-assetId" value={form.assetId} disabled={Boolean(selectedWorkOrder?.assetId)}
                  onChange={event => update('assetId', event.target.value)} className={fieldClass}>
                  <option value="">No linked asset</option>
                  {assets.map(asset => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
                </select>
                {selectedWorkOrder?.assetId && <p className="text-[11px] text-slate-500 mt-1">Inherited from the linked work order.</p>}
              </div>
              {textField('Issued By', 'issuedBy')}
              {textField('Issued Date', 'issuedDate', 'date')}
              {textField('Expiry Date', 'expiryDate', 'date')}
              {selectField('Status', 'status', permitStatuses)}
              {textField('Approved By', 'approvedBy')}
            </div>
            <div className="grid grid-cols-1 gap-2">
              <div><label htmlFor="permit-hazards" className="block text-xs text-slate-500 mb-1">Hazards</label><textarea id="permit-hazards" value={form.hazards} onChange={event => update('hazards', event.target.value)} rows={2} className={fieldClass} /></div>
              <div><label htmlFor="permit-precautions" className="block text-xs text-slate-500 mb-1">Precautions</label><textarea id="permit-precautions" value={form.precautions} onChange={event => update('precautions', event.target.value)} rows={2} className={fieldClass} /></div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={save} disabled={saving} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-6 py-2 rounded-lg text-sm font-medium">{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
