import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adsPowerApi, getBaseUrl, saveBaseUrl } from '../api/adspower';
import type { AdsProfile, AdsGroup, ProfileData, AdsConfig } from '../api/adspower';
import { useToast } from './Toaster';
import {
  RefreshCw, Settings2, X, Plus, WifiOff,
  ChevronLeft, ChevronRight, AlertCircle, Search,
} from 'lucide-react';

/* ─── Situação config ──────────────────────────────────────────── */

interface SituacaoOpt { label: string; bg: string; fg: string }

const SITUACAO: Record<string, SituacaoOpt> = {
  ativa:              { label: 'Ativa',               bg: '#15803d', fg: '#fff' },
  ativa_conversao:    { label: 'Ativa (Conversão)',    bg: '#0f766e', fg: '#fff' },
  ativa_aquecimento:  { label: 'Ativa (Aquecimento)', bg: '#6d28d9', fg: '#fff' },
  fs:                 { label: 'FS',                  bg: '#c2410c', fg: '#fff' },
  aguardando:         { label: 'Aguardando Anál.',    bg: '#b45309', fg: '#fff' },
  em_analise:         { label: 'Em Análise',          bg: '#1d4ed8', fg: '#fff' },
  va_analise:         { label: 'VA em Análise',       bg: '#0e7490', fg: '#fff' },
  suspensa:           { label: 'Suspensa',            bg: '#9f1239', fg: '#fff' },
  banida:             { label: 'Banida',              bg: '#7f1d1d', fg: '#fca5a5' },
  na:                 { label: 'N/A',                 bg: '#1c1c22', fg: '#555560' },
};

function SituacaoBadge({ value }: { value: string }) {
  const opt = SITUACAO[value];
  if (!opt) return <span className="text-[#3a3a45]">—</span>;
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap"
      style={{ backgroundColor: opt.bg, color: opt.fg }}
    >
      {opt.label}
    </span>
  );
}

/* ─── Tag config ───────────────────────────────────────────────── */

interface TagStyle { bg: string; fg: string }

const TAG_SOLID: Record<string, TagStyle> = {
  darkBlue:   { bg: '#1e3a8a', fg: '#93c5fd' },
  blue:       { bg: '#1e40af', fg: '#93c5fd' },
  purple:     { bg: '#581c87', fg: '#d8b4fe' },
  red:        { bg: '#991b1b', fg: '#fca5a5' },
  yellow:     { bg: '#92400e', fg: '#fcd34d' },
  orange:     { bg: '#9a3412', fg: '#fdba74' },
  green:      { bg: '#14532d', fg: '#86efac' },
  lightGreen: { bg: '#166534', fg: '#a7f3d0' },
  default:    { bg: '#2a2a35', fg: '#9090a0' },
};

function getProfileTags(profile: AdsProfile) {
  const raw = profile.fbcc_user_tag || [];
  if (!Array.isArray(raw)) return [];
  return raw.filter(Boolean).map(t => {
    if (typeof t === 'object' && t !== null) return { id: String(t.id), name: t.name, color: t.color || 'default' };
    return { id: String(t), name: String(t), color: 'default' };
  }).filter(t => t.name);
}

/* ─── Initials badge ───────────────────────────────────────────── */

const AVATAR_COLORS = [
  '#6366f1','#8b5cf6','#ec4899','#ef4444',
  '#f97316','#eab308','#22c55e','#14b8a6',
  '#0ea5e9','#3b82f6',
];

function nameColor(name: string) {
  if (!name) return '#2a2a35';
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[Math.abs(h)];
}

function getInitials(name: string) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function InitialsBadge({ name }: { name?: string }) {
  if (!name) return <span className="text-[#3a3a45] text-[11px]">—</span>;
  return (
    <div
      className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black text-white shrink-0 select-none"
      style={{ backgroundColor: nameColor(name) }}
      title={name}
    >
      {getInitials(name)}
    </div>
  );
}

/* ─── Last access ──────────────────────────────────────────────── */

