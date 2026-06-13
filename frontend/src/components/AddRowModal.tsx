import { useState } from 'react';
import { X } from 'lucide-react';
import type { Options } from '../types';

interface Props {
  options: Options;
  onClose: () => void;
  onSave: (data: Record<string, unknown>) => void;
}

export default function AddRowModal({ options, onClose, onSave }: Props) {
  const [form, setForm] = useState({
    criativo: '', tipo: '', data: '', oferta: '', status: 'EM TESTE', gestor: '', observacoes: '', num_vendas: 0, cpa: 0, link_drive: '',
  });

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1a1d2e] border border-[#2a2d3e] rounded-2xl w-full max-w-lg shadow-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-white">Novo Criativo</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition"><X size={18} /></button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Criativo (nome do arquivo)', key: 'criativo', type: 'text', span: 2 },
            { label: 'Link do Drive', key: 'link_drive', type: 'url', span: 2 },
            { label: 'Data', key: 'data', type: 'text' },
            { label: 'Observações', key: 'observacoes', type: 'text' },
            { label: 'Nº Vendas', key: 'num_vendas', type: 'number' },
            { label: 'CPA ($)', key: 'cpa', type: 'number' },
          ].map(({ label, key, type, span }) => (
            <div key={key} className={span === 2 ? 'col-span-2' : ''}>
              <label className="text-[11px] text-slate-400 mb-1 block">{label}</label>
              <input
                type={type}
                value={form[key as keyof typeof form] as string}
                onChange={e => set(key, type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value)}
                className="w-full bg-[#0f1117] border border-[#2a2d3e] rounded-lg px-3 py-1.5 text-[13px] text-white outline-none focus:border-indigo-500 transition"
              />
            </div>
          ))}

          {(['tipo', 'status', 'gestor', 'oferta'] as const).map(key => (
            <div key={key}>
              <label className="text-[11px] text-slate-400 mb-1 block capitalize">{key}</label>
              <select
                value={form[key]}
                onChange={e => set(key, e.target.value)}
                className="w-full bg-[#0f1117] border border-[#2a2d3e] rounded-lg px-3 py-1.5 text-[13px] text-white outline-none focus:border-indigo-500 transition cursor-pointer"
              >
                <option value="">— Nenhum</option>
                {options[key]?.map(o => <option key={o.value} value={o.value}>{o.value}</option>)}
              </select>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-1.5 rounded-lg text-[13px] text-slate-400 hover:text-white hover:bg-[#2a2d3e] transition">Cancelar</button>
          <button
            onClick={() => { onSave(form); onClose(); }}
            disabled={!form.criativo.trim()}
            className="px-4 py-1.5 rounded-lg text-[13px] font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Adicionar
          </button>
        </div>
      </div>
    </div>
  );
}
