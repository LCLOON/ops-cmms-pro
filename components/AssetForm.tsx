'use client';

import React, { useMemo } from 'react';
import {
  AssetRecord, ASSET_CATEGORIES, ASSET_STATUSES, ASSET_CRITICALITIES,
  indexById, pathLabel,
} from './asset-types';

interface Props {
  form: AssetRecord;
  setForm: (a: AssetRecord) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  allAssets: AssetRecord[];
  sites: { id: string; name: string }[];
  isNew: boolean;
}

const inputClass = 'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <fieldset className="border border-slate-800 rounded-xl p-4">
      <legend className="px-2 text-xs font-semibold text-slate-400 uppercase tracking-wide">{title}</legend>
      {hint && <p className="text-xs text-slate-500 mb-3 -mt-1">{hint}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
    </fieldset>
  );
}

export default function AssetForm({ form, setForm, onSave, onCancel, saving, allAssets, sites, isNew }: Props) {
  const byId = useMemo(() => indexById(allAssets), [allAssets]);

  // A parent that is this asset or one of its own descendants would detach the
  // whole branch from the tree, so those are not offered as choices.
  const blockedParents = useMemo(() => {
    const childrenOf = new Map<string, string[]>();
    for (const a of allAssets) {
      if (!a.parentId) continue;
      const list = childrenOf.get(a.parentId) ?? [];
      list.push(a.id);
      childrenOf.set(a.parentId, list);
    }
    const blocked = new Set<string>();
    if (!form.id) return blocked;
    blocked.add(form.id);
    const stack = [form.id];
    while (stack.length) {
      const id = stack.pop();
      if (!id) continue;
      for (const child of childrenOf.get(id) ?? []) {
        if (!blocked.has(child)) { blocked.add(child); stack.push(child); }
      }
    }
    return blocked;
  }, [allAssets, form.id]);

  const parentOptions = useMemo(
    () => allAssets
      .filter(a => !blockedParents.has(a.id))
      .map(a => ({ id: a.id, label: pathLabel(a, byId) }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    [allAssets, blockedParents, byId],
  );

  const set = (key: keyof AssetRecord, value: string | number) => setForm({ ...form, [key]: value });

  const text = (label: string, key: keyof AssetRecord, opts: { type?: string; placeholder?: string; autoFocus?: boolean } = {}) => (
    <div>
      <label htmlFor={`asset-${key}`} className="block text-xs text-slate-500 mb-1">{label}</label>
      <input
        id={`asset-${key}`}
        type={opts.type ?? 'text'}
        value={opts.type === 'number' ? String(form[key] ?? '') : String(form[key] ?? '')}
        placeholder={opts.placeholder}
        autoFocus={opts.autoFocus}
        onChange={e => set(key, opts.type === 'number' ? Number(e.target.value) : e.target.value)}
        className={inputClass}
      />
    </div>
  );

  const choice = (label: string, key: keyof AssetRecord, options: string[]) => (
    <div>
      <label htmlFor={`asset-${key}`} className="block text-xs text-slate-500 mb-1">{label}</label>
      <select id={`asset-${key}`} value={String(form[key] ?? '')} onChange={e => set(key, e.target.value)} className={inputClass}>
        {options.map(o => <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>)}
      </select>
    </div>
  );

  const parentPath = form.parentId ? byId.get(form.parentId) : undefined;

  return (
    <div className="space-y-4">
      {form.parentId && (
        <div className="text-xs text-slate-400 bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2">
          Adding under: <span className="text-blue-300">{parentPath ? pathLabel(parentPath, byId) : form.parentId}</span>
        </div>
      )}

      <Section title="What is it?" hint="Only the name is required. Everything else can be filled in later.">
        {text('Asset name', 'name', { autoFocus: true, placeholder: 'e.g. Forbay Headworks' })}
        {choice('Category', 'category', ASSET_CATEGORIES)}
        <div className="sm:col-span-2">
          <label htmlFor="asset-parentId" className="block text-xs text-slate-500 mb-1">Sits under</label>
          <select id="asset-parentId" value={form.parentId} onChange={e => set('parentId', e.target.value)} className={inputClass}>
            <option value="">Top level (no parent)</option>
            {parentOptions.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </div>
      </Section>

      <Section title="Where is it?">
        <div>
          <label htmlFor="asset-siteId" className="block text-xs text-slate-500 mb-1">Site</label>
          <select id="asset-siteId" value={form.siteId ?? ''} onChange={e => set('siteId', e.target.value)} className={inputClass}>
            <option value="">Unassigned</option>
            {sites.map(site => <option key={site.id} value={site.id}>{site.name}</option>)}
          </select>
        </div>
        {text('Location', 'location', { placeholder: 'e.g. Forebay deck' })}
        {text('Department', 'department', { placeholder: 'e.g. Operations' })}
        {text('Area', 'area')}
        {text('System', 'system')}
      </Section>

      <Section title="Equipment details" hint="Optional. Useful for spares, warranty claims and vendor support.">
        {text('Manufacturer', 'manufacturer')}
        {text('Model', 'model')}
        {text('Serial number', 'serialNumber')}
        {text('Install date', 'installDate', { type: 'date' })}
        {text('Warranty expiry', 'warrantyExpiry', { type: 'date' })}
      </Section>

      <Section title="Operating status">
        {choice('Status', 'status', ASSET_STATUSES)}
        {choice('Criticality', 'criticality', ASSET_CRITICALITIES)}
        {text('Failure mode', 'failureMode', { placeholder: 'e.g. Bearing wear' })}
        {text('Replacement cost ($)', 'replacementCost', { type: 'number' })}
      </Section>

      <div>
        <label htmlFor="asset-notes" className="block text-xs text-slate-500 mb-1">Notes</label>
        <textarea id="asset-notes" value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} className={inputClass} />
      </div>

      {isNew && (
        <p className="text-xs text-slate-500">An asset ID is generated automatically when you save.</p>
      )}

      <div className="flex justify-end gap-3 pt-2 border-t border-slate-800">
        <button type="button" onClick={onCancel} className="text-slate-400 hover:text-white px-4 py-2 rounded-lg text-sm transition-colors">Cancel</button>
        <button onClick={onSave} disabled={saving || !form.name.trim()}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors">
          {saving ? 'Saving...' : 'Save asset'}
        </button>
      </div>
    </div>
  );
}
