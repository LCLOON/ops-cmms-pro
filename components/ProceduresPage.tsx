'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import DataTable, { type Column } from './DataTable';
import Modal from './Modal';
import { Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react';

type ResponseType = 'checkbox' | 'reading' | 'pass_fail' | 'text';

interface ProcedureStep {
  id: number;
  procedureId: string;
  stepOrder: number;
  instruction: string;
  expectedResult: string;
  responseType: ResponseType;
  unit: string;
  safetyNote: string;
}

interface Procedure {
  id: string;
  title: string;
  description: string;
  category: string;
  assetId: string;
  version: string;
  active: boolean;
  stepCount?: number;
  steps?: ProcedureStep[];
  createdAt: string;
  updatedAt: string;
}

const CATEGORIES = ['mechanical', 'electrical', 'hvac', 'plumbing', 'structural', 'safety', 'inspection', 'other'];
const RESPONSE_TYPES: ResponseType[] = ['checkbox', 'reading', 'pass_fail', 'text'];

const emptyStep = (order: number): ProcedureStep => ({
  id: 0, procedureId: '', stepOrder: order, instruction: '', expectedResult: '',
  responseType: 'checkbox', unit: '', safetyNote: '',
});

const defaultProcedure = (): Procedure => ({
  id: '', title: '', description: '', category: 'other', assetId: '', version: '1.0',
  active: true, steps: [emptyStep(1)], createdAt: '', updatedAt: '',
});

export default function ProceduresPage() {
  const { canEdit, loading: authLoading } = useAuth();
  const [items, setItems] = useState<Procedure[]>([]);
  const [loading, setLoading] = useState(true);
  const [editItem, setEditItem] = useState<Procedure | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Procedure>(defaultProcedure());
  const [saving, setSaving] = useState(false);

  const fetchItems = useCallback(() => {
    fetch('/api/procedures').then(r => r.json()).then(setItems).catch(() => {}).finally(() => setLoading(false));
  }, []);
  useEffect(() => { if (!authLoading) fetchItems(); }, [authLoading, fetchItems]);

  const openNew = () => { setForm(defaultProcedure()); setEditItem(null); setShowForm(true); };
  const openEdit = async (item: Procedure) => {
    const full = await fetch(`/api/procedures?id=${encodeURIComponent(item.id)}`).then(r => r.json()).catch(() => item);
    setForm({ ...defaultProcedure(), ...full, steps: full.steps?.length ? full.steps : [emptyStep(1)] });
    setEditItem(item);
    setShowForm(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const method = editItem ? 'PUT' : 'POST';
      const r = await fetch('/api/procedures', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if (!r.ok) { alert((await r.json()).error); return; }
      setShowForm(false);
      fetchItems();
    } finally { setSaving(false); }
  };

  const remove = async (item: Procedure) => {
    if (!confirm(`Delete procedure "${item.title}"? Work orders that already copied it keep their checklist.`)) return;
    await fetch('/api/procedures', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.id }) });
    fetchItems();
  };

  const columns: Column<Procedure>[] = [
    { key: 'title', header: 'Title' },
    { key: 'category', header: 'Category', render: p => <span className="capitalize">{p.category}</span> },
    { key: 'version', header: 'Version' },
    { key: 'stepCount', header: 'Steps', render: p => <span className="font-mono">{p.stepCount ?? 0}</span> },
    { key: 'assetId', header: 'Asset', render: p => <span className="text-xs text-slate-400">{p.assetId || 'Any'}</span> },
    { key: 'active', header: 'Active', render: p => <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium border ${p.active ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-slate-500/20 text-slate-400 border-slate-500/30'}`}>{p.active ? 'Yes' : 'No'}</span> },
  ];

  if (loading) return <div className="text-slate-400 p-8">Loading procedures...</div>;
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Procedures</h2>
        <p className="text-slate-400 text-sm mt-1">Reusable SOPs. Attach one to a PM or copy it onto a work order as a checklist. Editing a procedure does not rewrite checklists already copied.</p>
      </div>
      <DataTable data={items} columns={columns} onEdit={openEdit} onDelete={canEdit ? remove : undefined} onAdd={canEdit ? openNew : undefined}
        searchPlaceholder="Search procedures..." canEdit={canEdit} canDelete={canEdit} emptyMessage="No procedures yet." />
      {showForm && (
        <Modal open={showForm} onClose={() => setShowForm(false)} title={editItem ? `Edit procedure: ${editItem.id}` : 'New procedure'}>
          <ProcedureForm form={form} setForm={setForm} onSave={save} saving={saving} />
        </Modal>
      )}
    </div>
  );
}

