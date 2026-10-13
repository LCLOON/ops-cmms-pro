'use client';

import React, { useState } from 'react';
import {
  LayoutDashboard, Wrench, ClipboardList, CalendarCheck, Package, Building2, ShoppingCart,
  ShieldCheck, FileText, HardHat, Search, BarChart3, Settings, Zap, ChevronDown, ChevronRight,
  Sparkles, Upload, ListChecks,
} from 'lucide-react';
import { KNOWLEDGE } from '@/lib/knowledge';

const ICONS: Record<string, React.ReactNode> = {
  dashboard: <LayoutDashboard className="w-5 h-5" />,
  assets: <Wrench className="w-5 h-5" />,
  'work-orders': <ClipboardList className="w-5 h-5" />,
  'pm-schedule': <CalendarCheck className="w-5 h-5" />,
  procedures: <ListChecks className="w-5 h-5" />,
  inventory: <Package className="w-5 h-5" />,
  vendors: <Building2 className="w-5 h-5" />,
  'purchase-orders': <ShoppingCart className="w-5 h-5" />,
  compliance: <ShieldCheck className="w-5 h-5" />,
  documents: <FileText className="w-5 h-5" />,
  safety: <HardHat className="w-5 h-5" />,
  inspections: <Search className="w-5 h-5" />,
  reports: <BarChart3 className="w-5 h-5" />,
  admin: <Settings className="w-5 h-5" />,
  electrical: <Zap className="w-5 h-5" />,
};

export default function HelpPage({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const [open, setOpen] = useState<string | null>('assets');

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Help &amp; Documentation</h2>
        <p className="text-slate-400 text-sm mt-1">
          A guide to every module in OpsCMMSPro — what it does, how to use it and what fields it tracks.
          For a live, conversational answer about your own data, use the AI Advisor.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <button
          onClick={() => onNavigate?.('advisor')}
          className="flex items-start gap-3 text-left bg-blue-600/10 border border-blue-500/30 rounded-xl p-4 hover:bg-blue-600/20 transition-colors"
        >
          <Sparkles className="w-5 h-5 text-blue-400 mt-0.5" />
          <div>
            <div className="text-sm font-semibold text-white">Ask the AI Advisor</div>
            <div className="text-xs text-slate-400 mt-1">Get a live answer grounded in your site&apos;s real data.</div>
          </div>
        </button>
        <button
          onClick={() => onNavigate?.('assets')}
          className="flex items-start gap-3 text-left bg-slate-800/60 border border-slate-700 rounded-xl p-4 hover:bg-slate-800 transition-colors"
        >
          <Upload className="w-5 h-5 text-emerald-400 mt-0.5" />
          <div>
            <div className="text-sm font-semibold text-white">Import from another CMMS</div>
            <div className="text-xs text-slate-400 mt-1">Convert a SAP, Maximo, Fiix, MaintainX, eMaint, Limble or UpKeep export, or ingest a document to build an asset list — from the Assets page Import tools.</div>
          </div>
        </button>
      </div>

      <div className="space-y-2">
        {KNOWLEDGE.map(entry => {
          const isOpen = open === entry.module;
          return (
            <div key={entry.module} className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/50">
              <button
                onClick={() => setOpen(isOpen ? null : entry.module)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-800/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-blue-400">{ICONS[entry.page]}</span>
                  <span className="text-sm font-semibold text-white">{entry.module}</span>
                </div>
                {isOpen ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
              </button>
              {isOpen && (
                <div className="px-4 pb-4 space-y-3 border-t border-slate-800 pt-3">
                  <p className="text-sm text-slate-300">{entry.what}</p>
                  <div>
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">How to use it</div>
                    <ol className="list-decimal list-inside text-sm text-slate-300 space-y-0.5">
                      {entry.how.map((step, i) => <li key={i}>{step}</li>)}
                    </ol>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Key fields</div>
                    <div className="flex flex-wrap gap-1.5">
                      {entry.fields.map(f => (
                        <span key={f} className="text-[11px] bg-slate-800 border border-slate-700 rounded-full px-2 py-0.5 text-slate-400">{f}</span>
                      ))}
                    </div>
                  </div>
                  {entry.related.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Related modules</div>
                      <div className="flex flex-wrap gap-1.5">
                        {entry.related.map(r => (
                          <span key={r} className="text-[11px] bg-blue-500/10 border border-blue-500/20 rounded-full px-2 py-0.5 text-blue-300">{r}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {onNavigate && (
                    <button
                      onClick={() => onNavigate(entry.page)}
                      className="text-xs font-medium text-blue-400 hover:text-blue-300 underline"
                    >
                      Open {entry.module} →
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
