import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adsPowerApi, getBaseUrl, saveBaseUrl } from '../api/adspower';
import type { AdsProfile, AdsGroup, ProfileData, AdsConfig } from '../api/adspower';
import { useToast } from './Toaster';
import { Film, RefreshCw, Settings2, Monitor, X, Plus, Wifi, WifiOff, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';

/* ── Helpers ──────────────────────────────────────────────────── */

function formatTime(ts?: string | number): { text: string; cls: string } {
  if (!ts || ts === '0') return { text: '—', cls: 'none' };
  const ms = String(ts).length === 10 ? Number(ts) * 1000 : Number(ts);
  if (!ms) return { text: '—', cls: 'none' };
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return { text: 'Agora', cls: 'recent' };
  if (mins < 60) return { text: `${mins}m`, cls: 'recent' };
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return { text: `${hrs}h`, cls: 'recent' };
  const days = Math.floor(hrs / 24);
  if (days <= 7) return { text: `${days}d`, cls: 'medium' };
  if (days <= 30) return { text: `${days}d`, cls: 'old' };
  return { text: new Date(ms).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), cls: 'ancient' };
}

function getProfileTags(profile: AdsProfile) {
  const raw = profile.fbcc_user_tag || [];
  if (!Array.isArray(raw)) return [];
  return raw.filter(Boolean).map(t => {
    if (typeof t === 'object' && t !== null) return { id: String(t.id), name: t.name, color: t.color || 'blue' };
    return { id: String(t), name: String(t), color: 'blue' };
  }).filter(t => t.name);
}

const CAMPAIGN_DATE_RE = /^[A-Za-z]+\d+\s*-\s*(\d{1,2})-(\d{1,2})/;

function calcDaysActive(campaigns: string[]): { start: Date; days: number } | null {
  if (!campaigns?.length) return null;
  const now = new Date();
  let earliest: Date | null = null;
  for (const name of campaigns) {
    const m = String(name).match(CAMPAIGN_DATE_RE);
    if (!m) continue;
    const day = parseInt(m[1]);
    const mon = parseInt(m[2]) - 1;
    let date = new Date(now.getFullYear(), mon, day);
    if (date > now) date = new Date(now.getFullYear() - 1, mon, day);
    if (!earliest || date < earliest) earliest = date;
  }
  if (!earliest) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  earliest.setHours(0, 0, 0, 0);
  return { start: earliest, days: Math.max(0, Math.floor((today.getTime() - earliest.getTime()) / 86400000)) };
}

const TAG_COLORS: Record<string, string> = {
  darkBlue:   'bg-blue-900/40 text-blue-300 border-blue-700/40',
  blue:       'bg-blue-500/15 text-blue-300 border-blue-500/25',
  purple:     'bg-purple-500/15 text-purple-300 border-purple-500/25',
  red:        'bg-red-500/15 text-red-400 border-red-500/25',
  yellow:     'bg-amber-500/15 text-amber-300 border-amber-500/25',
  orange:     'bg-orange-500/15 text-orange-300 border-orange-500/25',
  green:      'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  lightGreen: 'bg-green-400/15 text-green-300 border-green-400/25',
};

const STATUS_COLORS: Record<string, string> = {
  ativa:      'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  suspensa:   'bg-orange-500/15 text-orange-400 border-orange-500/25',
  em_revisao: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  banida:     'bg-red-500/15 text-red-400 border-red-500/25',
};

const STATUS_LABELS: Record<string, string> = {
  ativa: 'Ativa', suspensa: 'Suspensa', em_revisao: 'Em revisão', banida: 'Banida',
};

const PAGE_SIZE = 100;

/* ── ListEditor ───────────────────────────────────────────────── */

