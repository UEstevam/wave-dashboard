import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { creativesApi, optionsApi, columnsApi } from '../api/client';
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
import { Plus, Trash2, Film, ChevronUp, ChevronDown, ExternalLink, Link2, Settings2 } from 'lucide-react';
import YtIcon from './YtIcon';

const EMPTY_FILTERS: Filters = { search: '', status: '', gestor: '', oferta: '', tipo: '' };

export default function CreativesTable() {
  const qc = useQueryClient();
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [showAdd, setShowAdd] = useState(false);
  const [showColManager, setShowColManager] = useState(false);
  const [showDrivePanel, setShowDrivePanel] = useState(false);
  const [showYouTubePanel, setShowYouTubePanel] = useState(false);
  const [driveModal, setDriveModal] = useState<{ id: number; url: string } | null>(null);
  const [uploadModal, setUploadModal] = useState<Creative | null>(null);
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);

  const { data: creativesRaw } = useQuery({
    queryKey: ['creatives', filters],
    queryFn: () => creativesApi.list(filters),
  });
  const creatives: Creative[] = Array.isArray(creativesRaw) ? creativesRaw : [];
  const isLoading = creativesRaw === undefined;

  const { data: options } = useQuery({ queryKey: ['options'], queryFn: optionsApi.list });

  const { data: columnsRaw } = useQuery({ queryKey: ['columns'], queryFn: columnsApi.list });
  const allColumns: Column[] = Array.isArray(columnsRaw) ? columnsRaw : [];
  const columns = allColumns.filter(c => c.visible);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['creatives'] });
    qc.invalidateQueries({ queryKey: ['stats'] });
  };

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Creative> }) => creativesApi.update(id, data),
    onSuccess: invalidate,
  });

  const deleteMut = useMutation({
    mutationFn: (ids: number[]) => ids.length === 1 ? creativesApi.remove(ids[0]) : creativesApi.bulkDelete(ids),
    onSuccess: () => { setSelected(new Set()); invalidate(); },
  });

  const createMut = useMutation({ mutationFn: creativesApi.create, onSuccess: invalidate });

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

    if (col.key === 'criativo') {
      return (
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
    <div className="flex flex-col h-screen bg-[#0f1117]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e2130]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
            <Film size={14} className="text-white" />
          </div>
          <span className="text-sm font-semibold text-white">Wave Dashboard</span>
          <span className="text-[11px] text-slate-500 border border-[#2a2d3e] rounded px-1.5 py-0.5">Criativos</span>
        </div>
        <div className="flex items-center gap-2">
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
          {selected.size > 0 && (
            <button
              onClick={() => deleteMut.mutate([...selected])}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition"
            >
              <Trash2 size={12} /> Excluir {selected.size}
            </button>
          )}
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition"
          >
            <Plus size={13} /> Novo
          </button>
        </div>
      </div>

      <KPICards />

      <FilterBar
        filters={filters}
        options={options}
        onChange={f => setFilters(prev => ({ ...prev, ...f }))}
        onReset={() => setFilters(EMPTY_FILTERS)}
      />

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-[12px]" style={{ minWidth: totalWidth }}>
          <thead className="sticky top-0 z-10">
            <tr className="bg-[#131623] border-b border-[#1e2130]">
              <th className="w-10 px-3 py-2 text-center">
                <input type="checkbox" checked={creatives.length > 0 && selected.size === creatives.length}
                  onChange={toggleAll} className="w-3.5 h-3.5 accent-indigo-500 cursor-pointer" />
              </th>
              {columns.map(col => (
                <th
                  key={col.key}
                  style={{ width: col.width, minWidth: col.width }}
                  onClick={() => handleSort(col.key)}
                  className="group px-2 py-2 text-left text-[10px] font-semibold text-slate-500 tracking-wider select-none cursor-pointer hover:text-slate-300 transition"
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
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b border-[#1a1d2e]">
                  <td colSpan={columns.length + 1}>
                    <div className="h-8 bg-[#1a1d2e] animate-pulse rounded mx-2 my-1" />
                  </td>
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
                  className={`border-b border-[#1a1d2e] transition-colors ${selected.has(creative.id) ? 'bg-indigo-500/5' : i % 2 === 0 ? 'bg-[#0f1117]' : 'bg-[#111420]'} hover:bg-[#1a1d2e]`}
                >
                  <td className="w-10 px-3 py-1.5 text-center">
                    <input type="checkbox" checked={selected.has(creative.id)} onChange={() => toggleSelect(creative.id)}
                      className="w-3.5 h-3.5 accent-indigo-500 cursor-pointer" />
                  </td>
                  {columns.map(col => (
                    <td key={col.key} className="px-2 py-1.5" style={{ maxWidth: col.width }}>
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
      <div className="flex items-center justify-between px-4 py-2 border-t border-[#1e2130] text-[11px] text-slate-500">
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
    </div>
  );
}
