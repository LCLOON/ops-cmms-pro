'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, ClipboardList, CalendarCheck, ChevronRight, Activity, GitBranch } from 'lucide-react';
import { navigate } from '@/lib/nav';
import {
  AssetRecord, indexById, buildPath, statusColors, criticalityColors, warrantyDaysLeft,
} from './asset-types';

interface WorkOrderLite {
  id: string; assetId: string; title: string; status: string; priority: string; dueDate: string;
}

interface Props {
  asset: AssetRecord | null;
  assets: AssetRecord[];
  sites: { id: string; name: string }[];
  canEdit: boolean;
  isAdmin: boolean;
  onSelect: (id: string) => void;
  onEdit: (a: AssetRecord) => void;
  onAddChild: (parentId: string) => void;
  onDelete: (a: AssetRecord) => void;
  onAddRoot: () => void;
}

const workOrderStatusColors: Record<string, string> = {
  open: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  in_progress: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  on_hold: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  completed: 'bg-green-500/20 text-green-300 border-green-500/30',
  cancelled: 'bg-red-500/20 text-red-300 border-red-500/30',
};

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-sm text-slate-200 break-words">{value || <span className="text-slate-600">-</span>}</div>
    </div>
  );
}

export default function AssetDetailPanel({
  asset, assets, sites, canEdit, isAdmin, onSelect, onEdit, onAddChild, onDelete, onAddRoot,
}: Props) {
  const [workOrders, setWorkOrders] = useState<WorkOrderLite[]>([]);
  const byId = useMemo(() => indexById(assets), [assets]);

  // Loaded once for the whole page and filtered per selection, so clicking
  // around the tree does not re-query.
  useEffect(() => {
    fetch('/api/work-orders')
      .then(r => r.json())
      .then((rows: WorkOrderLite[]) => { if (Array.isArray(rows)) setWorkOrders(rows); })
      .catch(() => {});
  }, []);

  const children = useMemo(
    () => (asset ? assets.filter(a => a.parentId === asset.id).sort((a, b) => a.name.localeCompare(b.name)) : []),
    [assets, asset],
  );

  const related = useMemo(() => {
    if (!asset) return [];
    return workOrders
      .filter(w => w.assetId === asset.id)
      .sort((a, b) => String(b.id).localeCompare(String(a.id)))
      .slice(0, 5);
  }, [workOrders, asset]);

  if (!asset) {
    return (
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-8 flex flex-col items-center justify-center text-center min-h-[300px]">
        <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mb-3">
          <ChevronRight className="w-6 h-6 text-slate-500" />
        </div>
        <h3 className="text-sm font-semibold text-white mb-1">Pick an asset to work on</h3>
        <p className="text-xs text-slate-500 max-w-sm mb-4">
          Choose any item in the tree to see its details, edit it, or add equipment beneath it.
        </p>
        {canEdit && (
          <button onClick={onAddRoot}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" /> Add top-level asset
          </button>
        )}
      </div>
    );
  }

  const path = buildPath(asset, byId);
  const warranty = warrantyDaysLeft(asset.warrantyExpiry);
  const openWorkOrders = workOrders.filter(w => w.assetId === asset.id && (w.status === 'open' || w.status === 'in_progress')).length;

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl">
      <div className="p-5 border-b border-slate-800">
        {path.length > 1 && (
          <div className="flex flex-wrap items-center gap-1 text-[11px] text-slate-500 mb-2">
            {path.slice(0, -1).map(node => (
              <React.Fragment key={node.id}>
                <button onClick={() => onSelect(node.id)} className="hover:text-blue-400 transition-colors">{node.name}</button>
                <ChevronRight className="w-3 h-3" />
              </React.Fragment>
            ))}
          </div>
        )}

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-white truncate">{asset.name}</h3>
            <p className="text-xs text-slate-500 font-mono">{asset.id}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${statusColors[asset.status] || ''}`}>
              {asset.status.replace(/_/g, ' ')}
            </span>
            <span className={`text-xs font-semibold capitalize ${criticalityColors[asset.criticality] || ''}`}>{asset.criticality}</span>
          </div>
        </div>

        {canEdit && (
          <div className="flex flex-wrap gap-2 mt-4">
            <button onClick={() => onEdit(asset)}
              className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">
              Edit this asset
            </button>
            <button onClick={() => onAddChild(asset.id)}
              className="flex items-center gap-1 bg-slate-700 hover:bg-slate-600 text-slate-100 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">
              <Plus className="w-3.5 h-3.5" /> Add child asset
            </button>
            <button onClick={() => navigate('work-orders', { assetId: asset.id })}
              className="flex items-center gap-1 bg-slate-700 hover:bg-slate-600 text-slate-100 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              title="Open the Work Orders tab filtered to this asset">
              <ClipboardList className="w-3.5 h-3.5" /> Work orders ({openWorkOrders})
            </button>
            <button onClick={() => navigate('pm-schedule', { assetId: asset.id })}
              className="flex items-center gap-1 bg-slate-700 hover:bg-slate-600 text-slate-100 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              title="Open the PM Schedule tab filtered to this asset">
              <CalendarCheck className="w-3.5 h-3.5" /> PM schedule
            </button>
            <button onClick={() => navigate('testing', { assetId: asset.id })}
              className="flex items-center gap-1 bg-slate-700 hover:bg-slate-600 text-slate-100 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">
              <Activity className="w-3.5 h-3.5" /> Testing
            </button>
            <button onClick={() => navigate('root-cause-analysis', { assetId: asset.id })}
              className="flex items-center gap-1 bg-slate-700 hover:bg-slate-600 text-slate-100 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">
              <GitBranch className="w-3.5 h-3.5" /> RCA
            </button>
            {isAdmin && (
              <button onClick={() => onDelete(asset)}
                className="flex items-center gap-1 text-red-400 hover:text-red-300 border border-red-500/30 hover:bg-red-500/10 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            )}
          </div>
        )}
      </div>

      <div className="p-5 grid grid-cols-2 sm:grid-cols-3 gap-4 border-b border-slate-800">
        <Fact label="Category" value={<span className="capitalize">{asset.category}</span>} />
        <Fact label="Site" value={sites.find(site => site.id === asset.siteId)?.name || asset.siteId || ''} />
        <Fact label="Location" value={asset.location} />
        <Fact label="Department" value={asset.department} />
        <Fact label="Manufacturer" value={asset.manufacturer} />
        <Fact label="Model" value={asset.model} />
        <Fact label="Serial" value={asset.serialNumber} />
        <Fact label="Installed" value={asset.installDate} />
        <Fact
          label="Warranty"
          value={warranty === null ? '' : warranty < 0
            ? <span className="text-red-400">expired {Math.abs(warranty)}d ago</span>
            : <span className={warranty <= 90 ? 'text-amber-400' : ''}>{asset.warrantyExpiry} ({warranty}d)</span>}
        />
        <Fact label="Replacement cost" value={asset.replacementCost ? `$${Number(asset.replacementCost).toLocaleString()}` : ''} />
        <Fact label="Failure mode" value={asset.failureMode} />
        <Fact label="Open work orders" value={String(openWorkOrders)} />
        <Fact label="Children" value={String(children.length)} />
      </div>

      <div className="p-5 border-b border-slate-800">
        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Contains</h4>
        {children.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {children.map(child => (
              <button key={child.id} onClick={() => onSelect(child.id)}
                className="flex items-center gap-2 text-left bg-slate-800/50 hover:bg-slate-800 border border-slate-700/60 rounded-lg px-3 py-2 transition-colors">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${child.status === 'down' ? 'bg-red-400' : child.status === 'maintenance' ? 'bg-amber-400' : 'bg-green-400'}`} />
                <span className="text-sm text-slate-200 truncate flex-1">{child.name}</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500">
            No child assets yet.{canEdit ? ' Use "Add child asset" to build out this branch.' : ''}
          </p>
        )}
        {canEdit && children.length > 0 && (
          <button onClick={() => onAddChild(asset.id)}
            className="mt-3 flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors">
            <Plus className="w-3.5 h-3.5" /> Add another child asset
          </button>
        )}
      </div>

      <div className="p-5">
        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
          <ClipboardList className="w-3.5 h-3.5" /> Recent work orders
        </h4>
        {related.length > 0 ? (
          <div className="space-y-1.5">
            {related.map(w => (
              <button key={w.id} onClick={() => navigate('work-orders', { focusId: w.id })}
                className="flex items-center gap-2 text-xs w-full text-left hover:bg-slate-800/60 rounded px-1 py-0.5 transition-colors"
                title={`Open ${w.id} in Work Orders`}>
                <span className={`px-1.5 py-0.5 rounded border ${workOrderStatusColors[w.status] || ''}`}>{w.status.replace(/_/g, ' ')}</span>
                <span className="text-slate-300 truncate flex-1">{w.title}</span>
                <span className="text-slate-500 font-mono flex-shrink-0">{w.id}</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500 flex items-center gap-1.5">
            <CalendarCheck className="w-3.5 h-3.5" /> No work orders recorded for this asset yet.
          </p>
        )}
      </div>
    </div>
  );
}
