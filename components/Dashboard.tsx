'use client';

import React, { useState, useEffect } from 'react';
import { Wrench, ClipboardList, AlertTriangle, Package, CheckCircle2, BarChart3, DollarSign, TrendingUp, Clock, ShieldCheck } from 'lucide-react';

interface Analytics {
  mttr: { assetId: string; assetName: string; mttrDays: number; workOrderCount: number }[];
  mtbf: { assetId: string; assetName: string; mtbfDays: number; failureCount: number }[];
  costByAsset: { assetId: string; assetName: string; laborCost: number; partsCost: number; totalCost: number }[];
  pmCompliance: { completed: number; overdue: number; total: number; complianceRate: number };
  woByStatus: { status: string; count: number }[];
  woByType: { type: string; count: number }[];
  monthlyCosts: { month: string; labor: number; parts: number }[];
  topCostAssets: { name: string; total: number }[];
  inventoryValue: { totalItems: number; totalValue: number; lowStockCount: number };
  ytdStats: { totalWOs: number; totalLaborHours: number; totalPartsCost: number; avgResolutionDays: number };
  complianceOverdue: number;
  complianceTotal: number;
}
interface Stats { totalAssets: number; openWorkOrders: number; overduePMs: number; downAssets: number; lowStock: number; completedThisMonth: number; }

