import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { creativesApi, optionsApi, columnsApi, usersApi } from '../api/client';
import { useToast } from './Toaster';
import type { Creative, Filters, Column } from '../types';
import EditableCell from './EditableCell';
import SelectCell from './SelectCell';
import FilterBar from './FilterBar';
import KPICards from './KPICards';
import AddRowModal from './AddRowModal';
import DriveModal from './DriveModal';
import ColumnManager from './ColumnManager';
import DrivePanel from './DrivePanel';
import YouTubePanel from './YouTubePanel';
import UploadModal from './UploadModal';
import OptionsManager from './OptionsManager';
import UserAvatar from './UserAvatar';
import UserPickerDialog from './UserPickerDialog';
import AdminPanel from './AdminPanel';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Trash2, Film, ChevronUp, ChevronDown, ExternalLink, Link2, Settings2, Tags, LogOut, Shield, X as XIcon } from 'lucide-react';
import YtIcon from './YtIcon';

const EMPTY_FILTERS: Filters = { search: '', status: '', gestor: '', oferta: '', tipo: '' };

type UserPickerState = { creativeId: number; columnKey: 'editor_id' | 'copy_id' | 'gestor_id'; currentUserId: string | null } | null;

function exportCsv(creatives: Creative[], columns: Column[]) {
  const headers = columns.map(c => c.label);
  const rows = creatives.map(cr =>
    columns.map(c => {
      const v = cr[c.key];
      return v == null ? '' : String(v).replace(/,/g, ' ');
    })
  );
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'criativos.csv'; a.click();
  URL.revokeObjectURL(url);
}

