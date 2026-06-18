import { useQuery } from '@tanstack/react-query';
import { statsApi } from '../api/client';
import { Activity, TrendingUp, Play, ShoppingCart, DollarSign, Sparkles } from 'lucide-react';

const cards = [
  { key: 'total',       label: 'Total Criativos', icon: Activity,     color: '#6366f1', fmt: (v: number) => v.toString() },
  { key: 'emTeste',     label: 'Em Teste',        icon: TrendingUp,   color: '#f59e0b', fmt: (v: number) => v.toString() },
  { key: 'ativo',       label: 'Ativos',          icon: Play,         color: '#10b981', fmt: (v: number) => v.toString() },
  { key: 'totalVendas', label: 'Total Vendas',    icon: ShoppingCart, color: '#ec4899', fmt: (v: number) => v.toString() },
  { key: 'cpaMedia',    label: 'CPA Médio',       icon: DollarSign,   color: '#0ea5e9', fmt: (v: number) => `$${v.toFixed(2)}` },
  { key: 'novos',       label: 'Novos',           icon: Sparkles,     color: '#3b82f6', fmt: (v: number) => v.toString() },
] as const;

export default function KPICards() {
  const { data: stats } = useQuery({ queryKey: ['stats'], queryFn: statsApi.get, refetchInterval: 5000 });

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 px-4 py-3">
      {cards.map(({ key, label, icon: Icon, color, fmt }) => (
        <div key={key} className="bg-[#111424] border border-[#1e2235] rounded-lg p-3 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">{label}</span>
            <div className="w-5 h-5 rounded flex items-center justify-center" style={{ background: `${color}20` }}>
              <Icon size={11} style={{ color }} />
            </div>
          </div>
          <span className="text-lg font-bold text-white">
            {stats != null && stats[key] != null ? fmt(stats[key] as number) : '—'}
          </span>
        </div>
      ))}
    </div>
  );
}