export default function Dashboard() {
  const navTo = (page: string) => window.dispatchEvent(new CustomEvent('nav', { detail: page }));
  const [stats, setStats] = useState<Stats | null>(null);
  const [a, setA] = useState<Analytics | null>(null);

  useEffect(() => {
    const load = () => {
      fetch('/api/config').then(r => r.json()).then(d => setStats(d.stats)).catch(() => {});
      fetch('/api/analytics').then(r => r.json()).then(setA).catch(() => {});
    };
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  if (!stats || !a) return <div className="text-slate-400 p-8">Loading dashboard...</div>;

  const kpiCards = [
    { label: 'Total Assets', nav: 'assets' as string | undefined, value: stats.totalAssets, icon: <Wrench className="w-5 h-5" />, color: 'blue' },
    { label: 'Open Work Orders', nav: 'work-orders', value: stats.openWorkOrders, icon: <ClipboardList className="w-5 h-5" />, color: 'amber' },
    { label: 'Overdue PMs', nav: 'pm-schedule', value: stats.overduePMs, icon: <AlertTriangle className="w-5 h-5" />, color: 'red' },
    { label: 'PM Compliance', value: a.pmCompliance.complianceRate + '%', icon: <CheckCircle2 className="w-5 h-5" />, color: 'green' },
    { label: 'Compliance Alerts', nav: 'compliance', value: a.complianceOverdue || 0, icon: <ShieldCheck className="w-5 h-5" />, color: a.complianceOverdue > 0 ? 'red' : 'green' },
    { label: 'Low Stock', nav: 'inventory', value: stats.lowStock, icon: <Package className="w-5 h-5" />, color: 'orange' },
    { label: 'PM Schedules', nav: 'pm-schedule', value: a.pmCompliance.total, icon: <Clock className="w-5 h-5" />, color: 'blue' },
    { label: 'Inv. Value', value: '$' + a.inventoryValue.totalValue.toLocaleString(), icon: <DollarSign className="w-5 h-5" />, color: 'blue' },
  ];

  const clrs: Record<string, string> = { blue: 'border-blue-500/30 bg-blue-500/5', amber: 'border-amber-500/30 bg-amber-500/5', red: 'border-red-500/30 bg-red-500/5', rose: 'border-rose-500/30 bg-rose-500/5', orange: 'border-orange-500/30 bg-orange-500/5', green: 'border-green-500/30 bg-green-500/5' };
  const tclrs: Record<string, string> = { blue: 'text-blue-400', amber: 'text-amber-400', red: 'text-red-400', rose: 'text-rose-400', orange: 'text-orange-400', green: 'text-green-400' };
  const bclrs: Record<string, string> = { open: 'bg-blue-500', in_progress: 'bg-amber-500', on_hold: 'bg-slate-500', completed: 'bg-green-500', cancelled: 'bg-red-500' };
  const slbl: Record<string, string> = { open: 'Open', in_progress: 'In Progress', on_hold: 'On Hold', completed: 'Completed', cancelled: 'Cancelled' };
  const maxSC = Math.max(1, ...a.woByStatus.map(s => s.count));
  const tclrs2: Record<string, string> = { corrective: 'bg-red-500', preventive: 'bg-blue-500', predictive: 'bg-purple-500', emergency: 'bg-amber-500', inspection: 'bg-green-500' };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-xl font-bold text-white">Maintenance Dashboard</h2><p className="text-slate-400 text-sm mt-1">Real-time analytics and KPI overview</p></div>
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span><Clock className="w-3 h-3 inline mr-1" />YTD: {a.ytdStats.totalWOs} WOs</span>
          <span><DollarSign className="w-3 h-3 inline mr-1" />${a.ytdStats.totalPartsCost.toLocaleString()}</span>
          <span><TrendingUp className="w-3 h-3 inline mr-1" />{a.ytdStats.totalLaborHours}h</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {kpiCards.map(c => (
          <div key={c.label} onClick={() => c.nav && navTo(c.nav)} className={`rounded-xl border p-5 cursor-pointer hover:border-slate-600 transition-all hover:scale-[1.02] ${clrs[c.color]}`}>
            <div className="flex items-center justify-between mb-3"><span className={tclrs[c.color]}>{c.icon}</span><span className="text-3xl font-bold text-white">{c.value}</span></div>
            <p className="text-sm text-slate-400">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-white mb-4"><BarChart3 className="w-4 h-4 inline mr-2 text-blue-400" />Work Order Status</h3>
          <div className="space-y-3">
            {a.woByStatus.map(s => (
              <div key={s.status}><div className="flex justify-between text-xs mb-1"><span className="text-slate-400 capitalize">{slbl[s.status] || s.status}</span><span className="text-slate-500">{s.count}</span></div>
                <div className="h-3 bg-slate-800 rounded-full overflow-hidden"><div className={`h-full rounded-full ${bclrs[s.status] || 'bg-slate-600'}`} style={{ width: `${(s.count / maxSC) * 100}%` }} /></div></div>
            ))}</div>
        </div>
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-white mb-4"><DollarSign className="w-4 h-4 inline mr-2 text-green-400" />Top Cost Assets</h3>
          {a.topCostAssets.length > 0 ? (
            <div className="space-y-3">{a.topCostAssets.map(x => (
              <div key={x.name}><div className="flex justify-between text-xs mb-1"><span className="text-slate-400">{x.name}</span><span className="text-slate-500 font-mono">${x.total.toLocaleString()}</span></div>
                <div className="h-3 bg-slate-800 rounded-full overflow-hidden"><div className="h-full rounded-full bg-green-500/60" style={{ width: `${(x.total / Math.max(1, a.topCostAssets[0]?.total || 1)) * 100}%` }} /></div></div>
            ))}</div>
          ) : <p className="text-slate-500 text-sm">No completed work orders yet.</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-white mb-4"><Clock className="w-4 h-4 inline mr-2 text-amber-400" />MTTR — Mean Time To Repair (days)</h3>
          {a.mttr.length > 0 ? (
            <table className="w-full text-sm"><thead><tr className="text-xs text-slate-500 border-b border-slate-800"><th className="text-left py-2">Asset</th><th className="text-right py-2">MTTR</th><th className="text-right py-2">WOs</th></tr></thead>
              <tbody>{a.mttr.slice(0, 5).map(m => <tr key={m.assetId} className="border-b border-slate-800/50"><td className="py-2 text-slate-300">{m.assetName}</td><td className="py-2 text-right font-mono text-slate-300">{m.mttrDays}d</td><td className="py-2 text-right text-slate-500">{m.workOrderCount}</td></tr>)}</tbody></table>
          ) : <p className="text-slate-500 text-sm">No resolution data yet.</p>}
        </div>
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-white mb-4"><TrendingUp className="w-4 h-4 inline mr-2 text-blue-400" />MTBF — Mean Time Between Failures</h3>
          {a.mtbf.length > 0 ? (
            <table className="w-full text-sm"><thead><tr className="text-xs text-slate-500 border-b border-slate-800"><th className="text-left py-2">Asset</th><th className="text-right py-2">MTBF</th><th className="text-right py-2">Failures</th></tr></thead>
              <tbody>{a.mtbf.slice(0, 5).map(m => <tr key={m.assetId} className="border-b border-slate-800/50"><td className="py-2 text-slate-300">{m.assetName}</td><td className="py-2 text-right font-mono text-slate-300">{m.mtbfDays}d</td><td className="py-2 text-right text-slate-500">{m.failureCount}</td></tr>)}</tbody></table>
          ) : <p className="text-slate-500 text-sm">No failure data yet.</p>}
        </div>
      </div>

      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-white mb-4"><TrendingUp className="w-4 h-4 inline mr-2 text-purple-400" />Monthly Cost Trend</h3>
        {(() => {
          const months = a.monthlyCosts;
          if (months.length === 0) return <p className="text-slate-500 text-sm py-8 text-center">No completed work orders in the last 6 months.</p>;
          const maxTotal = Math.max(1, ...months.map(x => x.labor + x.parts));
          return (
            <>
              <div className="flex items-end gap-3 h-40 px-2">
                {months.map(m => {
                  const total = m.labor + m.parts;
                  const barH = Math.max(4, (total / maxTotal) * 100);
                  const hasLabor = m.labor > 0;
                  const hasParts = m.parts > 0;
                  return (
                    <div key={m.month} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                      <span className="text-xs text-slate-400 font-mono font-medium">${Math.round(total).toLocaleString()}</span>
                      <div className="w-full relative flex flex-col justify-end" style={{ height: '100%' }}>
                        <div className="w-full flex flex-col justify-end" style={{ height: `${barH}%` }}>
                          {hasParts && (
                            <div className="w-full bg-green-500/70 hover:bg-green-400/80 transition-colors" style={{ height: hasLabor ? `${(m.parts / total) * 100}%` : '100%', minHeight: hasParts ? '4px' : 0 }} title={`Parts: $${Math.round(m.parts).toLocaleString()}`} />
                          )}
                          {hasLabor && (
                            <div className={`w-full bg-blue-500/70 hover:bg-blue-400/80 transition-colors ${!hasParts ? 'rounded-t' : ''}`} style={{ height: hasParts ? `${(m.labor / total) * 100}%` : '100%', minHeight: '4px' }} title={`Labor: $${Math.round(m.labor).toLocaleString()}`} />
                          )}
                        </div>
                        {!hasLabor && !hasParts && <div className="w-full bg-slate-700/50 rounded-t" style={{ height: '4px' }} />}
                        {hasParts && hasLabor && <div className="w-full bg-blue-500/70 rounded-t" style={{ height: '0px' }} />}
                      </div>
                      <span className="text-xs text-slate-500 font-mono">{['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][parseInt(m.month.slice(5)) - 1]}</span>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-center gap-5 mt-4 text-xs">
                <span className="flex items-center gap-1.5 text-slate-400"><span className="w-3 h-3 rounded-sm bg-blue-500/70" /> Labor ($75/hr)</span>
                <span className="flex items-center gap-1.5 text-slate-400"><span className="w-3 h-3 rounded-sm bg-green-500/70" /> Parts</span>
              </div>
            </>
          );
        })()}
      </div>

      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-white mb-4">Work Order Type Distribution</h3>
        <div className="flex items-center gap-0.5 h-6 rounded-full overflow-hidden bg-slate-800">
          {a.woByType.map(t => {
            const total = a.woByType.reduce((s, x) => s + x.count, 0) || 1;
            return <div key={t.type} className={`h-full ${tclrs2[t.type] || 'bg-slate-600'}`} style={{ width: `${(t.count / total) * 100}%` }} title={`${t.type}: ${t.count}`} />;
          })}
        </div>
        <div className="flex flex-wrap gap-3 mt-3 text-xs">
          {a.woByType.map(t => <span key={t.type} className="flex items-center gap-1 text-slate-400 capitalize"><span className={`w-2.5 h-2.5 rounded-sm ${tclrs2[t.type] || 'bg-slate-600'}`} /> {t.type} ({t.count})</span>)}
        </div>
      </div>
    </div>
  );
}
