import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { optionsApi } from '../api/client';
import { X, Plus, Trash2 } from 'lucide-react';

interface Props { onClose: () => void }

const CATEGORIES: { key: string; label: string }[] = [
  { key: 'status',  label: 'Status' },
  { key: 'tipo',    label: 'Tipo' },
  { key: 'gestor',  label: 'Gestor' },
  { key: 'oferta',  label: 'Oferta' },
];

const DEFAULT_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#f59e0b', '#22c55e', '#10b981',
  '#0ea5e9', '#3b82f6', '#6b7280', '#14b8a6',
];

function rgba(hex: string, a: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

export default function OptionsManager({ onClose }: Props) {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState('status');
  const [newValue, setNewValue] = useState('');
  const [newColor, setNewColor] = useState('#6366f1');

  const { data: options } = useQuery({ queryKey: ['options'], queryFn: optionsApi.list });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['options'] });
  };

  const addMut = useMutation({
    mutationFn: () => optionsApi.create(activeTab, newValue.trim(), newColor),
    onSuccess: () => { invalidate(); setNewValue(''); },
  });

  const removeMut = useMutation({
    mutationFn: ({ category, value }: { category: string; value: string }) =>
      optionsApi.remove(category, value),
    onSuccess: invalidate,
  });

  const currentOptions = options?.[activeTab] ?? [];
  const exists = currentOptions.some(o => o.value.toLowerCase() === newValue.trim().toLowerCase());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-[520px] max-h-[90vh] bg-[#161929] border border-[#2a2d3e] rounded-2xl shadow-2xl flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2d3e]">
          <div>
            <p className="text-[14px] font-semibold text-white">Gerenciar Opções</p>
            <p className="text-[11px] text-slate-500">Adicione ou remova valores dos campos de seleção</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition">
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#2a2d3e] px-5 pt-3 gap-1">
          {CATEGORIES.map(cat => (
            <button
              key={cat.key}
              onClick={() => { setActiveTab(cat.key); setNewValue(''); }}
              className={`px-3 py-1.5 rounded-t-lg text-[12px] font-medium transition border-b-2 -mb-px ${
                activeTab === cat.key
                  ? 'text-indigo-300 border-indigo-500 bg-indigo-500/10'
                  : 'text-slate-400 border-transparent hover:text-white hover:bg-white/5'
              }`}
            >
              {cat.label}
              <span className="ml-1.5 text-[10px] text-slate-500">
                {options?.[cat.key]?.length ?? 0}
              </span>
            </button>
          ))}
        </div>

        {/* Options list */}
        <div className="flex-1 overflow-y-auto p-5 space-y-2 min-h-0">
          {currentOptions.length === 0 && (
            <p className="text-[12px] text-slate-500 text-center py-4">Nenhuma opção cadastrada</p>
          )}
          {currentOptions.map(opt => (
            <div
              key={opt.value}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[#1e2235] border border-[#2a2d3e] group"
            >
              <div
                className="w-3 h-3 rounded-full shrink-0"
                style={{ background: opt.color, boxShadow: `0 0 0 2px #1e2235, 0 0 0 3px ${opt.color}` }}
              />
              <span
                className="flex-1 text-[12px] font-medium px-2 py-0.5 rounded-md inline-block"
                style={{ background: rgba(opt.color, 0.15), color: opt.color, border: `1px solid ${rgba(opt.color, 0.3)}` }}
              >
                {opt.value}
              </span>
              <span className="text-[10px] text-slate-600 font-mono">{opt.color}</span>
              <button
                onClick={() => removeMut.mutate({ category: activeTab, value: opt.value })}
                className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition shrink-0"
                title="Remover"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>

        {/* Add new */}
        <div className="border-t border-[#2a2d3e] p-5 space-y-3">
          <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
            Adicionar em {CATEGORIES.find(c => c.key === activeTab)?.label}
          </p>
          <div className="flex gap-2">
            <input
              value={newValue}
              onChange={e => setNewValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && newValue.trim() && !exists) addMut.mutate(); }}
              placeholder="Nome da opção..."
              className="flex-1 bg-[#0f1117] border border-[#2a2d3e] rounded-lg px-3 py-2 text-[12px] text-white outline-none focus:border-indigo-500 transition placeholder:text-slate-600"
            />
            {/* Color presets */}
            <div className="flex items-center gap-1 flex-wrap max-w-[120px]">
              {DEFAULT_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setNewColor(c)}
                  className="w-4 h-4 rounded-full transition hover:scale-125"
                  style={{
                    background: c,
                    outline: newColor === c ? `2px solid ${c}` : 'none',
                    outlineOffset: 2,
                  }}
                />
              ))}
            </div>
            {/* Custom color picker */}
            <label className="relative cursor-pointer" title="Cor personalizada">
              <div
                className="w-8 h-8 rounded-lg border-2 border-[#2a2d3e] flex items-center justify-center text-[9px] text-white font-bold"
                style={{ background: newColor }}
              >
                #
              </div>
              <input
                type="color"
                value={newColor}
                onChange={e => setNewColor(e.target.value)}
                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
              />
            </label>
          </div>

          {exists && newValue.trim() && (
            <p className="text-[11px] text-amber-400">Essa opção já existe nesta categoria.</p>
          )}

          {/* Preview */}
          {newValue.trim() && !exists && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-500">Preview:</span>
              <span
                className="text-[11px] font-semibold px-2 py-0.5 rounded-md"
                style={{ background: rgba(newColor, 0.18), color: newColor, border: `1px solid ${rgba(newColor, 0.35)}` }}
              >
                {newValue.trim()}
              </span>
            </div>
          )}

          <button
            onClick={() => addMut.mutate()}
            disabled={!newValue.trim() || exists || addMut.isPending}
            className="w-full py-2 rounded-lg text-[12px] font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition disabled:opacity-40 flex items-center justify-center gap-2"
          >
            <Plus size={13} />
            {addMut.isPending ? 'Adicionando...' : 'Adicionar opção'}
          </button>
        </div>
      </div>
    </div>
  );
}