function ListEditor({ items, onChange, placeholder }: {
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
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

  const add = () => setVals(prev => [...prev, '']);

  return (
    <div className="flex flex-col gap-1.5">
      {vals.map((v, i) => (
        <div key={i} className="flex items-center gap-2 bg-[#1a1d2e] border border-[#2a2d3e] rounded-lg px-3 py-1.5 focus-within:border-indigo-500/50 transition">
          <input
            value={v}
            onChange={e => update(i, e.target.value)}
            placeholder={placeholder}
            className="flex-1 bg-transparent text-[12px] text-slate-200 font-mono outline-none placeholder:text-slate-600"
          />
          <button onClick={() => remove(i)} className="shrink-0 text-slate-600 hover:text-red-400 transition">
            <X size={12} />
          </button>
        </div>
      ))}
      <button
        onClick={add}
        className="flex items-center gap-1.5 px-3 py-1.5 border border-dashed border-[#2a2d3e] rounded-lg text-[11px] text-slate-500 hover:text-indigo-400 hover:border-indigo-500/40 hover:bg-indigo-500/5 transition"
      >
        <Plus size={11} /> Adicionar
      </button>
    </div>
  );
}

/* ── EditDrawer ───────────────────────────────────────────────── */

interface DrawerProps {
  profile: AdsProfile;
  data: ProfileData;
  onClose: () => void;
  onSave: (profileId: string, data: Omit<ProfileData, 'updatedAt'>) => void;
  saving: boolean;
}

function EditDrawer({ profile, data, onClose, onSave, saving }: DrawerProps) {
  const [status, setStatus] = useState(data.status || '');
  const [creatives, setCreatives] = useState<string[]>(data.creatives || []);
  const [campaigns, setCampaigns] = useState<string[]>(data.campaigns || []);
  const [notes, setNotes] = useState(data.notes || '');

  const handleSave = () => {
    onSave(profile.user_id, { status, creatives: creatives.filter(Boolean), campaigns: campaigns.filter(Boolean), notes: notes.trim() });
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div
        className="w-[500px] max-w-[95vw] h-full bg-[#0d0f1a] border-l border-[#1e2130] flex flex-col shadow-2xl"
        style={{ animation: 'slideInRight 0.22s cubic-bezier(0.16,1,0.3,1)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#1e2130] bg-[#161929] flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <p className="text-[14px] font-bold text-white truncate">{profile.name || '—'}</p>
            <p className="text-[10px] text-slate-500 font-mono mt-0.5">{profile.user_id}</p>
          </div>
          <button onClick={onClose} className="shrink-0 text-slate-500 hover:text-white transition mt-0.5">
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Status */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Status da Conta</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value)}
              className="w-full bg-[#1a1d2e] border border-[#2a2d3e] rounded-lg px-3 py-2.5 text-[12px] text-slate-200 outline-none focus:border-indigo-500/50 transition cursor-pointer"
            >
              <option value="">— Sem status —</option>
              <option value="ativa">Ativa</option>
              <option value="suspensa">Suspensa</option>
              <option value="em_revisao">Em revisão</option>
              <option value="banida">Banida</option>
            </select>
          </div>

          {/* Creatives */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Criativos</label>
            <ListEditor items={creatives} onChange={setCreatives} placeholder="Ex: MM2AD63-H1-NH3-VV3-COPY-RB" />
          </div>

          {/* Campaigns */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Campanhas</label>
            <ListEditor items={campaigns} onChange={setCampaigns} placeholder="Nome da campanha…" />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Observações</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={4}
              placeholder="Observações sobre a conta, histórico de suspensões…"
              className="w-full bg-[#1a1d2e] border border-[#2a2d3e] rounded-lg px-3 py-2.5 text-[12px] text-slate-200 outline-none focus:border-indigo-500/50 transition resize-none placeholder:text-slate-600"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#1e2130] bg-[#161929] flex items-center justify-end gap-2 shrink-0">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-[12px] text-slate-400 hover:text-white hover:bg-[#1e2130] transition">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 rounded-lg text-[12px] font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition disabled:opacity-50"
          >
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── SettingsModal ────────────────────────────────────────────── */

interface SettingsProps {
  currentBase: string;
  initialConfig: AdsConfig | null;
  onClose: () => void;
  onSave: (base: string, cfg: AdsConfig) => void;
  saving: boolean;
}

function SettingsModal({ currentBase, initialConfig, onClose, onSave, saving }: SettingsProps) {
  const [base, setBase] = useState(currentBase);
  const [port, setPort] = useState(String(initialConfig?.port || 50325));
  const [apiKey, setApiKey] = useState(initialConfig?.apiKey || '');

  const handleSave = () => onSave(base.trim() || 'http://localhost:3000', { port: Number(port) || 50325, apiKey: apiKey.trim() });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="w-[460px] max-w-[95vw] bg-[#0d0f1a] border border-[#1e2130] rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-[#1e2130] flex items-center justify-between">
          <p className="text-[14px] font-bold text-white">Configurações da API</p>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition"><X size={15} /></button>
        </div>
        <div className="p-6 space-y-5">
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-slate-300">URL do servidor local</label>
            <input
              value={base}
              onChange={e => setBase(e.target.value)}
              placeholder="http://localhost:3000"
              className="w-full bg-[#1a1d2e] border border-[#2a2d3e] rounded-lg px-3 py-2.5 text-[12px] text-slate-200 outline-none focus:border-indigo-500/50 transition"
            />
            <p className="text-[10px] text-slate-600">Endereço onde o servidor Wave Contas está rodando.</p>
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-slate-300">Porta do AdsPower</label>
            <input
              value={port}
              onChange={e => setPort(e.target.value)}
              type="number"
              placeholder="50325"
              className="w-full bg-[#1a1d2e] border border-[#2a2d3e] rounded-lg px-3 py-2.5 text-[12px] text-slate-200 outline-none focus:border-indigo-500/50 transition"
            />
            <p className="text-[10px] text-slate-600">Porta padrão do AdsPower Local API é 50325.</p>
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-slate-300">
              API Key <span className="text-[10px] font-normal text-slate-600 ml-1">opcional</span>
            </label>
            <input
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              type="password"
              placeholder="Deixe vazio se não ativou autenticação"
              className="w-full bg-[#1a1d2e] border border-[#2a2d3e] rounded-lg px-3 py-2.5 text-[12px] text-slate-200 outline-none focus:border-indigo-500/50 transition"
            />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-[#1e2130] bg-[#161929] flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-[12px] text-slate-400 hover:text-white hover:bg-[#1e2130] transition">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 rounded-lg text-[12px] font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition disabled:opacity-50"
          >
            {saving ? 'Salvando…' : 'Salvar e Conectar'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── AccountsPanel ────────────────────────────────────────────── */

interface Props {
  activeTab: 'criativos' | 'contas';
  onTabChange: (tab: 'criativos' | 'contas') => void;
}

export default function AccountsPanel({ activeTab, onTabChange }: Props) {
  const qc = useQueryClient();
  const toast = useToast();

  const [baseUrl, setBaseUrlState] = useState(getBaseUrl);
  const [showSettings, setShowSettings] = useState(false);
  const [editProfile, setEditProfile] = useState<AdsProfile | null>(null);

  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [creativesFilter, setCreativesFilter] = useState('');
  const [page, setPage] = useState(1);

  // Config
  const { data: config, isError: configError } = useQuery<AdsConfig>({
    queryKey: ['ads-config', baseUrl],
    queryFn: () => adsPowerApi.getConfig(baseUrl),
    retry: 1,
    staleTime: 30000,
  });

  const connected = !configError && config !== undefined;

  // Groups
  const { data: groupsData } = useQuery({
    queryKey: ['ads-groups', baseUrl],
    queryFn: () => adsPowerApi.getGroups(baseUrl),
    enabled: connected,
    retry: 1,
    staleTime: 30000,
  });
  const groups: AdsGroup[] = groupsData?.data?.list || [];

  // All profiles (auto-paginate AdsPower API)
  const {
    data: allProfiles = [],
    isLoading: loadingProfiles,
    isError: profilesError,
    error: profilesErrorObj,
    refetch: refetchProfiles,
  } = useQuery<AdsProfile[]>({
    queryKey: ['ads-profiles', baseUrl, groupFilter],
    queryFn: async () => {
      const ADS_PAGE = 200;
      let pg = 1;
      let all: AdsProfile[] = [];
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
    retry: false,
    staleTime: 60000,
  });

  // Per-profile data (status, creatives, campaigns, notes)
  const { data: profileDataMap = {} } = useQuery<Record<string, ProfileData>>({
    queryKey: ['ads-creatives', baseUrl],
    queryFn: () => adsPowerApi.getProfileData(baseUrl),
    enabled: connected,
    staleTime: 10000,
  });

  // Derive tags from profiles
  const allTags = useMemo(() => {
    const byId: Record<string, { id: string; name: string; color: string }> = {};
    allProfiles.forEach(p => getProfileTags(p).forEach(t => { byId[t.id] = t; }));
    return Object.values(byId).sort((a, b) => a.name.localeCompare(b.name));
  }, [allProfiles]);

  // Client-side filtering
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return allProfiles.filter(p => {
      if (q) {
        const hay = `${p.name} ${p.user_id} ${p.remark || ''} ${p.username || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (tagFilter) {
        if (!getProfileTags(p).map(t => t.id).includes(tagFilter)) return false;
      }
      if (statusFilter) {
        if ((profileDataMap[p.user_id]?.status || '') !== statusFilter) return false;
      }
      if (creativesFilter === 'with') {
        if (!profileDataMap[p.user_id]?.creatives?.length) return false;
      }
      if (creativesFilter === 'without') {
        if ((profileDataMap[p.user_id]?.creatives?.length || 0) > 0) return false;
      }
      return true;
    });
  }, [allProfiles, profileDataMap, search, tagFilter, statusFilter, creativesFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageProfiles = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Stats
  const statWithCreatives = Object.values(profileDataMap).filter(d => d.creatives?.length > 0).length;

  // Mutations
  const invalidateAll = () => {
    qc.refetchQueries({ queryKey: ['ads-config', baseUrl] });
    qc.refetchQueries({ queryKey: ['ads-groups', baseUrl] });
    qc.refetchQueries({ queryKey: ['ads-profiles', baseUrl] });
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
    onSuccess: (_data, vars) => {
      saveBaseUrl(vars.base);
      setBaseUrlState(vars.base);
      qc.clear();
      setShowSettings(false);
      toast.success('Configurações salvas');
      setTimeout(invalidateAll, 300);
    },
    onError: () => toast.error('Erro ao salvar configurações. Verifique se o servidor está rodando.'),
  });

  const handleSaveSettings = (base: string, cfg: AdsConfig) => {
    saveConfigMut.mutate({ base, cfg });
  };

  const handleSaveProfile = (profileId: string, data: Omit<ProfileData, 'updatedAt'>) => {
    saveMut.mutate({ profileId, data });
  };

  const getProfileData = (profileId: string): ProfileData =>
    profileDataMap[profileId] || { creatives: [], campaigns: [], notes: '', status: '' };

  const accessCls = { none: 'text-slate-600', recent: 'text-emerald-400', medium: 'text-amber-400', old: 'text-orange-400', ancient: 'text-red-400' };

  return (
    <div className="flex flex-col h-screen bg-[#0a0c14]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e2130] bg-[#0d0f1a] shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Film size={14} className="text-white" />
            </div>
            <span className="text-sm font-semibold text-white">Wave Dashboard</span>
          </div>
          {/* Tab nav */}
          <div className="flex items-center gap-0.5 border border-[#2a2d3e] rounded-lg p-0.5 bg-[#161929]">
            <button
              onClick={() => onTabChange('criativos')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium transition ${activeTab === 'criativos' ? 'bg-indigo-500/20 text-indigo-300' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <Film size={11} /> Criativos
            </button>
            <button
              onClick={() => onTabChange('contas')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium transition ${activeTab === 'contas' ? 'bg-blue-500/20 text-blue-300' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <Monitor size={11} /> Contas
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Connection badge */}
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide border ${connected ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
            {connected
              ? <><Wifi size={11} /> Conectado</>
              : <><WifiOff size={11} /> Desconectado</>
            }
          </div>
          <button
            onClick={invalidateAll}
            title="Atualizar dados"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] border border-[#2a2d3e] text-slate-400 hover:text-white hover:bg-[#1e2130] transition"
          >
            <RefreshCw size={13} /> Atualizar
          </button>
          <button
            onClick={() => setShowSettings(true)}
            title="Configurações da API"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] border border-[#2a2d3e] text-slate-400 hover:text-white hover:bg-[#1e2130] transition"
          >
            <Settings2 size={13} /> Config
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-4 border-b border-[#1e2130] bg-[#0d0f1a] shrink-0">
        {[
          { label: 'Perfis', value: allProfiles.length, color: 'text-indigo-400' },
          { label: 'Grupos', value: groups.length, color: 'text-purple-400' },
          { label: 'Tags', value: allTags.length, color: 'text-amber-400' },
          { label: 'Com criativos', value: statWithCreatives, color: 'text-emerald-400' },
        ].map((s, i) => (
          <div key={i} className="flex items-center gap-3 px-5 py-4 border-r border-[#1e2130] last:border-r-0">
            <div className="flex flex-col">
              <span className={`text-xl font-bold leading-none ${s.color}`}>{connected ? s.value : '—'}</span>
              <span className="text-[10px] text-slate-600 font-semibold uppercase tracking-wider mt-1">{s.label}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[#1e2130] bg-[#0d0f1a] shrink-0 flex-wrap">
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-600 mr-1">Filtrar</span>

        {/* Search */}
        <div className="relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Nome, ID ou remark…"
            className="bg-[#1a1d2e] border border-[#2a2d3e] rounded-lg pl-8 pr-3 py-1.5 text-[12px] text-slate-200 placeholder:text-slate-600 outline-none focus:border-indigo-500/50 transition w-52"
          />
        </div>

        <div className="w-px h-5 bg-[#2a2d3e]" />

        {/* Group filter */}
        <select
          value={groupFilter}
          onChange={e => { setGroupFilter(e.target.value); setPage(1); }}
          className="bg-[#1a1d2e] border border-[#2a2d3e] rounded-lg px-2.5 py-1.5 text-[12px] text-slate-300 outline-none focus:border-indigo-500/50 transition cursor-pointer"
        >
          <option value="">Todos os grupos</option>
          {groups.map(g => <option key={g.group_id} value={g.group_id}>{g.group_name}</option>)}
        </select>

        {/* Tag filter */}
        <select
          value={tagFilter}
          onChange={e => { setTagFilter(e.target.value); setPage(1); }}
          className="bg-[#1a1d2e] border border-[#2a2d3e] rounded-lg px-2.5 py-1.5 text-[12px] text-slate-300 outline-none focus:border-indigo-500/50 transition cursor-pointer"
        >
          <option value="">Todas as tags</option>
          {allTags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          className="bg-[#1a1d2e] border border-[#2a2d3e] rounded-lg px-2.5 py-1.5 text-[12px] text-slate-300 outline-none focus:border-indigo-500/50 transition cursor-pointer"
        >
          <option value="">Todos os status</option>
          <option value="ativa">Ativa</option>
          <option value="suspensa">Suspensa</option>
          <option value="em_revisao">Em revisão</option>
          <option value="banida">Banida</option>
        </select>

        {/* Creatives filter */}
        <select
          value={creativesFilter}
          onChange={e => { setCreativesFilter(e.target.value); setPage(1); }}
          className="bg-[#1a1d2e] border border-[#2a2d3e] rounded-lg px-2.5 py-1.5 text-[12px] text-slate-300 outline-none focus:border-indigo-500/50 transition cursor-pointer"
        >
          <option value="">Todos os criativos</option>
          <option value="with">Com criativos</option>
          <option value="without">Sem criativos</option>
        </select>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-auto p-4">
        {!connected && !loadingProfiles && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <WifiOff size={40} className="text-slate-700" />
            <p className="text-slate-500 text-sm max-w-sm leading-relaxed">
              Não foi possível conectar ao servidor Wave Contas.<br />
              Verifique se ele está rodando em <code className="text-slate-400 bg-[#161929] px-1 rounded">{baseUrl}</code>
            </p>
            <button
              onClick={() => setShowSettings(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[12px] font-medium transition"
            >
              <Settings2 size={13} /> Abrir Configurações
            </button>
          </div>
        )}

        {loadingProfiles && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-500">
            <div className="w-8 h-8 border-2 border-[#2a2d3e] border-t-indigo-500 rounded-full animate-spin" />
            <p className="text-[13px]">Carregando perfis do AdsPower…</p>
          </div>
        )}

        {connected && !loadingProfiles && profilesError && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <AlertCircle size={40} className="text-amber-500/70" />
            <div className="space-y-1.5">
              <p className="text-slate-300 text-sm font-medium">Erro ao conectar ao AdsPower</p>
              <p className="text-slate-500 text-[12px] max-w-md leading-relaxed font-mono bg-[#161929] border border-[#2a2d3e] rounded-lg px-4 py-2">
                {(profilesErrorObj as Error)?.message || 'Erro desconhecido'}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => refetchProfiles()}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#2a2d3e] text-slate-300 hover:text-white hover:bg-[#1e2130] text-[12px] transition"
              >
                <RefreshCw size={13} /> Tentar novamente
              </button>
              <button
                onClick={() => setShowSettings(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[12px] font-medium transition"
              >
                <Settings2 size={13} /> Verificar Config
              </button>
            </div>
          </div>
        )}

        {connected && !loadingProfiles && !profilesError && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-600">
            <Monitor size={36} />
            <p className="text-sm">{allProfiles.length === 0 ? 'Nenhum perfil encontrado no AdsPower.' : 'Nenhum perfil com os filtros aplicados.'}</p>
          </div>
        )}

        {connected && !loadingProfiles && !profilesError && pageProfiles.length > 0 && (
          <div className="bg-[#0d0f1a] border border-[#1e2130] rounded-xl overflow-hidden">
            <table className="w-full text-[12px] border-collapse">
              <thead>
                <tr className="bg-[#161929] border-b border-[#1e2130]">
                  {['#', 'Perfil', 'Grupo', 'Tags', 'Status', 'Criativos', 'Campanhas', 'Dias Ativo', 'Último Acesso', ''].map((h, i) => (
                    <th key={i} className="px-3 py-3 text-left text-[10px] font-bold text-slate-600 uppercase tracking-widest whitespace-nowrap select-none">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageProfiles.map((profile, rowIdx) => {
                  const tags = getProfileTags(profile);
                  const pData = getProfileData(profile.user_id);
                  const access = formatTime(profile.last_open_time);
                  const daysInfo = calcDaysActive(pData.campaigns);

                  return (
                    <tr
                      key={profile.user_id}
                      className={`border-b border-[#1e2130] last:border-b-0 hover:bg-[#161929] transition ${rowIdx % 2 === 1 ? 'bg-[#0f1120]' : ''}`}
                    >
                      {/* Serial */}
                      <td className="px-3 py-3 w-14 text-center">
                        <span className="text-[10px] font-mono text-slate-600 bg-[#161929] border border-[#2a2d3e] rounded px-1.5 py-0.5">
                          {profile.serial_number}
                        </span>
                      </td>

                      {/* Profile */}
                      <td className="px-3 py-3 min-w-[160px] max-w-[200px]">
                        <p className="font-semibold text-slate-200 leading-tight truncate">{profile.name || '—'}</p>
                        <p className="text-[10px] font-mono text-slate-600 mt-0.5">{profile.user_id}</p>
                      </td>

                      {/* Group */}
                      <td className="px-3 py-3 min-w-[120px]">
                        {profile.group_name
                          ? <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20 max-w-full truncate">{profile.group_name}</span>
                          : <span className="text-slate-700">—</span>
                        }
                      </td>

                      {/* Tags */}
                      <td className="px-3 py-3 min-w-[120px] max-w-[180px]">
                        {tags.length > 0
                          ? <div className="flex flex-wrap gap-1">
                              {tags.map(t => (
                                <span key={t.id} className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${TAG_COLORS[t.color] || TAG_COLORS.blue}`}>
                                  {t.name}
                                </span>
                              ))}
                            </div>
                          : <span className="text-slate-700">—</span>
                        }
                      </td>

                      {/* Status */}
                      <td className="px-3 py-3 w-28">
                        {pData.status
                          ? <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${STATUS_COLORS[pData.status] || ''}`}>
                              {STATUS_LABELS[pData.status] || pData.status}
                            </span>
                          : <span className="text-slate-700">—</span>
                        }
                      </td>

                      {/* Creatives */}
                      <td className="px-3 py-3 min-w-[160px] max-w-[200px]">
                        {pData.creatives?.length > 0
                          ? <div className="flex flex-col gap-1">
                              {pData.creatives.slice(0, 3).map((c, i) => (
                                <span key={i} className="block text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/15 rounded px-2 py-0.5 truncate" title={c}>{c}</span>
                              ))}
                              {pData.creatives.length > 3 && (
                                <span className="text-[10px] text-slate-600">+{pData.creatives.length - 3} mais</span>
                              )}
                            </div>
                          : <span className="text-slate-700">—</span>
                        }
                      </td>

                      {/* Campaigns */}
                      <td className="px-3 py-3 min-w-[150px] max-w-[190px]">
                        {pData.campaigns?.length > 0
                          ? <div className="flex flex-col gap-1">
                              {pData.campaigns.slice(0, 2).map((c, i) => (
                                <span key={i} className="block text-[10px] font-mono text-blue-400 bg-blue-500/10 border border-blue-500/15 rounded px-2 py-0.5 truncate" title={c}>{c}</span>
                              ))}
                              {pData.campaigns.length > 2 && (
                                <span className="text-[10px] text-slate-600">+{pData.campaigns.length - 2} mais</span>
                              )}
                            </div>
                          : <span className="text-slate-700">—</span>
                        }
                      </td>

                      {/* Days active */}
                      <td className="px-3 py-3 w-32">
                        {daysInfo
                          ? <div className="flex flex-col gap-1">
                              <span className="text-[10px] font-mono text-slate-600">
                                Início {String(daysInfo.start.getDate()).padStart(2,'0')}/{String(daysInfo.start.getMonth()+1).padStart(2,'0')}
                              </span>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border w-fit ${
                                daysInfo.days >= 7 ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25' :
                                daysInfo.days >= 4 ? 'bg-amber-500/15 text-amber-400 border-amber-500/25' :
                                daysInfo.days >= 1 ? 'bg-blue-500/15 text-blue-400 border-blue-500/25' :
                                'bg-[#1a1d2e] text-slate-500 border-[#2a2d3e]'
                              }`}>
                                {daysInfo.days >= 7 ? `★ ` : ''}{daysInfo.days === 0 ? 'Hoje' : daysInfo.days === 1 ? '1 dia' : `${daysInfo.days} dias`}
                              </span>
                            </div>
                          : <span className="text-slate-700">—</span>
                        }
                      </td>

                      {/* Last access */}
                      <td className="px-3 py-3 w-24 text-center">
                        <span className={`text-[11px] font-semibold ${accessCls[access.cls as keyof typeof accessCls] || 'text-slate-600'}`}>
                          {access.text}
                        </span>
                      </td>

                      {/* Edit */}
                      <td className="px-3 py-3 w-12 text-center">
                        <button
                          onClick={() => setEditProfile(profile)}
                          title="Editar perfil"
                          className="w-7 h-7 inline-flex items-center justify-center rounded border border-[#2a2d3e] text-slate-600 hover:text-indigo-400 hover:border-indigo-500/40 hover:bg-indigo-500/10 transition"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
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
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 py-3 border-t border-[#1e2130] bg-[#0d0f1a] shrink-0">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={safePage <= 1}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] border border-[#2a2d3e] text-slate-400 hover:text-white hover:bg-[#1e2130] disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            <ChevronLeft size={13} /> Anterior
          </button>
          <span className="text-[12px] text-slate-500 min-w-[140px] text-center">
            Página {safePage} de {totalPages} — {filtered.length} perfis
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={safePage >= totalPages}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] border border-[#2a2d3e] text-slate-400 hover:text-white hover:bg-[#1e2130] disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            Próximo <ChevronRight size={13} />
          </button>
        </div>
      )}

      {/* Modals */}
      {showSettings && (
        <SettingsModal
          currentBase={baseUrl}
          initialConfig={config || null}
          onClose={() => setShowSettings(false)}
          onSave={handleSaveSettings}
          saving={saveConfigMut.isPending}
        />
      )}

      {editProfile && (
        <EditDrawer
          profile={editProfile}
          data={getProfileData(editProfile.user_id)}
          onClose={() => setEditProfile(null)}
          onSave={handleSaveProfile}
          saving={saveMut.isPending}
        />
      )}
    </div>
  );
}
