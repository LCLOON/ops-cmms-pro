'use client';

import React, { useMemo, useState } from 'react';
import { ChevronRight, ChevronDown, Plus, Wrench } from 'lucide-react';
import { AssetRecord, indexById, statusDots, criticalityColors, buildPath } from './asset-types';

interface TreeNode { id: string; name: string; children: TreeNode[]; asset: AssetRecord; }

function buildTree(assets: AssetRecord[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];
  for (const a of assets) map.set(a.id, { id: a.id, name: a.name, children: [], asset: a });
  for (const a of assets) {
    const node = map.get(a.id);
    if (!node) continue;
    const parent = a.parentId ? map.get(a.parentId) : undefined;
    // A parent id pointing at a missing asset must not hide the asset entirely.
    if (parent) parent.children.push(node); else roots.push(node);
  }
  return roots;
}

interface Props {
  assets: AssetRecord[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAddChild: (parentId: string) => void;
  canEdit: boolean;
}

export default function AssetTreeView({ assets, selectedId, onSelect, onAddChild, canEdit }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [query, setQuery] = useState('');

  const byId = useMemo(() => indexById(assets), [assets]);
  const tree = useMemo(() => buildTree(assets), [assets]);

  // Keep every ancestor of the selection open so the highlighted row stays
  // visible even when it was selected from the detail panel or the table.
  const selectedAncestors = useMemo(() => {
    const out = new Set<string>();
    if (!selectedId) return out;
    for (const a of buildPath(byId.get(selectedId), byId)) out.add(a.id);
    return out;
  }, [selectedId, byId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    // Keep matches plus their ancestors so the path stays readable.
    const keep = new Set<string>();
    for (const a of assets) {
      if (!a.name.toLowerCase().includes(q) && !a.id.toLowerCase().includes(q)) continue;
      for (const node of buildPath(a, byId)) keep.add(node.id);
    }
    return keep;
  }, [query, assets, byId]);

  const toggle = (id: string) => setExpanded(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const roots = tree.length;

  const renderNode = (node: TreeNode, depth: number): React.ReactNode => {
    if (filtered && !filtered.has(node.id)) return null;
    const isOpen = filtered !== null || expanded.has(node.id) || selectedAncestors.has(node.id);
    const hasChildren = node.children.length > 0;
    const isSelected = selectedId === node.id;

    return (
      <div key={node.id}>
        <div
          role="button"
          tabIndex={0}
          aria-current={isSelected ? 'true' : undefined}
          onClick={() => onSelect(node.id)}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(node.id); } }}
          className={`group flex items-center gap-1.5 py-1.5 pr-1 rounded-md cursor-pointer text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            isSelected ? 'bg-blue-600/25 text-white ring-1 ring-blue-500/40'
              : depth === 0 ? 'text-white hover:bg-slate-800/60'
              : depth === 1 ? 'text-slate-200 hover:bg-slate-800/60'
              : 'text-slate-400 hover:bg-slate-800/60'
          }`}
          style={{ paddingLeft: `${depth * 14 + 4}px` }}
        >
          {hasChildren ? (
            <button
              type="button"
              aria-label={isOpen ? `Collapse ${node.name}` : `Expand ${node.name}`}
              onClick={e => { e.stopPropagation(); toggle(node.id); }}
              className="p-0.5 rounded text-slate-500 hover:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          ) : <span className="w-[18px] flex-shrink-0" />}

          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusDots[node.asset.status] || 'bg-slate-500'}`} />
          <span className="truncate flex-1">{node.name}</span>

          {hasChildren && <span className="text-[10px] text-slate-600 flex-shrink-0">{node.children.length}</span>}
          {node.asset.criticality && (
            <span className={`text-[10px] flex-shrink-0 ${criticalityColors[node.asset.criticality] || ''}`}>{node.asset.criticality}</span>
          )}

          {canEdit && (
            <button
              type="button"
              aria-label={`Add a child asset under ${node.name}`}
              title="Add a child asset here"
              onClick={e => { e.stopPropagation(); onAddChild(node.id); }}
              className="p-0.5 rounded text-slate-500 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-opacity"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {isOpen && hasChildren && node.children.map(child => renderNode(child, depth + 1))}
      </div>
    );
  };

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-3 flex flex-col max-h-[75vh]">
      <div className="flex items-center justify-between mb-2 px-1">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Wrench className="w-4 h-4 text-blue-400" />Asset Hierarchy
        </h3>
        <span className="text-xs text-slate-500">{roots} top level / {assets.length} assets</span>
      </div>

      <div className="relative mb-2">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Filter assets..."
          aria-label="Filter assets"
          className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-3 pr-14 py-1.5 text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {query && (
          <button type="button" onClick={() => setQuery('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 hover:text-white">Clear</button>
        )}
      </div>

      <div className="overflow-auto flex-1 pr-1">
        {tree.length === 0 ? (
          <p className="text-slate-500 text-sm p-3">No assets yet.</p>
        ) : filtered && filtered.size === 0 ? (
          <p className="text-slate-500 text-sm p-3">No assets match that filter.</p>
        ) : tree.map(root => renderNode(root, 0))}
      </div>

      <p className="text-[10px] text-slate-600 px-1 pt-2 border-t border-slate-800 mt-2">
        Click an asset to open it. Use the plus on a row to add something under it.
      </p>
    </div>
  );
}
