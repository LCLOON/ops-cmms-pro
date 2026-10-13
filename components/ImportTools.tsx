'use client';

import React, { useState } from 'react';
import { Upload, FileText, CheckCircle2, AlertTriangle } from 'lucide-react';
import Modal from './Modal';

const SOURCES = [
  { id: 'generic', label: 'Generic CSV' },
  { id: 'sap', label: 'SAP PM' },
  { id: 'maximo', label: 'IBM Maximo' },
  { id: 'fiix', label: 'Fiix' },
  { id: 'maintainx', label: 'MaintainX' },
  { id: 'emaint', label: 'eMaint' },
  { id: 'limble', label: 'Limble' },
  { id: 'upkeep', label: 'UpKeep' },
] as const;

interface PreviewAsset { name: string; category: string; location: string; status: string; criticality: string; }
interface Candidate {
  tempId: string; name: string; category: string; location: string; manufacturer: string;
  model: string; serialNumber: string; installYear: string; criticality: string; notes: string;
  confidence: number; evidence: string;
}

export default function ImportTools({ canEdit, onImported }: { canEdit: boolean; onImported: () => void }) {
  const [open, setOpen] = useState<'cmms' | 'doc' | null>(null);
  if (!canEdit) return null;

  return (
    <>
      <div className="flex items-center gap-2">
        <button onClick={() => setOpen('cmms')} className="flex items-center gap-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-lg px-3 py-1.5">
          <Upload className="w-3.5 h-3.5" /> Import from CMMS
        </button>
        <button onClick={() => setOpen('doc')} className="flex items-center gap-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-lg px-3 py-1.5">
          <FileText className="w-3.5 h-3.5" /> Ingest document
        </button>
      </div>
      {open === 'cmms' && <CmmsImport onClose={() => setOpen(null)} onImported={onImported} />}
      {open === 'doc' && <DocIngest onClose={() => setOpen(null)} onImported={onImported} />}
    </>
  );
}

