'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import DataTable, { type Column } from './DataTable';
import Modal from './Modal';
import { Play } from 'lucide-react';

interface PmSchedule {
  id: string; assetId: string; title: string; description: string;
  frequencyType: string; frequencyValue: number; lastCompleted: string;
  nextDue: string; assignedTo: string; estimatedHours: number;
  active: boolean; createdAt: string; updatedAt: string;
  assetName?: string; siteName?: string;
  deferralReason?: string; deferralApprovedBy?: string; procedureId?: string;
}

const defaultPM: PmSchedule = {
  id: '', assetId: '', title: '', description: '', frequencyType: 'weekly',
  frequencyValue: 1, lastCompleted: '', nextDue: '', assignedTo: '',
  estimatedHours: 1, active: true, procedureId: '', createdAt: '', updatedAt: '',
};

const freqLabels: Record<string, string> = {
  daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', quarterly: 'Quarterly',
  semi_annual: 'Semi-Annual', annual: 'Annual', runtime_hours: 'Runtime Hours',
};

export default function PmSchedulePage() {
  const { canEdit, loading: authLoading } = useAuth();
  const [items, setItems] = useState<PmSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [editItem, setEditItem] = useState<PmSchedule | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<PmSchedule>(defaultPM);
  const [saving, setSaving] = useState(false);

  const fetchItems = useCallback(() => {
    fetch('/api/pm-tasks').then(r => r.json()).then(setItems).catch(() => {}).finally(() => setLoading(false));
  }, []);
  useEffect(() => { if (!authLoading) fetchItems(); }, [authLoading, fetchItems]);

  const openNew = () => { setForm(defaultPM); setEditItem(null); setShowForm(true); };
  const openEdit = (item: PmSchedule) => { setForm({ ...item }); setEditItem(item); setShowForm(true); };

  const save = async () => {
    setSaving(true);
    try {
      const method = editItem ? 'PUT' : 'POST';
      const r = await fetch('/api/pm-tasks', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if (!r.ok) { alert((await r.json()).error); return; }
      setShowForm(false); fetchItems();
    } finally { setSaving(false); }
  };

  const remove = async (item: PmSchedule) => {
    if (!confirm(`Delete PM "${item.title}"?`)) return;
    await fetch('/api/pm-tasks', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.id }) });
    fetchItems();
  };

  const columns: Column<PmSchedule>[] = [
    { key: 'title', header: 'Title', render: p => <div className="flex items-center gap-1 min-w-0 max-w-[260px]" title={p.title}><span className="truncate text-sm">{p.title}</span>{p.deferralReason && <span className='shrink-0 px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-400'>Deferred</span>}</div> },
    { key: 'siteName', header: 'Site / Asset', render: p => <div className="min-w-[140px]"><span className="text-xs font-medium text-blue-400 block">{p.siteName || '—'}</span><span className="text-xs text-slate-500 truncate block">{p.assetName || p.assetId}</span></div> },
    { key: 'frequencyType', header: 'Frequency', render: p => <span className="text-xs whitespace-nowrap">{freqLabels[p.frequencyType] || p.frequencyType}{p.frequencyValue > 1 ? ` ×${p.frequencyValue}` : ''}</span> },
    { key: 'nextDue', header: 'Next Due', render: p => <span className="whitespace-nowrap text-xs">{p.nextDue || '—'}</span> },
    { key: 'assignedTo', header: 'Assigned', render: p => <span className="text-xs truncate max-w-[80px] block">{p.assignedTo || '—'}</span> },
    { key: 'active', header: 'Active', render: p => <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium border ${p.active ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-slate-500/20 text-slate-400 border-slate-500/30'}`}>{p.active ? '✓' : '—'}</span> },
  ];

  if (loading) return <div className="text-slate-400 p-8">Loading PM schedules...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Preventive Maintenance</h2>
          <p className="text-slate-400 text-sm mt-1">Schedule and manage recurring maintenance tasks</p>
        </div>
        {canEdit && (
          <button onClick={async () => {
            const today = new Date().toISOString().slice(0, 10);
            const overdue = items.filter(pm => pm.active && (!pm.nextDue || pm.nextDue <= today));
            if (overdue.length === 0) { alert('No overdue PMs found.'); return; }
            if (!confirm(`Generate work orders for ${overdue.length} overdue PM(s)?`)) return;
            let ok = 0, fail = 0;
            for (const pm of overdue) {
              const r = await fetch('/api/pm-tasks/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pmId: pm.id }) });
              if (r.ok) ok++; else fail++;
            }
            alert(`Generated ${ok} work order(s)${fail > 0 ? `, ${fail} failed` : ''}.`);
            fetchItems();
          }} className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <Play className="w-4 h-4" /> Generate All Overdue WOs
          </button>
        )}
      </div>
      <DataTable
        data={items} columns={columns}
        onEdit={openEdit} onDelete={canEdit ? remove : undefined}
        onAdd={canEdit ? openNew : undefined}
        searchPlaceholder="Search PM schedules..."
        canEdit={canEdit} canDelete={canEdit}
        emptyMessage="No PM schedules found."
      />
      {showForm && (
        <Modal open={showForm} onClose={() => setShowForm(false)} title={editItem ? 'Edit PM Schedule' : 'New PM Schedule'}>
          <PMForm form={form} setForm={setForm} onSave={save} saving={saving} onClose={() => setShowForm(false)} />
        </Modal>
      )}
    </div>
  );
}

function PMForm({ form, setForm, onSave, saving, onClose }: {
  form: PmSchedule; setForm: (f: PmSchedule) => void; onSave: () => void; saving: boolean; onClose: () => void;
}) {
  const [procedures, setProcedures] = useState<{ id: string; title: string; version: string; active: boolean; status: string }[]>([]);
  useEffect(() => {
    // Only approved, active SOPs may be attached to a PM schedule.
    fetch('/api/procedures').then(r => r.json()).then((rows: { id: string; title: string; version: string; active: boolean; status: string }[]) => setProcedures(rows.filter(p => p.active && p.status === 'approved'))).catch(() => {});
  }, []);
  const update = (k: keyof PmSchedule, v: string | number | boolean) => setForm({ ...form, [k]: v });
  const field = (label: string, key: keyof PmSchedule, type = 'text') => (
    <div>
      <label className="block text-xs text-slate-500 mb-1">{label}</label>
      <input type={type} value={String(form[key] ?? '')}
        onChange={e => update(key, type === 'number' ? Number(e.target.value) : e.target.value)}
        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {field('Title', 'title')}
        {field('Asset ID', 'assetId')}
        <div>
          <label className="block text-xs text-slate-500 mb-1">Frequency</label>
          <select value={form.frequencyType} onChange={e => update('frequencyType', e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {['daily','weekly','monthly','quarterly','semi_annual','annual','runtime_hours'].map(o => <option key={o} value={o}>{o.replace('_', ' ')}</option>)}
          </select>
        </div>
        {field('Every (value)', 'frequencyValue', 'number')}
        {field('Next Due', 'nextDue', 'date')}
        {field('Last Completed', 'lastCompleted', 'date')}
        <div>
          <label className="block text-xs text-slate-500 mb-1">Procedure</label>
          <select value={form.procedureId || ''} onChange={e => update('procedureId', e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">None — generated work orders have no checklist</option>
            {procedures.map(p => <option key={p.id} value={p.id}>{p.title} v{p.version}</option>)}
          </select>
        </div>
        {field('Assigned To', 'assignedTo')}
        {field('Est. Hours', 'estimatedHours', 'number')}
        {field('Deferral Reason', 'deferralReason')}
        {field('Deferral Approved By', 'deferralApprovedBy')}
        <div>
          <label className="block text-xs text-slate-500 mb-1">Active</label>
          <button type="button" onClick={() => update('active', !form.active)}
            className={`w-full px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${form.active ? 'bg-green-600/20 text-green-400 border-green-500/30' : 'bg-slate-700/50 text-slate-400 border-slate-600'}`}>
            {form.active ? 'Active' : 'Inactive'}
          </button>
        </div>
      </div>
      <div>
        <label className="block text-xs text-slate-500 mb-1">Description</label>
        <textarea value={form.description} onChange={e => update('description', e.target.value)} rows={3}
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onClose} className="text-slate-400 hover:text-white px-4 py-2 rounded-lg text-sm transition-colors">Cancel</button>
        <button onClick={onSave} disabled={saving}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors">
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
}
