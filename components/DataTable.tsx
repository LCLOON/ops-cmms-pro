'use client';

import React, { useState, useMemo } from 'react';
import { Search, ChevronUp, ChevronDown, Pencil, Trash2, Plus, Download } from 'lucide-react';

export interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  sortable?: boolean;
}

interface Props<T> {
  data: T[];
  columns: Column<T>[];
  onEdit?: (item: T) => void;
  onDelete?: (item: T) => void;
  onAdd?: () => void;
  addLabel?: string;
  searchPlaceholder?: string;
  canEdit?: boolean;
  canDelete?: boolean;
  emptyMessage?: string;
}

export default function DataTable<T extends { id: string }>({
  data, columns, onEdit, onDelete, onAdd, addLabel = 'Add New',
  searchPlaceholder = 'Search...', canEdit = true, canDelete = true,
  emptyMessage = 'No records found.',
}: Props<T>) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const filtered = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter(item =>
      columns.some(col => {
        const val = (item as Record<string, unknown>)[col.key];
        return val != null && String(val).toLowerCase().includes(q);
      })
    );
  }, [data, search, columns]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      const aVal = (a as Record<string, unknown>)[sortKey];
      const bVal = (b as Record<string, unknown>)[sortKey];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const exportCSV = () => {
    const headers = columns.map(c => c.header).join(',');
    const rows = sorted.map(item =>
      columns.map(c => {
        const val = (item as Record<string, unknown>)[c.key];
        const str = val != null ? String(val).replace(/"/g, '""') : '';
        return `"${str}"`;
      }).join(',')
    );
    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'export.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            className="w-full bg-slate-800/50 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={searchPlaceholder}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        {data.length > 0 && (
          <button onClick={exportCSV} className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-2 rounded-lg text-sm transition-colors flex-shrink-0" title="Export CSV">
            <Download className="w-4 h-4" />
          </button>
        )}
        {onAdd && canEdit && (
          <button onClick={onAdd} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex-shrink-0">
            <Plus className="w-4 h-4" /> {addLabel}
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-800/50">
              {columns.map(col => (
                <th key={col.key}
                  className={`px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider ${col.sortable !== false ? 'cursor-pointer select-none hover:text-slate-200' : ''}`}
                  onClick={() => col.sortable !== false && toggleSort(col.key)}>
                  <span className="flex items-center gap-1">
                    {col.header}
                    {sortKey === col.key && (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                  </span>
                </th>
              ))}
              {(onEdit || onDelete) && <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider w-24">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (onEdit || onDelete ? 1 : 0)} className="px-4 py-12 text-center text-slate-500">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              sorted.map(item => (
                <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                  {columns.map(col => (
                    <td key={col.key} className="px-4 py-3 text-slate-300 whitespace-nowrap">
                      {col.render ? col.render(item) : String((item as Record<string, unknown>)[col.key] ?? '')}
                    </td>
                  ))}
                  {(onEdit || onDelete) && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {onEdit && canEdit && (
                          <button onClick={() => onEdit(item)} className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-700/50 rounded transition-colors">
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        {onDelete && canDelete && (
                          <button onClick={() => onDelete(item)} className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-700/50 rounded transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-600">{sorted.length} of {data.length} records</p>
    </div>
  );
}
