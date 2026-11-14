'use client';

import React, { useState, useEffect, useCallback } from 'react';

interface ComplianceItem { title: string; siteName: string; obligationType: string; nextDue: string; status: string; priority: string; }
interface BacklogItem { aging: string; count: number; totalCost: number; }
interface ReportAnalytics {
  pmCompliance: { overdue: number; complianceRate: number };
  inventoryValue: { totalItems: number; lowStockCount: number };
  ytdStats: { totalWOs: number; totalLaborHours: number };
  backlog?: BacklogItem[];
  assetInsights?: {
    warranty: { id: string; name: string; warrantyExpiry: string; daysLeft: number }[];
    failureModes: { failureMode: string; count: number }[];
    replaceCandidates: { id: string; name: string; maintenanceCost: number; replacementCost: number; ratio: number }[];
  };
}

const siteNames: Record<string, string> = { 'SITE-LOCK': 'Lockwood', 'SITE-KENN': 'Hydro-Kennebec', 'SITE-SHAW': 'Shawmut', 'SITE-WEST': 'Weston' };

export default function ReportsPage() {
  const [analytics, setAnalytics] = useState<ReportAnalytics | null>(null);
  const [compliance, setCompliance] = useState<ComplianceItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(() => {
    Promise.all([fetch('/api/analytics'), fetch('/api/compliance')])
      .then(async ([ar, cr]) => {
        setAnalytics(await ar.json());
        const compData = await cr.json();
        setCompliance(Array.isArray(compData) ? compData.slice(0, 20) : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading || !analytics) return <div className="text-slate-400 p-8">Loading reports...</div>;

  const urgentCompliance = compliance.filter((c: ComplianceItem) => c.status === 'overdue' || (c.nextDue && c.nextDue < new Date().toISOString().slice(0, 10)));
  const backlog = analytics.backlog ?? [];
  const insights = analytics.assetInsights;
  const warranty = insights?.warranty ?? [];
  const failureModes = insights?.failureModes ?? [];
  const replaceCandidates = insights?.replaceCandidates ?? [];
  const maxFailure = Math.max(1, ...failureModes.map(f => f.count));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Reports & Analytics</h2>
        <p className="text-slate-400 text-sm mt-1">Backlog, compliance status, cost analysis, and maintenance KPIs</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-white mb-4">⚠️ Urgent Compliance Items</h3>
          {urgentCompliance.length > 0 ? (
            <div className="space-y-2">{urgentCompliance.slice(0, 8).map((c: ComplianceItem, i: number) => (
              <div key={i} className="flex items-center justify-between text-xs py-2 border-b border-slate-800/50">
                <div><span className="text-slate-300">{c.title}</span><span className="text-slate-600 ml-2">{siteNames[c.siteName] || c.siteName}</span></div>
                <span className="text-red-400">{c.nextDue || 'No date'}</span>
              </div>))}</div>
          ) : <p className="text-green-400 text-sm">All compliance items are current. ✓</p>}
        </div>

        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-white mb-4">📊 Maintenance KPIs</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="bg-slate-800/50 rounded-lg p-3"><div className="text-2xl font-bold text-amber-400">{analytics.pmCompliance.overdue}</div><div className="text-xs text-slate-500">Overdue PMs</div></div>
            <div className="bg-slate-800/50 rounded-lg p-3"><div className="text-2xl font-bold text-green-400">{analytics.pmCompliance.complianceRate}%</div><div className="text-xs text-slate-500">PM Compliance</div></div>
            <div className="bg-slate-800/50 rounded-lg p-3"><div className="text-2xl font-bold text-blue-400">{analytics.inventoryValue.totalItems}</div><div className="text-xs text-slate-500">Inventory Items</div></div>
            <div className="bg-slate-800/50 rounded-lg p-3"><div className="text-2xl font-bold text-red-400">{analytics.inventoryValue.lowStockCount}</div><div className="text-xs text-slate-500">Low Stock Items</div></div>
            <div className="bg-slate-800/50 rounded-lg p-3"><div className="text-2xl font-bold text-slate-300">{analytics.ytdStats.totalWOs}</div><div className="text-xs text-slate-500">YTD Work Orders</div></div>
            <div className="bg-slate-800/50 rounded-lg p-3"><div className="text-2xl font-bold text-slate-300">{analytics.ytdStats.totalLaborHours}h</div><div className="text-xs text-slate-500">YTD Labor Hours</div></div>
          </div>
        </div>

        {replaceCandidates.length > 0 && (
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 lg:col-span-2">
            <h3 className="text-sm font-semibold text-white mb-1">🔧 Replace vs Repair</h3>
            <p className="text-xs text-slate-500 mb-4">Cumulative completed maintenance cost against the asset&apos;s replacement cost. A high ratio is a capital-planning signal, not an automatic verdict.</p>
            <table className="w-full text-sm">
              <thead><tr className="text-xs text-slate-500 border-b border-slate-800"><th className="text-left py-2">Asset</th><th className="text-right py-2">Maintenance</th><th className="text-right py-2">Replacement</th><th className="text-right py-2">Ratio</th></tr></thead>
              <tbody>{replaceCandidates.map(r => (
                <tr key={r.id} className="border-b border-slate-800/50">
                  <td className="py-2 text-slate-300 text-xs">{r.name}</td>
                  <td className="py-2 text-right text-slate-300 text-xs font-mono">${r.maintenanceCost.toLocaleString()}</td>
                  <td className="py-2 text-right text-slate-400 text-xs font-mono">${r.replacementCost.toLocaleString()}</td>
                  <td className={`py-2 text-right text-xs font-mono ${r.ratio >= 0.5 ? 'text-red-400' : r.ratio >= 0.3 ? 'text-amber-400' : 'text-slate-400'}`}>{Math.round(r.ratio * 100)}%</td>
                </tr>))}</tbody>
            </table>
          </div>
        )}

        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-white mb-4">📉 Failure Mode Pareto</h3>
          {failureModes.length > 0 ? (
            <div className="space-y-2">{failureModes.map(f => (
              <div key={f.failureMode} className="flex items-center gap-3">
                <div className="w-32 text-xs text-slate-400 truncate" title={f.failureMode}>{f.failureMode}</div>
                <div className="flex-1 h-4 bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-orange-500/60" style={{ width: `${(f.count / maxFailure) * 100}%` }} /></div>
                <div className="w-8 text-right text-xs text-slate-400">{f.count}</div>
              </div>))}</div>
          ) : <p className="text-slate-500 text-sm">No corrective work yet. Record a failure mode on assets to build this view.</p>}
        </div>

        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-white mb-4">🛡️ Warranty Expiring (90 days)</h3>
          {warranty.length > 0 ? (
            <div className="space-y-2">{warranty.slice(0, 10).map(w => (
              <div key={w.id} className="flex items-center justify-between text-xs py-2 border-b border-slate-800/50">
                <span className="text-slate-300 truncate" title={w.name}>{w.name}</span>
                <span className={w.daysLeft < 0 ? 'text-red-400' : w.daysLeft <= 30 ? 'text-amber-400' : 'text-slate-400'}>
                  {w.daysLeft < 0 ? `expired ${Math.abs(w.daysLeft)}d ago` : `${w.daysLeft}d left`}
                </span>
              </div>))}</div>
          ) : <p className="text-green-400 text-sm">No warranties expiring in the next 90 days. ✓</p>}
        </div>

        {backlog.length > 0 && (
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
            <h3 className="text-sm font-semibold text-white mb-4">📊 Work Order Backlog by Aging</h3>
            <div className="space-y-3">{backlog.map((b: BacklogItem, i: number) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-24 text-xs text-slate-400">{b.aging}</div>
                <div className="flex-1 h-5 bg-slate-800 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${b.aging.includes('90') ? 'bg-red-500' : b.aging.includes('30') ? 'bg-amber-500' : b.aging.includes('7') ? 'bg-yellow-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(100, (b.count / Math.max(1, backlog[0]?.count || 1)) * 100)}%` }} />
                </div>
                <div className="w-12 text-right text-xs text-slate-300 font-mono">{b.count}</div>
                <div className="w-20 text-right text-xs text-slate-500">${b.totalCost.toLocaleString()}</div>
              </div>
            ))}</div>
          </div>
        )}
      </div>
    </div>
  );
}
