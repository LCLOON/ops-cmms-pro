'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Link as LinkIcon, RefreshCw } from 'lucide-react';
import type { EhsProcedureView } from '@/lib/ehs-procedures';

export default function EhsProcedurePanel({ workOrderId }: { workOrderId: string }) {
  const [view, setView] = useState<EhsProcedureView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [saving, setSaving] = useState(false);
  const [offline, setOffline] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [selected, setSelected] = useState('');

  useEffect(() => {
    const update = () => { setOffline(!navigator.onLine); setRefresh(value => value + 1); };
    const visible = () => { if (document.visibilityState === 'visible') update(); };
    update();
    const interval = window.setInterval(visible, 30000);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    window.addEventListener('focus', visible);
    document.addEventListener('visibilitychange', visible);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
      window.removeEventListener('focus', visible);
      document.removeEventListener('visibilitychange', visible);
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const load = async () => {
      setChecking(true);
      try {
        if (!navigator.onLine) throw new Error('Offline. Current source status is unverified.');
        const response = await fetch(`/api/work-orders/ehs-procedure?workOrderId=${encodeURIComponent(workOrderId)}`, { cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]) });
        const payload = await response.json();
        if (!response.ok) {
          if (active && [401, 403].includes(response.status)) setView(null);
          throw new Error(payload.error || 'Procedure check failed');
        }
        if (active) { setView(payload); setError(null); }
      } catch (failure) {
        if (active) setError(failure instanceof Error ? failure.message : 'Procedure check failed');
      } finally { if (active) setChecking(false); }
    };
    void load();
    return () => { active = false; controller.abort(); };
  }, [workOrderId, refresh]);

  const attach = async () => {
    if (!selected || !window.confirm('Attach this exact approved revision to the saved work order? It will remain pinned when newer revisions are published.')) return;
    setSaving(true);
    try {
      const response = await fetch('/api/work-orders/ehs-procedure', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workOrderId, revisionId: selected, contextDigest: view?.contextDigest }), signal: AbortSignal.timeout(15000),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Attachment failed');
      setSelected('');
      setRefresh(value => value + 1);
    } catch (failure) {
      setError(failure instanceof Error ? `${failure.message}. Reload before retrying.` : 'Save outcome unknown. Reload before retrying.');
    } finally { setSaving(false); }
  };

  const current = view?.attachment?.revision;
  const preview = view?.options.find(item => item.revision.id === selected)?.revision;
  const content = current ?? preview;
  const verified = !checking && !offline && !error && !view?.warning;
  const source = verified ? view?.source : null;
  const warning = offline ? 'Offline. Current source status is unverified.' : error || view?.warning;

  return (
    <section className="min-w-0 space-y-4" aria-label="EHS procedure">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-white">EHS procedure</h3>
        <button type="button" onClick={() => setRefresh(value => value + 1)} disabled={checking || saving} title="Refresh procedure status" aria-label="Refresh procedure status" className="p-2 rounded border border-slate-600 text-slate-200 disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${checking ? 'animate-spin' : ''}`} />
        </button>
      </div>
      <p className="text-sm text-amber-200">Reference only. This is not work authorization or isolation clearance.</p>
      {view && <div className="space-y-1 text-sm text-slate-300 break-words">
        <p>{view.workOrder.title}</p>
        <p className="whitespace-pre-wrap">{view.workOrder.description}</p>
        <p>Asset: {view.workOrder.assetId || 'Site level'} | Assigned to: {view.workOrder.assignedTo || 'Unassigned'}</p>
      </div>}
      {checking && <p role="status" className="text-sm text-slate-300">Checking source...</p>}
      {warning && <p role="alert" className="flex items-start gap-2 text-sm text-amber-200 break-words"><AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />{warning}</p>}
      {view?.attachment?.contextChanged && <p role="alert" className="text-sm text-amber-200">Work-order scope, asset, or assignee changed since selection. Planner review required.</p>}
      {source && source.latest.id !== current?.id && <p role="status" className="text-sm text-amber-200">Newer approved revision {source.latest.revision} available for planner review. Attached revision remains {current?.revision}.</p>}
      {source && source.sourceState !== 'current' && <p role="alert" className="text-sm text-amber-200">Source is {source.sourceState}. Retained revision is historical evidence; planner review required.</p>}
      {source && <p className="text-xs text-slate-400">Source checked: {view?.checkedAt ? new Date(view.checkedAt).toLocaleString() : 'Unverified'}</p>}
      {view && !current && <p className="text-sm text-slate-300">No EHS revision attached.</p>}
      {view?.canAttach && (
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1 text-sm text-slate-300">
            <label htmlFor="ehs-procedure-selection">Approved procedure</label>
            <select id="ehs-procedure-selection" value={selected} onChange={event => setSelected(event.target.value)} disabled={!verified || saving} className="mt-1 block w-full min-w-0 rounded border border-slate-600 bg-slate-900 p-2 text-white">
              <option value="">Select a revision</option>
              {view.options.map(item => <option key={item.revision.id} value={item.revision.id}>{item.revision.number} - {item.revision.title} - Rev {item.revision.revision}</option>)}
            </select>
          </div>
          <button type="button" onClick={attach} disabled={!preview || !verified || saving} className="inline-flex items-center gap-2 rounded bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-50"><LinkIcon className="h-4 w-4" />{saving ? 'Attaching...' : 'Attach revision'}</button>
        </div>
      )}
      {content && (
        <div className="min-w-0 space-y-2 border-t border-slate-700 pt-4">
          <h4 className="break-words text-base font-semibold text-white">{content.title}</h4>
          <p className="break-words text-sm text-slate-300">{content.number} | {current ? 'Attached revision' : 'Preview revision'} {content.revision}</p>
          <p className="break-words text-xs text-slate-400">Approved by {content.approvedBy} at {new Date(content.approvedAt).toLocaleString()}</p>
          {view?.attachment && <p className="text-xs text-slate-400 break-words">Selected by {view.attachment.selectedBy} at {new Date(view.attachment.selectedAt).toLocaleString()}</p>}
          <div className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-200" data-testid="ehs-procedure-content">{content.content}</div>
        </div>
      )}
    </section>
  );
}