export default function CreativesTable() {
  const qc = useQueryClient();
  const { user: me, logout } = useAuth();
  const toast = useToast();
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [assignedToMe, setAssignedToMe] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [showAdd, setShowAdd] = useState(false);
  const [showColManager, setShowColManager] = useState(false);
  const [showDrivePanel, setShowDrivePanel] = useState(false);
  const [showYouTubePanel, setShowYouTubePanel] = useState(false);
  const [showOptionsManager, setShowOptionsManager] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [driveModal, setDriveModal] = useState<{ id: number; url: string } | null>(null);
  const [uploadModal, setUploadModal] = useState<Creative | null>(null);
  const [userPicker, setUserPicker] = useState<UserPickerState>(null);
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);

  const activeFilters = { ...filters, ...(assignedToMe && me ? { assignedTo: me.googleId } : {}) };

  const { data: creativesRaw } = useQuery({
    queryKey: ['creatives', activeFilters],
    queryFn: () => creativesApi.list(activeFilters as Partial<Filters>),
  });
  const creatives: Creative[] = Array.isArray(creativesRaw) ? creativesRaw : [];
  const isLoading = creativesRaw === undefined;

  const { data: options } = useQuery({ queryKey: ['options'], queryFn: optionsApi.list });
  const { data: usersData = [] } = useQuery({ queryKey: ['users'], queryFn: usersApi.list });

  const { data: columnsRaw } = useQuery({ queryKey: ['columns'], queryFn: columnsApi.list });
  const allColumns: Column[] = Array.isArray(columnsRaw) ? columnsRaw : [];
  const columns = allColumns.filter(c => c.visible);

  const userMap = new Map(usersData.map(u => [u.googleId, u]));

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['creatives'] });
    qc.invalidateQueries({ queryKey: ['stats'] });
  };

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Creative> }) => creativesApi.update(id, data),
    onMutate: async ({ id, data }) => {
      await qc.cancelQueries({ queryKey: ['creatives', activeFilters] });
      const prev = qc.getQueryData<Creative[]>(['creatives', activeFilters]);
      qc.setQueryData<Creative[]>(['creatives', activeFilters], old =>
        (old ?? []).map(c => c.id === id ? { ...c, ...data } : c)
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(['creatives', activeFilters], ctx.prev);
      toast.error('Erro ao salvar alteração');
    },
    onSettled: invalidate,
  });

  const deleteMut = useMutation({
    mutationFn: (ids: number[]) => ids.length === 1 ? creativesApi.remove(ids[0]) : creativesApi.bulkDelete(ids),
    onSuccess: (_, ids) => {
      setSelected(new Set());
      invalidate();
      toast.success(ids.length === 1 ? 'Criativo excluído' : `${ids.length} criativos excluídos`);
    },
    onError: () => toast.error('Erro ao excluir'),
  });

  const createMut = useMutation({
    mutationFn: creativesApi.create,
    onSuccess: () => { invalidate(); toast.success('Criativo adicionado'); },
    onError: () => toast.error('Erro ao criar criativo'),
  });

  const bulkUpdateMut = useMutation({
    mutationFn: ({ ids, data }: { ids: number[]; data: Partial<Creative> }) =>
      creativesApi.bulkUpdate(ids, data),
    onSuccess: () => { invalidate(); toast.success('Atualizado com sucesso'); },
    onError: () => toast.error('Erro na atualização em massa'),
  });

  const update = useCallback((id: number, field: string, raw: string) => {
    const numTypes = ['number', 'currency'];
    const col = allColumns.find(c => c.key === field);
    const value = col && numTypes.includes(col.type) ? (parseFloat(raw) ?? null) : raw;
    updateMut.mutate({ id, data: { [field]: value } });
  }, [updateMut, allColumns]);

  const toggleSelect = (id: number) =>
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const toggleAll = () =>
    setSelected(selected.size === creatives.length ? new Set() : new Set(creatives.map(c => c.id)));

  const handleSort = (key: string) =>
    setSort(prev => prev?.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' });

  const sorted = sort ? [...creatives].sort((a, b) => {
    const av = a[sort.key], bv = b[sort.key];
    if (av == null) return 1; if (bv == null) return -1;
    const cmp = typeof av === 'number' ? (av as number) - (bv as number) : String(av).localeCompare(String(bv));
    return sort.dir === 'asc' ? cmp : -cmp;
  }) : creatives;

  const opts = (cat: string) => options?.[cat] ?? [];

  const SortIcon = ({ k }: { k: string }) =>
    sort?.key === k
      ? sort.dir === 'asc' ? <ChevronUp size={11} className="text-indigo-400" /> : <ChevronDown size={11} className="text-indigo-400" />
      : <ChevronUp size={11} className="opacity-0 group-hover:opacity-30" />;

  // ── Dynamic cell renderer ───────────────────────────────────────────────
  const renderCell = (creative: Creative, col: Column) => {
    const raw = creative[col.key];
    const strVal = raw != null ? String(raw) : '';
    const numVal = raw != null ? Number(raw) : 0;

    // User-photo columns (editor_id, copy_id, gestor_id)
    if (col.type === 'user') {
      const userId = raw as string | null;
      const assignedUser = userId ? userMap.get(userId) : null;
      const colKey = col.key as 'editor_id' | 'copy_id' | 'gestor_id';

      return (
        <button
          onClick={() => setUserPicker({ creativeId: creative.id, columnKey: colKey, currentUserId: userId })}
          className="flex items-center justify-center w-full h-full group"
          title={assignedUser ? assignedUser.name : `Atribuir ${col.label.toLowerCase()}`}
        >
          {assignedUser ? (
            <UserAvatar picture={assignedUser.picture} name={assignedUser.name} size={26} />
          ) : (
            <div className="w-[26px] h-[26px] rounded-full border border-dashed border-slate-700 flex items-center justify-center group-hover:border-slate-500 transition">
              <span className="text-[9px] text-slate-600 group-hover:text-slate-400">+</span>
            </div>
          )}
        </button>
      );
    }

    if (col.key === 'criativo') {
      return (
        <div className="flex flex-col gap-0.5 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
          <Film size={11} className="text-slate-600 shrink-0" />
          <EditableCell value={creative.criativo} onSave={v => update(creative.id, 'criativo', v)} className="text-slate-200 truncate" />
          <div className="flex items-center gap-0.5 shrink-0">
            {creative.link_drive ? (
              <>
                <a href={creative.link_drive} target="_blank" rel="noopener noreferrer" title="Abrir no Drive"
                  className="p-0.5 rounded text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition"
                  onClick={e => e.stopPropagation()}>
                  <ExternalLink size={11} />
                </a>
                <button title="Editar link do Drive" onClick={() => setDriveModal({ id: creative.id, url: creative.link_drive })}
                  className="p-0.5 rounded text-slate-500 hover:text-slate-300 hover:bg-white/5 transition">
                  <Link2 size={10} />
                </button>
              </>
            ) : (
              <button title="Adicionar link do Drive" onClick={() => setDriveModal({ id: creative.id, url: '' })}
                className="p-0.5 rounded text-slate-700 hover:text-slate-400 hover:bg-white/5 transition">
                <Link2 size={10} />
              </button>
            )}
            {/* YouTube upload button */}
            <button
              title={creative.youtube_url ? 'Enviado ao YouTube — clique para re-enviar' : 'Fazer upload no YouTube'}
              onClick={() => setUploadModal(creative)}
              className={`p-0.5 rounded transition ${creative.youtube_url ? 'text-red-400 hover:text-red-300 hover:bg-red-500/10' : 'text-slate-700 hover:text-red-400 hover:bg-red-500/10'}`}
            >
              <YtIcon size={10} />
            </button>
            {creative.youtube_url && (
              <a href={creative.youtube_url} target="_blank" rel="noopener noreferrer" title="Abrir no YouTube"
                className="p-0.5 rounded text-red-400 hover:text-red-300 hover:bg-red-500/10 transition"
                onClick={e => e.stopPropagation()}>
                <ExternalLink size={10} />
              </a>
            )}
          </div>
          </div>
          {creative.pasta_origem && (
            <span className="text-[9px] text-indigo-400/70 bg-indigo-500/10 border border-indigo-500/20 rounded px-1.5 py-0.5 truncate max-w-full self-start">
              📁 {creative.pasta_origem}
            </span>
          )}
        </div>
      );
    }

    if (col.key === 'ordem') {
      return <EditableCell value={strVal} onSave={v => update(creative.id, col.key, v)} className="text-slate-400 font-mono text-[11px]" />;
    }

    if (col.type === 'select' && col.selectCategory) {
      return (
        <SelectCell
          value={strVal}
          options={opts(col.selectCategory)}
          onSave={v => updateMut.mutate({ id: creative.id, data: { [col.key]: v } })}
          placeholder="—"
        />
      );
    }

    if (col.type === 'currency') {
      return (
        <EditableCell
          value={raw as number | null}
          onSave={v => update(creative.id, col.key, v)}
          type="number" align="right"
          formatter={v => v && Number(v) > 0 ? `$${Number(v).toFixed(2)}` : '—'}
          className={`font-mono text-[11px] ${numVal > 0 ? 'text-sky-400' : 'text-slate-600'}`}
        />
      );
    }

    if (col.type === 'number') {
      const isVendas = col.key === 'num_vendas';
      return (
        <EditableCell
          value={raw as number | null}
          onSave={v => update(creative.id, col.key, v)}
          type="number" align="right"
          className={isVendas ? `font-medium ${numVal > 0 ? 'text-emerald-400' : 'text-slate-500'}` : 'text-slate-400 font-mono text-[11px]'}
        />
      );
    }

    // text / date / default
    return (
      <EditableCell
        value={strVal}
        onSave={v => update(creative.id, col.key, v)}
        className={col.key === 'observacoes' ? 'text-slate-400' : col.key === 'data' ? 'text-slate-400 font-mono text-[11px]' : 'text-slate-200'}
      />
    );
  };

  const totalWidth = columns.reduce((s, c) => s + (c.width || 100), 40);

  return (
    <div className="flex flex-col h-full bg-[#0a0c14]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e2130] bg-[#0d0f1a]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
            <Film size={14} className="text-white" />
          </div>
          <span className="text-sm font-semibold text-white">Criativos</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Admin panel button — only for adm role */}
          {me?.role === 'adm' && (
            <button
              onClick={() => setShowAdminPanel(true)}
              title="Gerenciar usuários"
              className="relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] border border-[#2a2d3e] text-slate-400 hover:text-white hover:bg-[#1e2130] transition"
            >
              <Shield size={13} /> Usuários
            </button>
          )}
          <button
            onClick={() => setShowDrivePanel(v => !v)}
            title="Google Drive Sync"
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] border transition ${showDrivePanel ? 'bg-[#1a73e8]/15 text-[#5ba8fc] border-[#1a73e8]/30' : 'text-slate-400 hover:text-white border-[#2a2d3e] hover:bg-[#1e2130]'}`}
          >
            <svg width="12" height="11" viewBox="0 0 87.3 78" fill="none" style={{ display: 'inline' }}>
              <path d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3L27.5 53h-21c0 1.55.4 3.1 1.1 4.5L6.6 66.85z" fill="currentColor" opacity=".7"/>
              <path d="M43.65 25L29.9 1.4c-1.35.8-2.5 1.9-3.3 3.3L1.1 48.5A9.06 9.06 0 0 0 0 53h21L43.65 25z" fill="currentColor" opacity=".9"/>
              <path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3L78.95 70l4.25-7.35c.7-1.4 1.1-2.95 1.1-4.5h-21L73.55 76.8z" fill="currentColor" opacity=".6"/>
              <path d="M43.65 25L57.4 1.4C56.05.6 54.5.2 52.9.2H34.4c-1.6 0-3.15.4-4.5 1.2L43.65 25z" fill="currentColor"/>
              <path d="M63.3 53H21L6.6 66.85c1.35.8 2.9 1.15 4.5 1.15h65.1c1.6 0 3.15-.35 4.5-1.15L63.3 53z" fill="currentColor" opacity=".8"/>
              <path d="M73.4 26.5L58.7 4.7c-.8-1.4-1.95-2.5-3.3-3.3L43.65 25l19.65 28h20.95c0-1.55-.4-3.1-1.1-4.5L73.4 26.5z" fill="currentColor" opacity=".85"/>
            </svg>
            Drive
          </button>
          <button
            onClick={() => setShowYouTubePanel(v => !v)}
            title="YouTube Upload"
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] border transition ${showYouTubePanel ? 'bg-red-600/15 text-red-400 border-red-600/30' : 'text-slate-400 hover:text-white border-[#2a2d3e] hover:bg-[#1e2130]'}`}
          >
            <YtIcon size={12} /> YouTube
          </button>
          <button
            onClick={() => setShowColManager(v => !v)}
            title="Gerenciar colunas"
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] border transition ${showColManager ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30' : 'text-slate-400 hover:text-white border-[#2a2d3e] hover:bg-[#1e2130]'}`}
          >
            <Settings2 size={13} /> Colunas
          </button>
          <button
            onClick={() => setShowOptionsManager(true)}
            title="Gerenciar opções de campos"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] border border-[#2a2d3e] text-slate-400 hover:text-white hover:bg-[#1e2130] transition"
          >
            <Tags size={13} /> Opções
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition"
          >
            <Plus size={13} /> Novo
          </button>

          {/* User avatar + logout */}
          {me && (
            <div className="flex items-center gap-1.5 pl-1 border-l border-[#2a2d3e] ml-1">
              <UserAvatar picture={me.picture} name={me.name} size={26} className="cursor-default" />
              <button
                onClick={logout}
                title="Sair"
                className="p-1.5 rounded text-slate-600 hover:text-slate-300 hover:bg-white/5 transition"
              >
                <LogOut size={13} />
              </button>
            </div>
          )}
        </div>
      </div>

      <KPICards />

      <FilterBar
        filters={filters}
        options={options}
        onChange={f => setFilters(prev => ({ ...prev, ...f }))}
        onReset={() => setFilters(EMPTY_FILTERS)}
        assignedToMe={assignedToMe}
        onAssignedToMe={setAssignedToMe}
        onExport={() => exportCsv(sorted, columns)}
      />

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-[12px]" style={{ minWidth: totalWidth }}>
          <thead className="sticky top-0 z-10">
            <tr className="bg-[#0d0f1a] border-b-2 border-[#1e2130]">
              <th className="w-10 px-3 py-2.5 text-center">
                <input type="checkbox" checked={creatives.length > 0 && selected.size === creatives.length}
                  onChange={toggleAll} className="w-3.5 h-3.5 accent-indigo-500 cursor-pointer" />
              </th>
              {columns.map(col => (
                <th
                  key={col.key}
                  style={{ width: col.width, minWidth: col.width }}
                  onClick={() => handleSort(col.key)}
                  className="group px-2 py-2.5 text-left text-[10px] font-semibold text-slate-400 tracking-widest uppercase select-none cursor-pointer hover:text-slate-200 transition"
                >
                  <span className="flex items-center gap-1">
                    {col.label}
                    <SortIcon k={col.key} />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <tr key={i} className="border-b border-[#1a1d2e]">
                  <td className="w-10 px-3 py-2.5">
                    <div className="w-3.5 h-3.5 rounded bg-[#1e2235] skeleton" />
                  </td>
                  {columns.map((col, j) => (
                    <td key={col.key} className="px-2 py-2.5" style={{ maxWidth: col.width }}>
                      <div className="h-3 rounded bg-[#1e2235] skeleton" style={{ width: `${55 + ((i * 7 + j * 13) % 35)}%` }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : sorted.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} className="py-16 text-center text-slate-500">
                  Nenhum criativo encontrado
                </td>
              </tr>
            ) : (
              sorted.map((creative, i) => (
                <tr
                  key={creative.id}
                  className={`border-b border-[#16192a] transition-colors ${selected.has(creative.id) ? 'bg-indigo-500/10' : i % 2 === 0 ? 'bg-[#0f1117]' : 'bg-[#0c0e19]'} hover:bg-[#181b2e]`}
                >
                  <td className="w-10 px-3 py-1 text-center">
                    <input type="checkbox" checked={selected.has(creative.id)} onChange={() => toggleSelect(creative.id)}
                      className="w-3.5 h-3.5 accent-indigo-500 cursor-pointer" />
                  </td>
                  {columns.map(col => (
                    <td key={col.key} className="px-2 py-1" style={{ maxWidth: col.width }}>
                      {renderCell(creative, col)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-[#1e2130] bg-[#0d0f1a] text-[11px] text-slate-500">
        <span>{sorted.length} criativos{selected.size > 0 ? ` · ${selected.size} selecionados` : ''}</span>
        <span>Duplo clique para editar · Clique no badge para alterar</span>
      </div>

      {showAdd && options && (
        <AddRowModal options={options} onClose={() => setShowAdd(false)} onSave={data => createMut.mutate(data as Partial<Creative>)} />
      )}

      {driveModal && (
        <DriveModal
          url={driveModal.url}
          onClose={() => setDriveModal(null)}
          onSave={url => { updateMut.mutate({ id: driveModal.id, data: { link_drive: url } }); setDriveModal(null); }}
        />
      )}

      {showColManager && <ColumnManager onClose={() => setShowColManager(false)} />}
      {showDrivePanel && <DrivePanel onClose={() => setShowDrivePanel(false)} />}
      {showYouTubePanel && <YouTubePanel onClose={() => setShowYouTubePanel(false)} />}
      {uploadModal && <UploadModal creative={uploadModal} onClose={() => setUploadModal(null)} />}
      {showOptionsManager && <OptionsManager onClose={() => setShowOptionsManager(false)} />}
      {showAdminPanel && <AdminPanel onClose={() => setShowAdminPanel(false)} />}

      {/* ── Bulk action bar ── */}
      {selected.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#111424] border border-[#2a2d3e] shadow-2xl">
          <span className="text-[12px] text-slate-400 font-medium pr-1">{selected.size} selecionado{selected.size > 1 ? 's' : ''}</span>
          <div className="w-px h-4 bg-[#2a2d3e]" />
          {(['status', 'oferta', 'tipo'] as const).map(key => (
            <select
              key={key}
              defaultValue=""
              onChange={e => {
                if (!e.target.value) return;
                bulkUpdateMut.mutate({ ids: [...selected], data: { [key]: e.target.value } });
                e.target.value = '';
              }}
              className="bg-[#1a1d2e] border border-[#2a2d3e] rounded-lg px-2.5 py-1.5 text-[11px] text-slate-400 outline-none cursor-pointer hover:border-indigo-500/40 transition"
            >
              <option value="" disabled>↳ {key.charAt(0).toUpperCase() + key.slice(1)}</option>
              {options?.[key]?.map(o => <option key={o.value} value={o.value}>{o.value}</option>)}
            </select>
          ))}
          <div className="w-px h-4 bg-[#2a2d3e]" />
          <button
            onClick={async () => {
              if (await toast.confirm(`Excluir ${selected.size} criativo${selected.size > 1 ? 's' : ''}?`))
                deleteMut.mutate([...selected]);
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] text-red-400 hover:bg-red-500/15 border border-red-500/20 transition"
          >
            <Trash2 size={12} /> Excluir
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="p-1.5 rounded-lg text-slate-600 hover:text-slate-300 hover:bg-white/5 transition"
          >
            <XIcon size={13} />
          </button>
        </div>
      )}
      {userPicker && (
        <UserPickerDialog
          currentUserId={userPicker.currentUserId}
          columnKey={userPicker.columnKey}
          onSave={googleId => updateMut.mutate({ id: userPicker.creativeId, data: { [userPicker.columnKey]: googleId } })}
          onClose={() => setUserPicker(null)}
        />
      )}
    </div>
  );
}
