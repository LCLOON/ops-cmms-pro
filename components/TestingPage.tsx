'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import DataTable, { type Column } from './DataTable';
import Modal from './Modal';
import { navigate } from '@/lib/nav';
import type { EquipmentTest, TestDiscipline } from '@/lib/types';

interface AssetOption { id: string; name: string; }

const testTypes: Record<TestDiscipline, EquipmentTest['testType'][]> = {
  electrical: ['transformer_oil', 'dga', 'breaker_timing', 'relay_test', 'battery_test', 'charger_test', 'ir_scan', 'ground_test', 'cable_test', 'protection_settings', 'other'],
  mechanical: ['vibration_analysis', 'lubrication_analysis', 'alignment_check', 'pressure_test', 'load_test', 'performance_test', 'ultrasound', 'thermography', 'ndt_inspection', 'other'],
};

const emptyTest = (): EquipmentTest => ({
  id: '', assetId: '', discipline: 'electrical', testType: 'transformer_oil',
  testDate: new Date().toISOString().slice(0, 10), results: '', nextDue: '',
  testedBy: '', status: 'pending', notes: '', createdAt: '', updatedAt: '',
});

const statusStyles: Record<EquipmentTest['status'], string> = {
  pending: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  passed: 'bg-green-500/20 text-green-400 border-green-500/30',
  failed: 'bg-red-500/20 text-red-400 border-red-500/30',
  attention: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
};

const humanize = (value: string) => value.replace(/_/g, ' ');

