'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Menu } from 'lucide-react';
import { useAuth } from '@/components/AuthContext';
import { navigate, type NavIntent, type NavParams } from '@/lib/nav';
import LoginScreen from '@/components/LoginScreen';
import ChangePasswordScreen from '@/components/ChangePasswordScreen';
import Sidebar from '@/components/Sidebar';
import Dashboard from '@/components/Dashboard';
import AssetPage from '@/components/AssetPage';
import CriticalityPage from '@/components/CriticalityPage';
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

type Page = 'dashboard' | 'assets' | 'criticality' | 'work-orders' | 'pm-schedule' | 'procedures' | 'inventory' | 'vendors' | 'purchase-orders' | 'compliance' | 'documents' | 'safety' | 'inspections' | 'reports' | 'admin' | 'electrical' | 'advisor' | 'help';

export default function AppShell() {
  const { user, loading } = useAuth();
  const [page, setPage] = useState<Page>('dashboard');
  // Deep-link context: which record the user was looking at when they followed
  // a link from another tab.
  const [navParams, setNavParams] = useState<NavParams>({});
  const [mobileOpen, setMobileOpen] = useState(false);

  // Sidebar navigation is a fresh start, so it clears any deep-link context.
  const goTo = useCallback((next: Page) => { setPage(next); setNavParams({}); }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (typeof detail === 'string') { setPage(detail as Page); setNavParams({}); return; }
      if (detail && typeof detail === 'object' && typeof detail.page === 'string') {
        setPage(detail.page as Page);
        const { page: _ignored, ...rest } = detail as NavIntent;
        void _ignored;
        setNavParams(rest);
      }
    };
    window.addEventListener('nav', handler);
    return () => window.removeEventListener('nav', handler);
  }, []);

  if (loading) return <PageSkeleton />;

  if (!user) return <LoginScreen />;

  // Seeded accounts carry published credentials; nothing else opens until the
  // password is replaced. This is enforced here AND by the session claim, so a
  // reload cannot slip past it.
  if (user.forcePasswordChange) return <ChangePasswordScreen />;

  return (
    <div className="flex h-screen bg-slate-950">
      <Sidebar active={page} onNavigate={goTo} mobileOpen={mobileOpen} onToggleMobile={() => setMobileOpen(o => !o)} />
      <main className="flex-1 overflow-auto">
        <div className="hidden lg:flex items-center justify-end gap-3 px-6 py-2 border-b border-slate-800/50">
          <GlobalSearch onSelect={(r) => {
            // Search results open the record, not just the tab.
            if (r.type === 'Asset') navigate('assets', { focusId: r.id });
            else if (r.type === 'WO') navigate('work-orders', { focusId: r.id });
            else if (r.type === 'PM') navigate('pm-schedule', { focusId: r.id });
          }} />
        </div>
        <div className="lg:hidden flex items-center gap-3 p-4 border-b border-slate-800">
          <button onClick={() => setMobileOpen(true)} className="text-slate-400 hover:text-white"><Menu className="w-6 h-6" /></button>
          <h1 className="text-lg font-bold text-white">OpsCMMSPro</h1>
        </div>
        <div className="p-4 lg:p-8">
          {page === 'dashboard' && <Dashboard />}
          {page === 'assets' && <AssetPage params={navParams} />}
          {page === 'criticality' && <CriticalityPage />}
          {page === 'work-orders' && <WorkOrderPage params={navParams} />}
          {page === 'pm-schedule' && <PmSchedulePage params={navParams} />}
          {page === 'procedures' && <ProceduresPage params={navParams} />}
          {page === 'inventory' && <InventoryPage />}
          {page === 'vendors' && <VendorPage params={navParams} />}
          {page === 'purchase-orders' && <PurchaseOrderPage params={navParams} />}
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