function formatAccess(ts?: string | number) {
  if (!ts || ts === '0') return { text: '—', cls: '' };
  const ms = String(ts).length === 10 ? Number(ts) * 1000 : Number(ts);
  if (!ms) return { text: '—', cls: '' };
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  if (mins < 1)   return { text: 'Agora',         cls: 'text-[#00c896]' };
  if (mins < 60)  return { text: `${mins}m`,       cls: 'text-[#00c896]' };
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return { text: `${hrs}h`,        cls: 'text-emerald-400' };
  const days = Math.floor(hrs / 24);
  if (days <= 7)  return { text: `${days}d`,        cls: 'text-amber-400' };
  if (days <= 30) return { text: `${days}d`,        cls: 'text-orange-400' };
  return { text: new Date(ms).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' }), cls: 'text-red-400' };
}

/* ─── Group tab ────────────────────────────────────────────────── */

function GroupTab({ label, count, active, onClick }: {
  label: string; count: number; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-3.5 text-[12px] font-semibold border-b-2 transition-all whitespace-nowrap shrink-0 ${
        active
          ? 'text-white border-[#00c896]'
          : 'text-[#55555f] border-transparent hover:text-[#9090a0] hover:border-[#2a2a35]'
      }`}
    >
      {label}
      <span
        className="px-1.5 py-0.5 rounded text-[10px] font-bold leading-none"
        style={active
          ? { backgroundColor: '#00c896', color: '#000' }
          : { backgroundColor: '#1a1a20', color: '#555560' }
        }
      >
        {count}
      </span>
    </button>
  );
}

/* ─── ListEditor (used in drawer) ─────────────────────────────── */

function ListEditor({ items, onChange, placeholder }: {
  items: string[]; onChange: (items: string[]) => void; placeholder?: string;
}) {
  const [vals, setVals] = useState<string[]>(items);
  const update = (i: number, v: string) => {
    const next = vals.map((old, idx) => idx === i ? v : old);
    setVals(next);
    onChange(next.filter(Boolean));
  };
  const remove = (i: number) => {
    const next = vals.filter((_, idx) => idx !== i);
    setVals(next);
    onChange(next.filter(Boolean));
  };
  return (
    <div className="flex flex-col gap-1.5">
      {vals.map((v, i) => (
        <div key={i} className="flex items-center gap-2 bg-[#111115] border border-[#222228] rounded-lg px-3 py-1.5 focus-within:border-[#00c896]/40 transition">
          <input
            value={v}
            onChange={e => update(i, e.target.value)}
            placeholder={placeholder}
            className="flex-1 bg-transparent text-[12px] text-[#d0d0d8] font-mono outline-none placeholder:text-[#3a3a45]"
          />
          <button onClick={() => remove(i)} className="shrink-0 text-[#3a3a45] hover:text-red-400 transition">
            <X size={11} />
          </button>
        </div>
      ))}
      <button
        onClick={() => setVals(p => [...p, ''])}
        className="flex items-center gap-1.5 px-3 py-1.5 border border-dashed border-[#222228] rounded-lg text-[11px] text-[#444450] hover:text-[#00c896] hover:border-[#00c896]/40 transition"
      >
        <Plus size={11} /> Adicionar
      </button>
    </div>
  );
}

/* ─── EditDrawer ───────────────────────────────────────────────── */

function EditDrawer({ profile, data, onClose, onSave, saving }: {
  profile: AdsProfile;
  data: ProfileData;
  onClose: () => void;
  onSave: (id: string, d: Omit<ProfileData, 'updatedAt'>) => void;
  saving: boolean;
}) {
  const [situacao, setSituacao]     = useState(data.situacao || '');
  const [responsavel, setResp]      = useState(data.responsavel || '');
  const [gestor, setGestor]         = useState(data.gestor || '');
  const [creatives, setCreatives]   = useState<string[]>(data.creatives || []);
  const [campaigns, setCampaigns]   = useState<string[]>(data.campaigns || []);
  const [notes, setNotes]           = useState(data.notes || '');

  const save = () => onSave(profile.user_id, {
    situacao, responsavel: responsavel.trim(), gestor: gestor.trim(),
    creatives: creatives.filter(Boolean), campaigns: campaigns.filter(Boolean),
    notes: notes.trim(),
  });

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div
        className="w-[480px] max-w-[95vw] h-full bg-[#0e0e11] border-l border-[#1a1a20] flex flex-col shadow-2xl"
        style={{ animation: 'slideInRight 0.22s cubic-bezier(0.16,1,0.3,1)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-5 border-b border-[#1a1a20] bg-[#111115] flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <p className="text-[14px] font-bold text-white truncate">{profile.name || '—'}</p>
            <p className="text-[10px] text-[#555560] font-mono mt-0.5">{profile.user_id}</p>
          </div>
          <button onClick={onClose} className="shrink-0 text-[#555560] hover:text-white transition mt-0.5">
            <X size={15} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Situação */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-[#555560]">Situação</label>
            <select
              value={situacao}
              onChange={e => setSituacao(e.target.value)}
              className="w-full bg-[#111115] border border-[#222228] rounded-lg px-3 py-2.5 text-[12px] text-[#d0d0d8] outline-none focus:border-[#00c896]/50 transition cursor-pointer"
            >
              <option value="">— Sem situação —</option>
              {Object.entries(SITUACAO).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>

          {/* Responsável */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-[#555560]">Responsável</label>
            <input
              value={responsavel}
              onChange={e => setResp(e.target.value)}
              placeholder="Nome do responsável…"
              className="w-full bg-[#111115] border border-[#222228] rounded-lg px-3 py-2.5 text-[12px] text-[#d0d0d8] outline-none focus:border-[#00c896]/50 transition placeholder:text-[#3a3a45]"
            />
          </div>

          {/* Gestor */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-[#555560]">Gestor</label>
            <input
              value={gestor}
              onChange={e => setGestor(e.target.value)}
              placeholder="Nome do gestor…"
              className="w-full bg-[#111115] border border-[#222228] rounded-lg px-3 py-2.5 text-[12px] text-[#d0d0d8] outline-none focus:border-[#00c896]/50 transition placeholder:text-[#3a3a45]"
            />
          </div>

          <div className="border-t border-[#1a1a20]" />

          {/* Criativos */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-[#555560]">Criativos</label>
            <ListEditor items={creatives} onChange={setCreatives} placeholder="Ex: MM2AD63-H1-NH3-VV3" />
          </div>

          {/* Campanhas */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-[#555560]">Campanhas</label>
            <ListEditor items={campaigns} onChange={setCampaigns} placeholder="Nome da campanha…" />
          </div>

          {/* Notas */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-[#555560]">Observações</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={4}
              placeholder="Histórico, suspensões, observações…"
              className="w-full bg-[#111115] border border-[#222228] rounded-lg px-3 py-2.5 text-[12px] text-[#d0d0d8] outline-none focus:border-[#00c896]/50 transition resize-none placeholder:text-[#3a3a45]"
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-[#1a1a20] bg-[#111115] flex items-center justify-end gap-2 shrink-0">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-[12px] text-[#666670] hover:text-white hover:bg-[#1a1a20] transition">
            Cancelar
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="px-5 py-2 rounded-lg text-[12px] font-semibold text-black transition disabled:opacity-50"
            style={{ backgroundColor: '#00c896' }}
          >
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── SettingsModal ────────────────────────────────────────────── */

function SettingsModal({ currentBase, initialConfig, onClose, onSave, saving }: {
  currentBase: string;
  initialConfig: AdsConfig | null;
  onClose: () => void;
  onSave: (base: string, cfg: AdsConfig) => void;
  saving: boolean;
}) {
  const [base, setBase]   = useState(currentBase);
  const [port, setPort]   = useState(String(initialConfig?.port || 50325));
  const [apiKey, setKey]  = useState(initialConfig?.apiKey || '');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm" onClick={onClose}>
      <div className="w-[460px] max-w-[95vw] bg-[#0e0e11] border border-[#1a1a20] rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-[#1a1a20] flex items-center justify-between">
          <p className="text-[14px] font-bold text-white">Configurações da API</p>
          <button onClick={onClose} className="text-[#555560] hover:text-white transition"><X size={15} /></button>
        </div>
        <div className="p-6 space-y-5">
          <Field label="URL do servidor local" hint="Onde o servidor Wave Contas está rodando.">
            <input value={base} onChange={e => setBase(e.target.value)} placeholder="http://localhost:3000"
              className="input-dark" />
          </Field>
          <Field label="Porta do AdsPower" hint="Porta padrão do AdsPower Local API é 50325.">
            <input value={port} onChange={e => setPort(e.target.value)} type="number" placeholder="50325"
              className="input-dark" />
          </Field>
          <Field label={<>API Key <span className="text-[10px] font-normal text-[#3a3a45] ml-1">opcional</span></>}
            hint="Deixe vazio se não ativou autenticação.">
            <input value={apiKey} onChange={e => setKey(e.target.value)} type="password"
              placeholder="Chave de API…" className="input-dark" />
          </Field>
        </div>
        <div className="px-6 py-4 border-t border-[#1a1a20] bg-[#111115] flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-[12px] text-[#666670] hover:text-white hover:bg-[#1a1a20] transition">Cancelar</button>
          <button
            onClick={() => onSave(base.trim() || 'http://localhost:3000', { port: Number(port) || 50325, apiKey: apiKey.trim() })}
            disabled={saving}
            className="px-5 py-2 rounded-lg text-[12px] font-semibold text-black disabled:opacity-50 transition"
            style={{ backgroundColor: '#00c896' }}
          >
            {saving ? 'Salvando…' : 'Salvar e Conectar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: React.ReactNode; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-semibold text-[#b0b0bc]">{label}</label>
      {children}
      {hint && <p className="text-[10px] text-[#3a3a45]">{hint}</p>}
    </div>
  );
}

/* ─── AccountsPanel ────────────────────────────────────────────── */

const PAGE_SIZE = 100;

export default function AccountsPanel() {
  const qc    = useQueryClient();
  const toast = useToast();

  const [baseUrl, setBaseUrlState] = useState(getBaseUrl);
  const [showSettings, setShowSettings] = useState(false);
  const [editProfile, setEditProfile]   = useState<AdsProfile | null>(null);

  const [search, setSearch]           = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [page, setPage]               = useState(1);

  /* ── queries ── */
  const { data: config, isError: configError } = useQuery<AdsConfig>({
    queryKey: ['ads-config', baseUrl],
    queryFn:  () => adsPowerApi.getConfig(baseUrl),
    retry: 1, staleTime: 30000,
  });
  const connected = !configError && config !== undefined;

  const { data: groupsData } = useQuery({
    queryKey: ['ads-groups', baseUrl],
    queryFn:  () => adsPowerApi.getGroups(baseUrl),
    enabled: connected, retry: 1, staleTime: 30000,
  });
  const groups: AdsGroup[] = groupsData?.data?.list || [];

  const {
    data: allProfiles = [], isLoading: loadingProfiles,
    isError: profilesError, error: profilesErr, refetch: refetchProfiles,
  } = useQuery<AdsProfile[]>({
    queryKey: ['ads-profiles', baseUrl, groupFilter],
    queryFn: async () => {
      const ADS_PAGE = 200;
      let pg = 1; let all: AdsProfile[] = [];
      while (true) {
        const params = new URLSearchParams({ page: String(pg), page_size: String(ADS_PAGE) });
        if (groupFilter) params.set('group_id', groupFilter);
        const data = await adsPowerApi.getProfiles(baseUrl, params);
        if (data.code !== 0) throw new Error(data.msg || `Código de erro: ${data.code}`);
        const batch: AdsProfile[] = data.data?.list || [];
        all = [...all, ...batch];
        if (batch.length < ADS_PAGE) break;
        pg++;
      }
      return all;
    },
    enabled: connected && groupsData !== undefined,
    retry: false, staleTime: 60000,
  });

  const { data: profileDataMap = {} } = useQuery<Record<string, ProfileData>>({
    queryKey: ['ads-creatives', baseUrl],
    queryFn:  () => adsPowerApi.getProfileData(baseUrl),
    enabled: connected, staleTime: 10000,
  });

  /* ── group counts ── */
  const groupCounts = useMemo(() => {
    const m: Record<string, number> = {};
    allProfiles.forEach(p => { m[p.group_id] = (m[p.group_id] || 0) + 1; });
    return m;
  }, [allProfiles]);

  /* ── filter ── */
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return allProfiles.filter(p => {
      if (!q) return true;
      return `${p.name} ${p.user_id} ${p.remark || ''} ${p.username || ''}`.toLowerCase().includes(q);
    });
  }, [allProfiles, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const pageRows   = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  /* ── mutations ── */
  const invalidateAll = () => {
    qc.refetchQueries({ queryKey: ['ads-config',    baseUrl] });
    qc.refetchQueries({ queryKey: ['ads-groups',    baseUrl] });
    qc.refetchQueries({ queryKey: ['ads-profiles',  baseUrl] });
    qc.refetchQueries({ queryKey: ['ads-creatives', baseUrl] });
  };

  const saveMut = useMutation({
    mutationFn: ({ profileId, data }: { profileId: string; data: Omit<ProfileData, 'updatedAt'> }) =>
      adsPowerApi.updateProfileData(baseUrl, profileId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ads-creatives', baseUrl] });
      toast.success('Alterações salvas');
      setEditProfile(null);
    },
    onError: () => toast.error('Erro ao salvar'),
  });

  const saveConfigMut = useMutation({
    mutationFn: ({ base, cfg }: { base: string; cfg: AdsConfig }) =>
      adsPowerApi.saveConfig(base, cfg),
    onSuccess: (_d, vars) => {
      saveBaseUrl(vars.base);
      setBaseUrlState(vars.base);
      qc.clear();
      setShowSettings(false);
      toast.success('Configurações salvas');
      setTimeout(invalidateAll, 300);
    },
    onError: () => toast.error('Erro ao salvar configurações.'),
  });

  const getProfileData = (id: string): ProfileData =>
    profileDataMap[id] || { creatives: [], campaigns: [], notes: '', situacao: '', responsavel: '', gestor: '' };

  /* ─── RENDER ─────────────────────────────────────────────────── */
  return (
    <div className="flex flex-col h-full bg-[#0c0c0e] text-[#f0f0f4]">

      {/* ── Group tabs row ── */}
      <div className="flex items-center justify-between border-b border-[#1a1a20] bg-[#0e0e11] shrink-0">
        <div className="flex items-center overflow-x-auto hide-scrollbar">
          <GroupTab
            label="Todos"
            count={allProfiles.length}
            active={!groupFilter}
            onClick={() => { setGroupFilter(''); setPage(1); }}
          />
          {groups.map(g => (
            <GroupTab
              key={g.group_id}
              label={g.group_name}
              count={groupCounts[g.group_id] || 0}
              active={groupFilter === g.group_id}
              onClick={() => { setGroupFilter(g.group_id); setPage(1); }}
            />
          ))}
        </div>

        <div className="flex items-center gap-1.5 px-4 shrink-0">
          {/* connection badge */}
          <span className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold border ${
            connected
              ? 'text-[#00c896] border-[#00c896]/25 bg-[#00c896]/8'
              : 'text-red-400 border-red-500/20 bg-red-500/8'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-[#00c896]' : 'bg-red-400'}`} />
            {connected ? 'Conectado' : 'Desconectado'}
          </span>
          <button
            onClick={invalidateAll}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] border border-[#222228] text-[#666670] hover:text-white hover:bg-[#1a1a20] transition"
          >
            <RefreshCw size={12} /> Atualizar
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] border border-[#222228] text-[#666670] hover:text-white hover:bg-[#1a1a20] transition"
          >
            <Settings2 size={12} /> Config
          </button>
        </div>
      </div>

      {/* ── Search + count row ── */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#1a1a20] bg-[#0e0e11] shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#3a3a45] pointer-events-none" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Buscar por nome, ID, remark…"
              className="bg-[#111115] border border-[#1e1e24] rounded-lg pl-8 pr-3 py-1.5 text-[12px] text-[#d0d0d8] placeholder:text-[#3a3a45] outline-none focus:border-[#00c896]/40 transition w-64"
            />
          </div>
          {connected && !loadingProfiles && !profilesError && (
            <span className="text-[11px] text-[#444450] font-semibold tracking-wide">
              {filtered.length} PERFIS EM {groups.length} GRUPO{groups.length !== 1 ? 'S' : ''}
            </span>
          )}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 min-h-0 overflow-auto">

        {/* Not connected */}
        {!connected && !loadingProfiles && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <WifiOff size={40} className="text-[#2a2a35]" />
            <p className="text-[#555560] text-sm max-w-sm leading-relaxed">
              Servidor Wave Contas não encontrado em{' '}
              <code className="text-[#888895] bg-[#111115] px-1 rounded">{baseUrl}</code>
            </p>
            <button
              onClick={() => setShowSettings(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-[12px] font-semibold text-black transition"
              style={{ backgroundColor: '#00c896' }}
            >
              <Settings2 size={13} /> Abrir Configurações
            </button>
          </div>
        )}

        {/* Loading */}
        {loadingProfiles && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-[#555560]">
            <div className="w-7 h-7 border-2 border-[#1a1a20] border-t-[#00c896] rounded-full animate-spin" />
            <p className="text-[12px]">Carregando perfis do AdsPower…</p>
          </div>
        )}

        {/* Error */}
        {connected && !loadingProfiles && profilesError && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <AlertCircle size={40} className="text-amber-500/60" />
            <div className="space-y-2">
              <p className="text-[#d0d0d8] text-sm font-medium">Erro ao conectar ao AdsPower</p>
              <p className="text-[#555560] text-[11px] max-w-md font-mono bg-[#111115] border border-[#1e1e24] rounded-lg px-4 py-2">
                {(profilesErr as Error)?.message || 'Erro desconhecido'}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => refetchProfiles()}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#222228] text-[#c0c0cc] hover:text-white hover:bg-[#1a1a20] text-[12px] transition"
              >
                <RefreshCw size={12} /> Tentar novamente
              </button>
              <button
                onClick={() => setShowSettings(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-[12px] font-semibold text-black transition"
                style={{ backgroundColor: '#00c896' }}
              >
                <Settings2 size={12} /> Verificar Config
              </button>
            </div>
          </div>
        )}

        {/* Empty */}
        {connected && !loadingProfiles && !profilesError && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-[#333340]">
            <p className="text-sm">
              {allProfiles.length === 0 ? 'Nenhum perfil encontrado.' : 'Nenhum perfil com os filtros aplicados.'}
            </p>
          </div>
        )}

        {/* Table */}
        {connected && !loadingProfiles && !profilesError && pageRows.length > 0 && (
          <table className="w-full text-[12px] border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-[#111115] border-b border-[#1a1a20] sticky top-0 z-10">
                {['', 'CONTA', 'RESP.', 'GESTOR', 'STATUS', 'SITUAÇÃO', 'GRUPO', 'ÚLTIMO ACESSO', ''].map((h, i) => (
                  <th key={i} className="px-3 py-2.5 text-left text-[10px] font-bold text-[#44444e] tracking-widest whitespace-nowrap select-none">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((profile, idx) => {
                const tags   = getProfileTags(profile);
                const pData  = getProfileData(profile.user_id);
                const access = formatAccess(profile.last_open_time);

                return (
                  <tr
                    key={profile.user_id}
                    className={`border-b border-[#141418] hover:bg-[#111115] transition-colors cursor-default
                      ${idx % 2 === 1 ? 'bg-[#0f0f12]' : 'bg-[#0c0c0e]'}`}
                  >
                    {/* serial */}
                    <td className="px-3 py-2.5 w-10 text-center text-[#333340] text-[10px] font-mono select-none">
                      {profile.serial_number}
                    </td>

                    {/* conta */}
                    <td className="px-3 py-2.5 min-w-[160px] max-w-[200px]">
                      <p className="font-semibold text-[#e8e8f0] leading-tight truncate">{profile.name || '—'}</p>
                      <p className="text-[10px] font-mono text-[#3a3a45] mt-0.5 truncate">{profile.user_id}</p>
                    </td>

                    {/* resp */}
                    <td className="px-3 py-2.5 w-14">
                      <InitialsBadge name={pData.responsavel} />
                    </td>

                    {/* gestor */}
                    <td className="px-3 py-2.5 w-14">
                      <InitialsBadge name={pData.gestor} />
                    </td>

                    {/* status = tags */}
                    <td className="px-3 py-2.5 min-w-[120px] max-w-[200px]">
                      {tags.length > 0
                        ? <div className="flex flex-wrap gap-1">
                            {tags.map(t => {
                              const s = TAG_SOLID[t.color] || TAG_SOLID.default;
                              return (
                                <span
                                  key={t.id}
                                  className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap"
                                  style={{ backgroundColor: s.bg, color: s.fg }}
                                >
                                  {t.name}
                                </span>
                              );
                            })}
                          </div>
                        : <span className="text-[#2a2a35]">—</span>
                      }
                    </td>

                    {/* situação */}
                    <td className="px-3 py-2.5 w-40">
                      <SituacaoBadge value={pData.situacao} />
                    </td>

                    {/* grupo */}
                    <td className="px-3 py-2.5 min-w-[120px]">
                      {profile.group_name
                        ? <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-[#1e1e2e] text-[#8080cc] border border-[#2a2a45] truncate max-w-full">
                            {profile.group_name}
                          </span>
                        : <span className="text-[#2a2a35]">—</span>
                      }
                    </td>

                    {/* último acesso */}
                    <td className="px-3 py-2.5 w-24 text-center">
                      <span className={`text-[11px] font-semibold ${access.cls || 'text-[#333340]'}`}>
                        {access.text}
                      </span>
                    </td>

                    {/* edit */}
                    <td className="px-3 py-2.5 w-10 text-center">
                      <button
                        onClick={() => setEditProfile(profile)}
                        className="w-6 h-6 inline-flex items-center justify-center rounded border border-[#1e1e24] text-[#333340] hover:text-[#00c896] hover:border-[#00c896]/30 hover:bg-[#00c896]/8 transition"
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="flex items-center justify-between px-4 py-2.5 border-t border-[#1a1a20] bg-[#0e0e11] shrink-0">
        <span className="text-[11px] text-[#3a3a45]">
          {connected && !profilesError ? `${filtered.length} conta${filtered.length !== 1 ? 's' : ''}` : ''}
        </span>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="flex items-center gap-1 px-2.5 py-1 rounded text-[11px] border border-[#1e1e24] text-[#555560] hover:text-white hover:bg-[#1a1a20] disabled:opacity-30 disabled:cursor-not-allowed transition"
            >
              <ChevronLeft size={12} /> Anterior
            </button>
            <span className="text-[11px] text-[#444450] min-w-[100px] text-center">
              {safePage} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className="flex items-center gap-1 px-2.5 py-1 rounded text-[11px] border border-[#1e1e24] text-[#555560] hover:text-white hover:bg-[#1a1a20] disabled:opacity-30 disabled:cursor-not-allowed transition"
            >
              Próximo <ChevronRight size={12} />
            </button>
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {showSettings && (
        <SettingsModal
          currentBase={baseUrl}
          initialConfig={config || null}
          onClose={() => setShowSettings(false)}
          onSave={(base, cfg) => saveConfigMut.mutate({ base, cfg })}
          saving={saveConfigMut.isPending}
        />
      )}
      {editProfile && (
        <EditDrawer
          profile={editProfile}
          data={getProfileData(editProfile.user_id)}
          onClose={() => setEditProfile(null)}
          onSave={(id, d) => saveMut.mutate({ profileId: id, data: d })}
          saving={saveMut.isPending}
        />
      )}
    </div>
  );
}