export default function TestingPage() {
  const { canEdit, isAdmin } = useAuth();
  const [items, setItems] = useState<EquipmentTest[]>([]);
  const [assets, setAssets] = useState<AssetOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<EquipmentTest | null>(null);
  const [form, setForm] = useState<EquipmentTest>(emptyTest);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<EquipmentTest['status'] | 'all'>('all');

  const fetchItems = useCallback(() => {
    fetch('/api/electrical-tests')
      .then(r => { if (!r.ok) throw new Error(`Testing records request failed (${r.status})`); return r.json(); })
      .then((rows: EquipmentTest[]) => { if (!Array.isArray(rows)) throw new Error('Testing response was not a list'); setItems(rows); setLoadError(false); })
      .catch(error => { console.error('[testing] Failed to load testing records', error); setLoadError(true); })
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { fetchItems(); }, [fetchItems]);
  useEffect(() => {
    fetch('/api/assets')
      .then(r => { if (!r.ok) throw new Error(`Assets request failed (${r.status})`); return r.json(); })
      .then((rows: AssetOption[]) => { if (Array.isArray(rows)) setAssets(rows.map(a => ({ id: a.id, name: a.name }))); })
      .catch(error => console.error('[testing] Failed to load assets', error));
  }, []);

  const openNew = () => { setForm(emptyTest()); setEditItem(null); setShowForm(true); };
  const openEdit = (item: EquipmentTest) => { setForm({ ...item }); setEditItem(item); setShowForm(true); };
  const update = (key: keyof EquipmentTest, value: string) => setForm({ ...form, [key]: value });

  const save = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/electrical-tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!response.ok) { alert((await response.json()).error); return; }
      setShowForm(false);
      fetchItems();
    } finally { setSaving(false); }
  };

  const remove = async (item: EquipmentTest) => {
    if (!confirm('Delete this test record?')) return;
    const response = await fetch('/api/electrical-tests', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.id }),
    });
    if (!response.ok) { alert((await response.json()).error); return; }
    fetchItems();
  };

  const raiseWorkOrder = (item: EquipmentTest) => {
    const typeLabel = humanize(item.testType);
    navigate('work-orders', {
      assetId: item.assetId,
      workOrderDraft: {
        title: `Investigate ${typeLabel} test ${item.status}`,
        description: [
          `${humanize(item.discipline)} test recorded as ${item.status}.`,
          `Test date: ${item.testDate || 'not recorded'}`,
          item.results ? `Results: ${item.results}` : '',
          item.notes ? `Notes: ${item.notes}` : '',
        ].filter(Boolean).join('\n'),
      },
    });
  };

  const filtered = filter === 'all' ? items : items.filter(item => item.status === filter);
  const columns: Column<EquipmentTest>[] = [
    { key: 'testType', header: 'Test', render: item => (
      <span className="capitalize text-xs">{humanize(item.discipline)} · {humanize(item.testType)}</span>
    ) },
    { key: 'assetId', header: 'Asset', render: item => item.assetId ? (
      <button onClick={() => navigate('assets', { focusId: item.assetId })} className="text-blue-400 hover:text-blue-300 hover:underline text-xs text-left">
        {assets.find(asset => asset.id === item.assetId)?.name ?? item.assetId}
      </button>
    ) : <span className="text-slate-600">Unlinked</span> },
    { key: 'status', header: 'Status', render: item => (
      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${statusStyles[item.status]}`}>{item.status}</span>
    ) },
    { key: 'testDate', header: 'Date' },
    { key: 'nextDue', header: 'Next Due' },
    { key: 'testedBy', header: 'Tested By' },
    { key: 'results', header: 'Results', render: item => <span className="block max-w-[220px] truncate" title={item.results}>{item.results || '-'}</span> },
    { key: 'followUp', header: 'Follow-up', render: item => ['failed', 'attention'].includes(item.status) ? (
      !canEdit
        ? <span className="text-xs text-slate-500">Read only</span>
        : item.assetId
        ? <button onClick={() => raiseWorkOrder(item)} className="text-amber-300 hover:text-amber-200 underline text-xs">Raise corrective WO</button>
        : <span className="text-xs text-amber-400">Link asset first</span>
    ) : <span className="text-slate-600">-</span> },
  ];

  if (loading) return <div className="text-slate-400 p-8">Loading testing register...</div>;

  const fieldClass = 'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
  const select = (label: string, key: keyof EquipmentTest, options: string[]) => (
    <div>
      <label className="block text-xs text-slate-500 mb-1">{label}</label>
      <select value={String(form[key])} onChange={event => update(key, event.target.value)} className={fieldClass}>
        {options.map(option => <option key={option} value={option}>{humanize(option)}</option>)}
      </select>
    </div>
  );
  const textField = (label: string, key: keyof EquipmentTest, type = 'text') => (
    <div>
      <label className="block text-xs text-slate-500 mb-1">{label}</label>
      <input type={type} value={String(form[key] ?? '')} onChange={event => update(key, event.target.value)} className={fieldClass} />
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Testing</h2>
        <p className="text-slate-400 text-sm mt-1">Track electrical and mechanical test results, due dates, and corrective follow-up.</p>
      </div>
      <div className="flex gap-3 flex-wrap">
        {(['all', 'failed', 'attention', 'pending', 'passed'] as const).map(status => (
          <button key={status} onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded-lg text-sm border ${filter === status ? 'bg-blue-600/20 border-blue-500/30 text-blue-400' : 'bg-slate-800/50 border-slate-700/50 text-slate-400'}`}>
            {status === 'all' ? 'All' : status} ({status === 'all' ? items.length : items.filter(item => item.status === status).length})
          </button>
        ))}
      </div>
      {loadError && <p className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">Could not load testing records. Refresh to try again.</p>}
      <DataTable data={filtered} columns={columns} onEdit={canEdit ? openEdit : undefined} onDelete={isAdmin ? remove : undefined}
        onAdd={canEdit ? openNew : undefined} searchPlaceholder="Search tests and assets..." emptyMessage="No testing records found."
        canEdit={canEdit} canDelete={isAdmin} />
      {showForm && (
        <Modal open onClose={() => setShowForm(false)} title={editItem ? 'Edit Test Record' : 'New Test Record'}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Discipline</label>
                <select value={form.discipline} onChange={event => {
                  const discipline = event.target.value as TestDiscipline;
                  setForm({ ...form, discipline, testType: testTypes[discipline][0] });
                }} className={fieldClass}>
                  <option value="electrical">Electrical</option>
                  <option value="mechanical">Mechanical</option>
                </select>
              </div>
              {select('Test Type', 'testType', testTypes[form.discipline])}
              <div>
                <label className="block text-xs text-slate-500 mb-1">Asset</label>
                <select value={form.assetId} onChange={event => update('assetId', event.target.value)} className={fieldClass}>
                  <option value="">Unlinked</option>
                  {assets.map(asset => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
                </select>
              </div>
              {textField('Test Date', 'testDate', 'date')}
              {textField('Next Due', 'nextDue', 'date')}
              {textField('Tested By', 'testedBy')}
              {select('Status', 'status', ['pending', 'passed', 'failed', 'attention'])}
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Results</label>
              <textarea value={form.results} onChange={event => update('results', event.target.value)} rows={3} className={fieldClass} />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Notes</label>
              <textarea value={form.notes} onChange={event => update('notes', event.target.value)} rows={2} className={fieldClass} />
            </div>
            <div className="flex justify-end gap-3 pt-2 border-t border-slate-800">
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-white px-4 py-2 rounded-lg text-sm">Cancel</button>
              <button onClick={save} disabled={saving} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-6 py-2 rounded-lg text-sm font-medium">
                {saving ? 'Saving...' : 'Save test'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
