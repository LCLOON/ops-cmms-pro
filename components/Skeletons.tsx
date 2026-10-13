'use client';

import React from 'react';

export function CardSkeleton() {
  return <div className="rounded-xl border border-slate-800 p-5 animate-pulse">
    <div className="flex items-center justify-between mb-3"><div className="w-5 h-5 bg-slate-800 rounded" /><div className="w-16 h-8 bg-slate-800 rounded" /></div>
    <div className="w-24 h-4 bg-slate-800 rounded" />
  </div>;
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return <div className="space-y-3 p-4 animate-pulse">
    <div className="h-8 bg-slate-800 rounded w-full" />
    {Array.from({ length: rows }).map((_, i) => <div key={i} className="h-10 bg-slate-800/50 rounded w-full" />)}
  </div>;
}

export function PageSkeleton() {
  return <div className="p-8 space-y-6 animate-pulse">
    <div className="w-48 h-6 bg-slate-800 rounded" />
    <div className="w-64 h-4 bg-slate-800 rounded" />
    <div className="grid grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}</div>
    <TableSkeleton rows={8} />
  </div>;
}
