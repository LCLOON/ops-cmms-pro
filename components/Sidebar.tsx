'use client';

import React from 'react';
import { LayoutDashboard, Wrench, ClipboardList, CalendarCheck, Package, LogOut, Building2, ShoppingCart, ShieldCheck, FileText, HardHat, Search, BarChart3, Settings, Zap } from 'lucide-react';
import { useAuth } from './AuthContext';

type Page = 'dashboard' | 'assets' | 'work-orders' | 'pm-schedule' | 'inventory' | 'vendors' | 'purchase-orders' | 'compliance' | 'documents' | 'safety' | 'inspections' | 'reports' | 'admin' | 'electrical';

interface Props { active: Page; onNavigate: (p: Page) => void; mobileOpen?: boolean; onToggleMobile?: () => void; }

export default function Sidebar({ active, onNavigate, mobileOpen, onToggleMobile }: Props) {
  const { user, logout } = useAuth();

  const items: { id: Page; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
    { id: 'assets', label: 'Assets', icon: <Wrench className="w-5 h-5" /> },
    { id: 'work-orders', label: 'Work Orders', icon: <ClipboardList className="w-5 h-5" /> },
    { id: 'pm-schedule', label: 'PM Schedule', icon: <CalendarCheck className="w-5 h-5" /> },
    { id: 'inventory', label: 'Inventory', icon: <Package className="w-5 h-5" /> },
    { id: 'vendors', label: 'Vendors', icon: <Building2 className="w-5 h-5" /> },
    { id: 'purchase-orders', label: 'Purchase Orders', icon: <ShoppingCart className="w-5 h-5" /> },
    { id: 'compliance', label: 'Compliance', icon: <ShieldCheck className="w-5 h-5" /> },
    { id: 'documents', label: 'Documents', icon: <FileText className="w-5 h-5" /> },
    { id: 'safety', label: 'Safety', icon: <HardHat className="w-5 h-5" /> },
    { id: 'inspections', label: 'Inspections', icon: <Search className="w-5 h-5" /> },
    { id: 'reports', label: 'Reports', icon: <BarChart3 className="w-5 h-5" /> },
    { id: 'admin', label: 'Admin', icon: <Settings className="w-5 h-5" /> },
    { id: 'electrical', label: 'Electrical', icon: <Zap className="w-5 h-5" /> },
  ];

  const nav = (
    <div className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col h-full">
      <div className="p-6 border-b border-slate-800 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white flex items-center gap-2"><Wrench className="w-5 h-5 text-blue-400" /> OpsCMMSPro</h1>
          <p className="text-xs text-slate-500 mt-1">{user?.displayName} ({user?.role})</p>
        </div>
        {onToggleMobile && (
          <button onClick={onToggleMobile} className="lg:hidden text-slate-400 hover:text-white"><Wrench className="w-5 h-5" /></button>
        )}
      </div>
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {items.map(item => (
          <button key={item.id} onClick={() => { onNavigate(item.id); onToggleMobile?.(); }}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${active === item.id ? 'bg-blue-600/20 text-blue-400 border border-blue-500/20' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}>
            {item.icon} {item.label}
          </button>
        ))}
      </nav>
      <div className="p-4 border-t border-slate-800">
        <button onClick={logout} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-400 hover:text-red-400 hover:bg-slate-800/50 rounded-lg transition-colors">
          <LogOut className="w-4 h-4" /> Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop always visible */}
      <div className="hidden lg:block h-full">{nav}</div>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="fixed inset-0 bg-black/60" onClick={onToggleMobile} />
          <div className="relative h-full">{nav}</div>
        </div>
      )}
    </>
  );
}
