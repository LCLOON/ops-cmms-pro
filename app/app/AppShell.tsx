'use client';

import React, { useState, useEffect } from 'react';
import { Menu } from 'lucide-react';
import { useAuth } from '@/components/AuthContext';
import LoginScreen from '@/components/LoginScreen';
import Sidebar from '@/components/Sidebar';
import Dashboard from '@/components/Dashboard';
import AssetPage from '@/components/AssetPage';
import WorkOrderPage from '@/components/WorkOrderPage';
import PmSchedulePage from '@/components/PmSchedulePage';
import ProceduresPage from '@/components/ProceduresPage';
import InventoryPage from '@/components/InventoryPage';
import VendorPage from '@/components/VendorPage';
import PurchaseOrderPage from '@/components/PurchaseOrderPage';
import CompliancePage from '@/components/CompliancePage';
import DocumentPage from '@/components/DocumentPage';
import SafetyPage from '@/components/SafetyPage';
import InspectionsPage from '@/components/InspectionsPage';
import ReportsPage from '@/components/ReportsPage';
import AdminPage from '@/components/AdminPage';
import ElectricalTestsPage from '@/components/ElectricalTestsPage';
import AdvisorPage from '@/components/AdvisorPage';
import HelpPage from '@/components/HelpPage';
import GlobalSearch from '@/components/GlobalSearch';
import { PageSkeleton } from '@/components/Skeletons';

type Page = 'dashboard' | 'assets' | 'work-orders' | 'pm-schedule' | 'procedures' | 'inventory' | 'vendors' | 'purchase-orders' | 'compliance' | 'documents' | 'safety' | 'inspections' | 'reports' | 'admin' | 'electrical' | 'advisor' | 'help';

export default function AppShell() {
  const { user, loading } = useAuth();
  const [page, setPage] = useState<Page>('dashboard');
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => setPage((e as CustomEvent).detail as Page);
    window.addEventListener('nav', handler);
    return () => window.removeEventListener('nav', handler);
  }, []);

  if (loading) return <PageSkeleton />;

  if (!user) return <LoginScreen />;

  return (
    <div className="flex h-screen bg-slate-950">
      <Sidebar active={page} onNavigate={setPage} mobileOpen={mobileOpen} onToggleMobile={() => setMobileOpen(o => !o)} />
      <main className="flex-1 overflow-auto">
        <div className="hidden lg:flex items-center justify-end gap-3 px-6 py-2 border-b border-slate-800/50">
          <GlobalSearch onSelect={(r) => {
            if (r.type === 'Asset') setPage('assets');
            else if (r.type === 'WO') setPage('work-orders');
            else if (r.type === 'PM') setPage('pm-schedule');
          }} />
        </div>
        <div className="lg:hidden flex items-center gap-3 p-4 border-b border-slate-800">
          <button onClick={() => setMobileOpen(true)} className="text-slate-400 hover:text-white"><Menu className="w-6 h-6" /></button>
          <h1 className="text-lg font-bold text-white">OpsCMMSPro</h1>
        </div>
        <div className="p-4 lg:p-8">
          {page === 'dashboard' && <Dashboard />}
          {page === 'assets' && <AssetPage />}
          {page === 'work-orders' && <WorkOrderPage />}
          {page === 'pm-schedule' && <PmSchedulePage />}
          {page === 'procedures' && <ProceduresPage />}
          {page === 'inventory' && <InventoryPage />}
          {page === 'vendors' && <VendorPage />}
          {page === 'purchase-orders' && <PurchaseOrderPage />}
          {page === 'compliance' && <CompliancePage />}
          {page === 'documents' && <DocumentPage />}
          {page === 'safety' && <SafetyPage />}
          {page === 'inspections' && <InspectionsPage />}
          {page === 'reports' && <ReportsPage />}
          {page === 'admin' && <AdminPage />}
          {page === 'electrical' && <ElectricalTestsPage />}
          {page === 'advisor' && <AdvisorPage onNavigate={p => setPage(p as Page)} />}
          {page === 'help' && <HelpPage onNavigate={p => setPage(p as Page)} />}
        </div>
      </main>
    </div>
  );
}