function CmmsImport({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const [source, setSource] = useState<string>('generic');
  const [csv, setCsv] = useState('');
  const [preview, setPreview] = useState<PreviewAsset[] | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const run = async (isPreview: boolean) => {
    setBusy(true);
    setMessage('');
    try {
      const r = await fetch('/api/import', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'cmms', source, csv, preview: isPreview }),
      });
      const data = await r.json();
      if (!r.ok) { setMessage(data.error || 'Import failed'); return; }
      if (isPreview) {
        setPreview(data.assets ?? []);
        setWarnings(data.warnings ?? []);
      } else {
        setMessage(`Imported ${data.imported} assets.`);
        onImported();
      }
    } catch {
      setMessage('Network error');
    } finally { setBusy(false); }
  };

  const loadFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => setCsv(String(reader.result ?? ''));
    reader.readAsText(file);
  };

  return (
    <Modal open onClose={onClose} title="Import from another CMMS">
      <div className="space-y-4">
        <p className="text-xs text-slate-400">
          Export your asset register as CSV from SAP PM, Maximo, Fiix, MaintainX, eMaint, Limble or UpKeep. Preview maps the columns before anything is saved.
        </p>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Source system</label>
          <select value={source} onChange={e => setSource(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm">
            {SOURCES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">CSV file</label>
          <input type="file" accept=".csv,.txt,.tsv" onChange={e => { const f = e.target.files?.[0]; if (f) loadFile(f); }} className="text-xs text-slate-300" />
        </div>
        <textarea value={csv} onChange={e => setCsv(e.target.value)} rows={6} placeholder="Or paste CSV text here..." className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs font-mono" />
        <div className="flex gap-2">
          <button onClick={() => run(true)} disabled={busy || !csv.trim()} className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm">Preview</button>
          <button onClick={() => run(false)} disabled={busy || !preview} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm">Import {preview ? preview.length : ''} assets</button>
        </div>
        {message && <p className="text-sm text-emerald-400 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> {message}</p>}
        {warnings.length > 0 && (
          <div className="text-xs text-amber-400 space-y-1">
            <div className="flex items-center gap-1.5 font-medium"><AlertTriangle className="w-3.5 h-3.5" /> {warnings.length} warning(s)</div>
            {warnings.slice(0, 8).map((w, i) => <div key={i}>{w}</div>)}
          </div>
        )}
        {preview && (
          <div className="max-h-48 overflow-y-auto border border-slate-700 rounded-lg">
            <table className="w-full text-xs text-slate-300">
              <thead className="bg-slate-800 text-slate-400"><tr><th className="text-left px-2 py-1">Name</th><th className="text-left px-2 py-1">Category</th><th className="text-left px-2 py-1">Location</th><th className="text-left px-2 py-1">Status</th></tr></thead>
              <tbody>
                {preview.slice(0, 50).map((a, i) => (
                  <tr key={i} className="border-t border-slate-800"><td className="px-2 py-1">{a.name}</td><td className="px-2 py-1">{a.category}</td><td className="px-2 py-1">{a.location}</td><td className="px-2 py-1">{a.status}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  );
}

function DocIngest({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const [text, setText] = useState('');
  const [filename, setFilename] = useState('');
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [kept, setKept] = useState<Set<string>>(new Set());
  const [warnings, setWarnings] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const loadFile = (file: File) => {
    setFilename(file.name);
    const reader = new FileReader();
    reader.onload = () => setText(String(reader.result ?? ''));
    reader.readAsText(file);
  };

  const preview = async () => {
    setBusy(true);
    setMessage('');
    try {
      const r = await fetch('/api/documents/ingest', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, filename }),
      });
      const data = await r.json();
      if (!r.ok) { setMessage(data.error || 'Ingestion failed'); return; }
      const list: Candidate[] = data.candidates ?? [];
      setCandidates(list);
      setKept(new Set(list.map(c => c.tempId)));
      setWarnings(data.warnings ?? []);
    } catch {
      setMessage('Network error');
    } finally { setBusy(false); }
  };

  const commit = async () => {
    if (!candidates) return;
    const selected = candidates.filter(c => kept.has(c.tempId));
    setBusy(true);
    try {
      const r = await fetch('/api/documents/ingest', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commit: true, candidates: selected }),
      });
      const data = await r.json();
      if (!r.ok) { setMessage(data.error || 'Import failed'); return; }
      setMessage(`Created ${data.imported} assets.`);
      onImported();
    } catch {
      setMessage('Network error');
    } finally { setBusy(false); }
  };

  const toggle = (id: string) => setKept(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  return (
    <Modal open onClose={onClose} title="Ingest a document to build assets">
      <div className="space-y-4">
        <p className="text-xs text-slate-400">
          Paste text from an O&amp;M manual, asset register, nameplate sheet or walkdown notes — or upload a .txt/.csv file. Candidates are extracted locally and nothing is saved until you confirm.
        </p>
        <input type="file" accept=".txt,.csv,.tsv,.md" onChange={e => { const f = e.target.files?.[0]; if (f) loadFile(f); }} className="text-xs text-slate-300" />
        <textarea value={text} onChange={e => setText(e.target.value)} rows={7} placeholder="Paste document text here..." className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs" />
        <div className="flex gap-2">
          <button onClick={preview} disabled={busy || !text.trim()} className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm">Extract candidates</button>
          <button onClick={commit} disabled={busy || !candidates || kept.size === 0} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm">Create {kept.size} assets</button>
        </div>
        {message && <p className="text-sm text-emerald-400 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> {message}</p>}
        {warnings.map((w, i) => <p key={i} className="text-xs text-amber-400">{w}</p>)}
        {candidates && (
          <div className="max-h-56 overflow-y-auto border border-slate-700 rounded-lg divide-y divide-slate-800">
            {candidates.length === 0 && <p className="text-xs text-slate-400 p-3">No asset candidates found in that text.</p>}
            {candidates.map(c => (
              <label key={c.tempId} className="flex items-start gap-2 px-3 py-2 text-xs text-slate-300 cursor-pointer hover:bg-slate-800/50">
                <input type="checkbox" checked={kept.has(c.tempId)} onChange={() => toggle(c.tempId)} className="mt-0.5" />
                <div>
                  <div className="font-medium text-white">{c.name} <span className="text-slate-500 font-normal">· {c.category} · {Math.round(c.confidence * 100)}%</span></div>
                  <div className="text-slate-500">{[c.manufacturer, c.model, c.serialNumber, c.location].filter(Boolean).join(' · ') || c.evidence}</div>
                </div>
              </label>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
