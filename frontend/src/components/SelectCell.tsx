import { useState, useRef, useEffect } from 'react';
import Badge from './Badge';
import type { OptionItem } from '../types';
import { Check } from 'lucide-react';

interface Props {
  value: string;
  options: OptionItem[];
  onSave: (v: string) => void;
  placeholder?: string;
}

export default function SelectCell({ value, options, onSave, placeholder }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const option = options.find(o => o.value === value);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <div
        onClick={() => setOpen(v => !v)}
        className="cursor-pointer min-h-[22px] flex items-center px-1 rounded hover:bg-white/5 transition"
      >
        {option
          ? <Badge value={option.value} color={option.color} />
          : <span className="text-slate-500 text-[11px]">{placeholder || '—'}</span>
        }
      </div>

      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 bg-[#1e2235] border border-[#2e3148] rounded-xl shadow-xl min-w-[160px] py-1 overflow-hidden">
          <div
            className="px-3 py-1.5 text-[11px] text-slate-500 hover:bg-white/5 cursor-pointer transition flex items-center gap-1.5"
            onClick={() => { onSave(''); setOpen(false); }}
          >
            <span className="w-3 h-3 rounded-full border border-slate-600 inline-block" />
            Nenhum
          </div>
          {options.map(o => (
            <div
              key={o.value}
              onClick={() => { onSave(o.value); setOpen(false); }}
              className="px-3 py-1.5 hover:bg-white/5 cursor-pointer flex items-center gap-2 transition"
            >
              <Check size={11} className={value === o.value ? 'opacity-100' : 'opacity-0'} style={{ color: o.color }} />
              <Badge value={o.value} color={o.color} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
