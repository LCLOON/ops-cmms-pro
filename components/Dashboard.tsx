'use client';

import React, { useState, useEffect } from 'react';
import { Wrench, ClipboardList, AlertTriangle, AlertCircle, Package, CheckCircle2 } from 'lucide-react';

interface Stats { totalAssets: number; openWorkOrders: number; overduePMs: number; downAssets: number; lowStock: number; completedThisMonth: number; }

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch('/api/config').then(r => r.json()).then(d => setStats(d.stats)).catch(() => {});
  }, []);

  if (!stats) return <div className="text-slate-400 p-8">Loading dashboard...</div>;

  const cards = [
    { label: 'Total Assets', value: stats.totalAssets, icon: <Wrench className="w-5 h-5" />, color: 'blue' },
    { label: 'Open Work Orders', value: stats.openWorkOrders, icon: <ClipboardList className="w-5 h-5" />, color: 'amber' },
    { label: 'Overdue PMs', value: stats.overduePMs, icon: <AlertTriangle className="w-5 h-5" />, color: 'red' },
    { label: 'Down Assets', value: stats.downAssets, icon: <AlertCircle className="w-5 h-5" />, color: 'rose' },
    { label: 'Low Stock Items', value: stats.lowStock, icon: <Package className="w-5 h-5" />, color: 'orange' },
    { label: 'Completed This Month', value: stats.completedThisMonth, icon: <CheckCircle2 className="w-5 h-5" />, color: 'green' },
  ];

  const colors: Record<string, string> = {
    blue: 'border-blue-500/30 bg-blue-500/5', amber: 'border-amber-500/30 bg-amber-500/5',
    red: 'border-red-500/30 bg-red-500/5', rose: 'border-rose-500/30 bg-rose-500/5',
    orange: 'border-orange-500/30 bg-orange-500/5', green: 'border-green-500/30 bg-green-500/5',
  };
  const textColors: Record<string, string> = { blue: 'text-blue-400', amber: 'text-amber-400', red: 'text-red-400', rose: 'text-rose-400', orange: 'text-orange-400', green: 'text-green-400' };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-white">Maintenance Dashboard</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map(card => (
          <div key={card.label} className={`rounded-xl border p-5 ${colors[card.color]}`}>
            <div className="flex items-center justify-between mb-3">
              <span className={`${textColors[card.color]}`}>{card.icon}</span>
              <span className="text-3xl font-bold text-white">{card.value}</span>
            </div>
            <p className="text-sm text-slate-400">{card.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
