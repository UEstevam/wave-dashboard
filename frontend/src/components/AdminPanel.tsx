import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '../api/client';
import type { AppUser, UserRole } from '../types';
import UserAvatar from './UserAvatar';
import { X, Check, Trash2, Shield } from 'lucide-react';

const ROLES: { value: UserRole; label: string; color: string }[] = [
  { value: 'adm',    label: 'Administrador', color: '#6366f1' },
  { value: 'gestor', label: 'Gestor',        color: '#10b981' },
  { value: 'editor', label: 'Editor',        color: '#0ea5e9' },
  { value: 'copy',   label: 'Copy',          color: '#f59e0b' },
];

interface Props {
  onClose: () => void;
}

export default function AdminPanel({ onClose }: Props) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'pending' | 'all'>('pending');

  const { data: pending = [] } = useQuery({ queryKey: ['users-pending'], queryFn: usersApi.listPending, refetchInterval: 15000 });
  const { data: all = [] } = useQuery({ queryKey: ['users-all'], queryFn: usersApi.listAll });

  const approveMut = useMutation({
    mutationFn: ({ googleId, role }: { googleId: string; role: string }) =>
      usersApi.approve(googleId, role),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users-pending'] });
      qc.invalidateQueries({ queryKey: ['users-all'] });
      qc.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const roleMut = useMutation({
    mutationFn: ({ googleId, role }: { googleId: string; role: string }) =>
      usersApi.updateRole(googleId, role),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users-all'] });
      qc.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const removeMut = useMutation({
    mutationFn: (googleId: string) => usersApi.remove(googleId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users-pending'] });
      qc.invalidateQueries({ queryKey: ['users-all'] });
      qc.invalidateQueries({ queryKey: ['users'] });
    },
  });

  function UserRow({ u, showApprove }: { u: AppUser; showApprove?: boolean }) {
    const [selectedRole, setSelectedRole] = useState<string>(u.role ?? 'editor');

    return (
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[#1a1d2e] last:border-0">
        <UserAvatar picture={u.picture} name={u.name} size={36} />
        <div className="min-w-0 flex-1">
          <div className="text-sm text-white font-medium truncate">{u.name}</div>
          <div className="text-[11px] text-slate-500 truncate">{u.email}</div>
        </div>

        <select
          value={showApprove ? selectedRole : (u.role ?? '')}
          onChange={e => {
            if (showApprove) {
              setSelectedRole(e.target.value);
            } else {
              roleMut.mutate({ googleId: u.googleId, role: e.target.value });
            }
          }}
          className="bg-[#1a1d2e] border border-[#2a2d3e] rounded-md text-[11px] text-slate-300 px-2 py-1 outline-none cursor-pointer"
        >
          {ROLES.map(r => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>

        {showApprove ? (
          <button
            onClick={() => approveMut.mutate({ googleId: u.googleId, role: selectedRole })}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/25 text-[11px] font-medium transition"
          >
            <Check size={12} /> Aprovar
          </button>
        ) : (
          <button
            onClick={() => { if (confirm(`Remover ${u.name}?`)) removeMut.mutate(u.googleId); }}
            className="p-1.5 rounded text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
    );
  }

  const displayList = tab === 'pending' ? pending : all;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4">
      <div className="bg-[#0d0f1a] border border-[#1e2235] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e2235]">
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-indigo-400" />
            <span className="text-white font-semibold text-sm">Gerenciar Usuários</span>
            {pending.length > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {pending.length}
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-1 rounded text-slate-500 hover:text-white transition">
            <X size={15} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#1e2235]">
          {(['pending', 'all'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-[12px] font-medium transition ${tab === t ? 'text-indigo-400 border-b-2 border-indigo-500' : 'text-slate-500 hover:text-slate-300'}`}
            >
              {t === 'pending' ? `Pendentes${pending.length > 0 ? ` (${pending.length})` : ''}` : `Todos (${all.length})`}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="max-h-96 overflow-y-auto">
          {displayList.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-sm">
              {tab === 'pending' ? 'Nenhum acesso pendente' : 'Nenhum usuário cadastrado'}
            </div>
          ) : (
            displayList.map(u => (
              <UserRow key={u.googleId} u={u} showApprove={tab === 'pending'} />
            ))
          )}
        </div>

        <div className="px-5 py-3 border-t border-[#1e2235] text-[11px] text-slate-600">
          Usuários aprovados podem acessar o dashboard imediatamente.
        </div>
      </div>
    </div>
  );
}