function ProcedureForm({ form, setForm, onSave, saving }: {
  form: Procedure; setForm: (p: Procedure) => void; onSave: () => void; saving: boolean;
}) {
  const steps = form.steps || [];
  const setSteps = (next: ProcedureStep[]) => setForm({ ...form, steps: next.map((s, i) => ({ ...s, stepOrder: i + 1 })) });
  const updateStep = (index: number, patch: Partial<ProcedureStep>) => setSteps(steps.map((s, i) => i === index ? { ...s, ...patch } : s));
  const move = (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= steps.length) return;
    const next = [...steps];
    [next[index], next[j]] = [next[j], next[index]];
    setSteps(next);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-xs text-slate-500 mb-1">Title</label>
          <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Category</label>
          <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Version</label>
          <input value={form.version} onChange={e => setForm({ ...form, version: e.target.value })}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Asset ID (optional)</label>
          <input value={form.assetId} onChange={e => setForm({ ...form, assetId: e.target.value })} placeholder="Leave blank for any asset"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Active</label>
          <button type="button" onClick={() => setForm({ ...form, active: !form.active })}
            className={`w-full px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${form.active ? 'bg-green-600/20 text-green-400 border-green-500/30' : 'bg-slate-700/50 text-slate-400 border-slate-600'}`}>
            {form.active ? 'Active' : 'Inactive'}
          </button>
        </div>
      </div>
      <div>
        <label className="block text-xs text-slate-500 mb-1">Description</label>
        <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2}
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-white">Steps</h4>
          <button type="button" onClick={() => setSteps([...steps, emptyStep(steps.length + 1)])}
            className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"><Plus className="w-3.5 h-3.5" /> Add step</button>
        </div>
        {steps.map((step, i) => (
          <div key={i} className="border border-slate-800 rounded-lg p-3 space-y-2 bg-slate-950/40">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-slate-500 w-6">{i + 1}</span>
              <input value={step.instruction} onChange={e => updateStep(i, { instruction: e.target.value })} placeholder="Instruction"
                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <button type="button" onClick={() => move(i, -1)} className="text-slate-500 hover:text-white" aria-label="Move up"><ChevronUp className="w-4 h-4" /></button>
              <button type="button" onClick={() => move(i, 1)} className="text-slate-500 hover:text-white" aria-label="Move down"><ChevronDown className="w-4 h-4" /></button>
              <button type="button" onClick={() => setSteps(steps.filter((_, j) => j !== i))} className="text-slate-500 hover:text-red-400" aria-label="Remove step"><Trash2 className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-3 gap-2 pl-8">
              <select value={step.responseType} onChange={e => updateStep(i, { responseType: e.target.value as ResponseType })}
                className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500">
                {RESPONSE_TYPES.map(t => <option key={t} value={t}>{t.replace('_', '/')}</option>)}
              </select>
              <input value={step.expectedResult} onChange={e => updateStep(i, { expectedResult: e.target.value })} placeholder="Expected result"
                className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <input value={step.unit} onChange={e => updateStep(i, { unit: e.target.value })} placeholder="Unit (psi, °C)"
                className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <input value={step.safetyNote} onChange={e => updateStep(i, { safetyNote: e.target.value })} placeholder="Safety note (optional)"
              className="ml-8 w-[calc(100%-2rem)] bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-amber-200 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500" />
          </div>
        ))}
      </div>
      <div className="flex justify-end pt-2 border-t border-slate-800">
        <button onClick={onSave} disabled={saving} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors">
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
}
