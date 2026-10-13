'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';

interface Props {
  onSelect: (result: { type: string; id: string; label: string }) => void;
}

export default function GlobalSearch({ onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ type: string; id: string; label: string }[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); setOpen(true); setTimeout(() => inputRef.current?.focus(), 50); }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (query.length < 2) return;
    const q = query.toLowerCase();
    const timer = setTimeout(() => {
      Promise.all([
        fetch('/api/assets').then(r => r.json()),
        fetch('/api/work-orders').then(r => r.json()),
        fetch('/api/pm-tasks').then(r => r.json()),
      ]).then(([assets, wos, pms]) => {
        const r: { type: string; id: string; label: string }[] = [];
        for (const a of assets) { if (String(a.name).toLowerCase().includes(q) || String(a.id).toLowerCase().includes(q)) r.push({ type: 'Asset', id: a.id, label: a.name }); }
        for (const w of wos) { if (String(w.title).toLowerCase().includes(q) || String(w.id).toLowerCase().includes(q)) r.push({ type: 'WO', id: w.id, label: w.title }); }
        for (const p of pms) { if (String(p.title).toLowerCase().includes(q) || String(p.id).toLowerCase().includes(q)) r.push({ type: 'PM', id: p.id, label: p.title }); }
        setResults(r.slice(0, 12));
      }).catch(() => setResults([]));
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  if (!open) return (
    <button onClick={() => setOpen(true)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-slate-500 bg-slate-800/50 border border-slate-700/50 hover:border-slate-600 transition-colors">
      <Search className="w-3.5 h-3.5" />
      <span className="hidden sm:inline">Search...</span>
      <kbd className="hidden sm:inline ml-2 px-1.5 py-0.5 rounded text-[10px] bg-slate-700 text-slate-400">Ctrl+K</kbd>
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]" onClick={() => setOpen(false)}>
      <div ref={ref} className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800">
          <Search className="w-4 h-4 text-slate-500" />
          <input ref={inputRef} autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Search assets, work orders, PMs..." className="flex-1 bg-transparent text-white text-sm outline-none placeholder:text-slate-500" />
          <kbd className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-500">ESC</kbd>
        </div>
        {results.length > 0 ? (
          <div className="max-h-64 overflow-auto p-2">
            {results.map((r, i) => (
              <button key={i} onClick={() => { onSelect(r); setOpen(false); setQuery(''); }} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-left hover:bg-slate-800/50 transition-colors">
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${r.type === 'Asset' ? 'bg-blue-500/20 text-blue-400' : r.type === 'WO' ? 'bg-amber-500/20 text-amber-400' : 'bg-green-500/20 text-green-400'}`}>{r.type}</span>
                <span className="text-slate-300 truncate">{r.label}</span>
                <span className="ml-auto text-xs text-slate-600">{r.id}</span>
              </button>
            ))}
          </div>
        ) : query.length >= 2 ? (
          <div className="p-8 text-center text-sm text-slate-500">No results for &quot;{query}&quot;</div>
        ) : (
          <div className="p-8 text-center text-sm text-slate-500">Type 2+ characters to search assets, work orders, and PMs</div>
        )}
      </div>
    </div>
  );
}
