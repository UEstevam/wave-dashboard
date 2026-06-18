import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usersApi } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import type { AppUser } from '../types';
import UserAvatar from './UserAvatar';
import { X, UserCheck } from 'lucide-react';

interface Props {
  currentUserId: string | null;
  columnKey: 'editor_id' | 'copy_id' | 'gestor_id';
  onSave: (googleId: string | null) => void;
  onClose: () => void;
}

const ROLE_LABELS: Record<string, string> = {
  editor_id: 'editor',
  copy_id: 'copy',
  gestor_id: 'gestor',
};

const ROLE_COLORS: Record<string, string> = {
  adm: '#6366f1',
  gestor: '#10b981',
  editor: '#0ea5e9',
  copy: '#f59e0b',
};

export default function UserPickerDialog({ currentUserId, columnKey, onSave, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const { user: me } = useAuth();
  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: usersApi.list });

  const relevantRole = ROLE_LABELS[columnKey];

  // Filter: admins can pick anyone; others see only users matching the column role
  const filtered: AppUser[] = me?.role === 'adm'
    ? users
    : users.filter(u => u.role === relevantRole);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const canAssumeSelf = me && (me.role === relevantRole || me.role === 'adm');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div ref={ref} className="bg-[#111424] border border-[#1e2235] rounded-2xl w-72 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e2235]">
          <span className="text-sm font-semibold text-white capitalize">
            Atribuir {relevantRole}
          </span>
          <button onClick={onClose} className="p-1 rounded text-slate-500 hover:text-white transition">
            <X size={14} />
          </button>
        </div>

        <div className="py-1.5 max-h-80 overflow-y-auto">
          {/* Assume self */}
          {canAssumeSelf && me.googleId !== currentUserId && (
            <button
              onClick={() => { onSave(me.googleId); onClose(); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-indigo-500/10 transition text-left"
            >
              <UserCheck size={14} className="text-indigo-400 shrink-0" />
              <span className="text-sm text-indigo-300 font-medium">Assumir (eu)</span>
            </button>
          )}

          {/* Clear */}
          {currentUserId && (
            <button
              onClick={() => { onSave(null); onClose(); }}
              className="w-full flex items-center gap-3 px-4 py-2 hover:bg-white/5 transition text-left"
            >
              <div className="w-7 h-7 rounded-full border border-dashed border-slate-600 flex items-center justify-center shrink-0">
                <X size={10} className="text-slate-500" />
              </div>
              <span className="text-sm text-slate-400">Remover atribuição</span>
            </button>
          )}

          {filtered.length === 0 && (
            <div className="px-4 py-4 text-center text-sm text-slate-500">
              Nenhum usuário com papel de {relevantRole}
            </div>
          )}

          {filtered.map(u => (
            <button
              key={u.googleId}
              onClick={() => { onSave(u.googleId); onClose(); }}
              className={`w-full flex items-center gap-3 px-4 py-2 hover:bg-white/5 transition text-left ${currentUserId === u.googleId ? 'bg-indigo-500/10' : ''}`}
            >
              <div className="relative">
                <UserAvatar picture={u.picture} name={u.name} size={28} />
                {currentUserId === u.googleId && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-indigo-500 flex items-center justify-center">
                    <span className="text-[7px] text-white font-bold">✓</span>
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <div className="text-sm text-white truncate">{u.name}</div>
                <div className="text-[10px] truncate" style={{ color: u.role ? ROLE_COLORS[u.role] : '#64748b' }}>
                  {u.role ?? 'sem papel'}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
