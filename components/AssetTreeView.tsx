'use client';

import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Wrench } from 'lucide-react';

interface AssetNode {
  id: string;
  name: string;
  parentId?: string;
  status?: string;
  criticality?: string;
}
interface TreeNode { id: string; name: string; children: TreeNode[]; asset: AssetNode; }

function buildTree(assets: AssetNode[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];
  for (const a of assets) {
    map.set(a.id, { id: a.id, name: a.name, children: [], asset: a });
  }
  for (const a of assets) {
    const node = map.get(a.id)!;
    if (a.parentId && map.has(a.parentId)) {
      map.get(a.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

const criticalityColors: Record<string, string> = {
  critical: 'text-red-400', high: 'text-amber-400', medium: 'text-blue-400', low: 'text-slate-400',
};
const statusDots: Record<string, string> = {
  operational: 'bg-green-400', down: 'bg-red-400', maintenance: 'bg-amber-400', retired: 'bg-slate-500',
};

function TreeNodeView({ node, depth, onSelect }: { node: TreeNode; depth: number; onSelect: (id: string) => void }) {
  const [open, setOpen] = useState(depth < 2);
  const hasChildren = node.children.length > 0;
  return (
    <div>
      <div
        className={`flex items-center gap-2 py-1.5 px-2 rounded cursor-pointer hover:bg-slate-800/50 text-sm transition-colors ${depth === 0 ? 'font-semibold text-white' : depth === 1 ? 'text-slate-200' : 'text-slate-400'}`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => { setOpen(!open); onSelect(node.id); }}
      >
        {hasChildren ? (
          open ? <ChevronDown className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
        ) : (
          <span className="w-3.5 flex-shrink-0" />
        )}
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusDots[node.asset.status ?? ''] || 'bg-slate-500'}`} />
        <span className="truncate">{node.name}</span>
        {node.asset.criticality && (
          <span className={`text-[10px] ml-auto flex-shrink-0 ${criticalityColors[node.asset.criticality] || ''}`}>{node.asset.criticality}</span>
        )}
      </div>
      {open && hasChildren && (
        <div>
          {node.children.map(child => (
            <TreeNodeView key={child.id} node={child} depth={depth + 1} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  );
}

interface Props {
  assets: AssetNode[];
  onSelectAsset: (id: string) => void;
}

export default function AssetTreeView({ assets, onSelectAsset }: Props) {
  const tree = buildTree(assets);
  const totalChildren = tree.reduce((sum, r) => sum + r.children.length, 0);

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 max-h-[70vh] overflow-auto">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2"><Wrench className="w-4 h-4 text-blue-400" />Asset Hierarchy</h3>
        <span className="text-xs text-slate-500">{tree.length} facilities · {totalChildren} assets</span>
      </div>
      <div className="space-y-0.5">
        {tree.map(root => (
          <TreeNodeView key={root.id} node={root} depth={0} onSelect={onSelectAsset} />
        ))}
      </div>
    </div>
  );
}
