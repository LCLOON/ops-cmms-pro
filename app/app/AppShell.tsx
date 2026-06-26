'use client';

import React, { useState } from 'react';
import { useAuth } from '@/components/AuthContext';
import LoginScreen from '@/components/LoginScreen';
import Sidebar from '@/components/Sidebar';
import Dashboard from '@/components/Dashboard';

type Page = 'dashboard' | 'assets' | 'work-orders' | 'pm-schedule' | 'inventory';

export default function AppShell() {
  const { user, loading } = useAuth();
  const [page, setPage] = useState<Page>('dashboard');

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  if (!user) return <LoginScreen />;

  return (
    <div className="flex h-screen bg-slate-950">
      <Sidebar active={page} onNavigate={setPage} />
      <main className="flex-1 overflow-auto p-8">
        {page === 'dashboard' && <Dashboard />}
        {page === 'assets' && <Placeholder title="Asset Management" desc="Asset registry and tracking coming soon." />}
        {page === 'work-orders' && <Placeholder title="Work Orders" desc="Work order management coming soon." />}
        {page === 'pm-schedule' && <Placeholder title="PM Schedule" desc="Preventive maintenance scheduling coming soon." />}
        {page === 'inventory' && <Placeholder title="Inventory" desc="Parts and supplies inventory coming soon." />}
      </main>
    </div>
  );
}

function Placeholder({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-4">
        <span className="text-3xl">🔧</span>
      </div>
      <h2 className="text-xl font-bold text-white mb-2">{title}</h2>
      <p className="text-slate-400">{desc}</p>
    </div>
  );
}
