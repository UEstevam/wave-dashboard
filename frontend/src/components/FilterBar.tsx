import { Search, X } from 'lucide-react';
import type { Filters, Options } from '../types';

interface Props {
  filters: Filters;
  options: Options | undefined;
  onChange: (f: Partial<Filters>) => void;
  onReset: () => void;
}

export default function FilterBar({ filters, options, onChange, onReset }: Props) {
  const hasActive = Object.values(filters).some(v => v !== '');

  return (
    <div className="flex flex-wrap items-center gap-2 px-4 pb-3">
      {/* Search */}
      <div className="relative flex-1 min-w-[180px] max-w-xs">
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          value={filters.search}
          onChange={e => onChange({ search: e.target.value })}
          placeholder="Buscar criativo, ordem..."
          className="w-full bg-[#1a1d2e] border border-[#2a2d3e] rounded-lg pl-8 pr-3 py-1.5 text-[12px] text-slate-200 placeholder:text-slate-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition"
        />
      </div>

      {/* Dropdowns */}
      {(['status', 'gestor', 'oferta', 'tipo'] as const).map(key => (
        <select
          key={key}
          value={filters[key]}
          onChange={e => onChange({ [key]: e.target.value })}
          className="bg-[#1a1d2e] border border-[#2a2d3e] rounded-lg px-2.5 py-1.5 text-[12px] text-slate-300 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition cursor-pointer"
        >
          <option value="">{key.charAt(0).toUpperCase() + key.slice(1)}: Todos</option>
          {options?.[key]?.map(o => (
            <option key={o.value} value={o.value}>{o.value}</option>
          ))}
        </select>
      ))}

      {hasActive && (
        <button
          onClick={onReset}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] text-slate-400 hover:text-white hover:bg-[#2a2d3e] transition"
        >
          <X size={12} /> Limpar
        </button>
      )}
    </div>
  );
}
