import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { columnsApi } from '../api/client';
import type { Column } from '../types';
import { X, Eye, EyeOff, Trash2, ChevronUp, ChevronDown, Plus, Pencil } from 'lucide-react';

const TYPE_OPTIONS = [
  { value: 'text',     label: 'Texto' },
  { value: 'number',   label: 'Número' },
  { value: 'currency', label: 'Monetário ($)' },
];

const TYPE_LABEL: Record<string, string> = { text: 'texto', number: 'nº', currency: '$', select: 'badge', date: 'data' };
const TYPE_COLOR: Record<string, string> = { text: '#6366f1', number: '#10b981', currency: '#0ea5e9', select: '#f59e0b', date: '#8b5cf6' };

interface Props { onClose: () => void }

export default function ColumnManager({ onClose }: Props) {
  const qc = useQueryClient();
  const [newLabel, setNewLabel] = useState('');
  const [newType, setNewType] = useState('text');
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const editRef = useRef<HTMLInputElement>(null);

  const { data: columns = [] } = useQuery({ queryKey: ['columns'], queryFn: columnsApi.list });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['columns'] });

  const updateMut = useMutation({ mutationFn: columnsApi.update, onSuccess: invalidate });
  const addMut    = useMutation({ mutationFn: ({ label, type }: { label: string; type: string }) => columnsApi.add(label, type), onSuccess: () => { invalidate(); setNewLabel(''); } });
  const deleteMut = useMutation({ mutationFn: columnsApi.remove, onSuccess: invalidate });

  const save = (cols: Column[]) => updateMut.mutate(cols);

  const toggleVisible = (key: string) => save(columns.map(c => c.key === key ? { ...c, visible: !c.visible } : c));

  const move = (key: string, dir: -1 | 1) => {
    const idx = columns.findIndex(c => c.key === key);
    if (idx < 0) return;
    const next = [...columns];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    save(next);
  };

  const startEdit = (col: Column) => {
    setEditingKey(col.key);
    setEditLabel(col.label);
    setTimeout(() => editRef.current?.focus(), 0);
  };

  const commitRename = (key: string) => {
    if (editLabel.trim()) save(columns.map(c => c.key === key ? { ...c, label: editLabel.trim() } : c));
    setEditingKey(null);
  };

  const handleAdd = () => {
    if (newLabel.trim()) addMut.mutate({ label: newLabel.trim(), type: newType });
  };

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="flex-1" />
      <div
        className="w-72 bg-[#161929] border-l border-[#2a2d3e] h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2d3e]">
          <span className="text-sm font-semibold text-white">Gerenciar Colunas</span>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition"><X size={15} /></button>
        </div>

        <p className="px-4 pt-3 pb-1 text-[11px] text-slate-500">
          Clique no nome para renomear · Colunas fixas não podem ser excluídas
        </p>

        {/* List */}
        <div className="flex-1 overflow-y-auto py-1">
          {columns.map((col, idx) => (
            <div
              key={col.key}
              className={`flex items-center gap-2 px-3 py-2 group transition ${!col.visible ? 'opacity-40' : 'hover:bg-white/5'}`}
            >
              {/* Reorder */}
              <div className="flex flex-col shrink-0">
                <button
                  onClick={() => move(col.key, -1)}
                  disabled={idx === 0}
                  className="text-slate-600 hover:text-slate-300 disabled:opacity-20 transition"
                >
                  <ChevronUp size={11} />
                </button>
                <button
                  onClick={() => move(col.key, 1)}
                  disabled={idx === columns.length - 1}
                  className="text-slate-600 hover:text-slate-300 disabled:opacity-20 transition"
                >
                  <ChevronDown size={11} />
                </button>
              </div>

              {/* Visibility */}
              <button onClick={() => toggleVisible(col.key)} className="shrink-0 transition" title={col.visible ? 'Ocultar' : 'Mostrar'}>
                {col.visible
                  ? <Eye size={13} className="text-indigo-400" />
                  : <EyeOff size={13} className="text-slate-600" />
                }
              </button>

              {/* Label */}
              <div className="flex-1 min-w-0">
                {editingKey === col.key ? (
                  <input
                    ref={editRef}
                    value={editLabel}
                    onChange={e => setEditLabel(e.target.value)}
                    onBlur={() => commitRename(col.key)}
                    onKeyDown={e => { if (e.key === 'Enter') commitRename(col.key); if (e.key === 'Escape') setEditingKey(null); }}
                    className="w-full bg-[#0f1117] border border-indigo-500 rounded px-1.5 py-0.5 text-[12px] text-white outline-none"
                  />
                ) : (
                  <button
                    onClick={() => startEdit(col)}
                    className="text-left w-full text-[12px] truncate flex items-center gap-1 group/label"
                    title="Clique para renomear"
                  >
                    <span className={col.visible ? 'text-slate-200' : 'text-slate-500'}>{col.label}</span>
                    <Pencil size={9} className="opacity-0 group-hover/label:opacity-50 text-slate-400 shrink-0 transition" />
                  </button>
                )}
              </div>

              {/* Type badge */}
              <span
                className="shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded"
                style={{ background: `${TYPE_COLOR[col.type]}22`, color: TYPE_COLOR[col.type] }}
              >
                {TYPE_LABEL[col.type] || col.type}
              </span>

              {/* Delete (custom columns only) */}
              {!col.fixed ? (
                <button
                  onClick={() => {
                    if (confirm(`Excluir a coluna "${col.label}"? Os dados desta coluna serão perdidos.`)) {
                      deleteMut.mutate(col.key);
                    }
                  }}
                  title="Excluir coluna"
                  className="shrink-0 text-slate-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition"
                >
                  <Trash2 size={12} />
                </button>
              ) : (
                <div className="w-3 shrink-0" />
              )}
            </div>
          ))}
        </div>

        {/* Add new column */}
        <div className="border-t border-[#2a2d3e] p-3 space-y-2">
          <p className="text-[11px] text-slate-400 font-medium">Nova coluna personalizada</p>
          <input
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
            placeholder="Nome da coluna..."
            className="w-full bg-[#0f1117] border border-[#2a2d3e] rounded-lg px-3 py-1.5 text-[12px] text-white outline-none focus:border-indigo-500 transition placeholder:text-slate-600"
          />
          <div className="flex gap-2">
            <select
              value={newType}
              onChange={e => setNewType(e.target.value)}
              className="flex-1 bg-[#0f1117] border border-[#2a2d3e] rounded-lg px-2.5 py-1.5 text-[12px] text-white outline-none focus:border-indigo-500 transition cursor-pointer"
            >
              {TYPE_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <button
              onClick={handleAdd}
              disabled={!newLabel.trim() || addMut.isPending}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition disabled:opacity-40"
            >
              <Plus size={12} /> Adicionar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
