import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { youtubeApi, driveApi } from '../api/client';
import { X, ExternalLink, CheckCircle2, AlertTriangle, RefreshCw, ChevronDown, ChevronUp, Info, Plus, Trash2 } from 'lucide-react';
import YtIcon from './YtIcon';

interface Props { onClose: () => void }

interface YtChannel {
  id: string; title: string; thumbnail: string;
  subscribers: string; custom_url: string;
  label: string; accountId: string; accountEmail: string;
}

interface YtAccount {
  id: string; email: string;
  upload_count: number;
  channels: YtChannel[];
}

const CATEGORIES = [
  { id: '22', label: 'Pessoas e Blogs' },
  { id: '24', label: 'Entretenimento' },
  { id: '27', label: 'Educação' },
  { id: '28', label: 'Ciência e Tecnologia' },
  { id: '2',  label: 'Automóveis' },
  { id: '1',  label: 'Filmes e Animação' },
  { id: '26', label: 'Como Fazer' },
];

export default function YouTubePanel({ onClose }: Props) {
  const qc = useQueryClient();
  const [showGuide, setShowGuide] = useState(false);
  const [credForm, setCredForm] = useState({ client_id: '', client_secret: '' });
  const [defaults, setDefaults] = useState({ default_privacy: 'private', default_category_id: '22' });
  const [formInit, setFormInit] = useState(false);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

  const { data: config, isLoading } = useQuery({ queryKey: ['youtube-config'], queryFn: youtubeApi.getConfig });
  const { data: driveConfig } = useQuery({ queryKey: ['drive-config'], queryFn: driveApi.getConfig });

  useEffect(() => {
    if (config && !formInit) {
      setDefaults({ default_privacy: config.default_privacy || 'private', default_category_id: config.default_category_id || '22' });
      setFormInit(true);
    }
  }, [config, formInit]);

  const saveMut = useMutation({ mutationFn: youtubeApi.updateConfig, onSuccess: () => qc.invalidateQueries({ queryKey: ['youtube-config'] }) });
  const removeMut = useMutation({ mutationFn: youtubeApi.removeAccount, onSuccess: () => qc.invalidateQueries({ queryKey: ['youtube-config'] }) });

  // Opens OAuth popup and refreshes config when done (via postMessage or poll)
  const openAuthPopup = (url: string) => {
    const popup = window.open(url, '_blank', 'width=520,height=640');
    const refresh = () => qc.invalidateQueries({ queryKey: ['youtube-config'] });

    const onMessage = (e: MessageEvent) => {
      if (e.data === 'youtube-auth-done') {
        window.removeEventListener('message', onMessage);
        clearInterval(pollTimer);
        setTimeout(refresh, 600);
      }
    };
    window.addEventListener('message', onMessage);

    // Fallback: detect popup closure by polling
    const pollTimer = setInterval(() => {
      if (popup?.closed) {
        clearInterval(pollTimer);
        window.removeEventListener('message', onMessage);
        refresh();
      }
    }, 600);
  };

  const addAccount = async () => {
    const patch: Record<string, string> = {};
    if (credForm.client_id) patch.client_id = credForm.client_id;
    if (credForm.client_secret) patch.client_secret = credForm.client_secret;
    if (Object.keys(patch).length) await saveMut.mutateAsync(patch);
    const url = await youtubeApi.getAuthUrl('new');
    openAuthPopup(url);
  };

  const reAuthAccount = async (accountId: string) => {
    const url = await youtubeApi.getAuthUrl(accountId);
    openAuthPopup(url);
  };

  const refreshAccount = async (accountId: string) => {
    setRefreshingId(accountId);
    try {
      await youtubeApi.refreshAccount(accountId);
      qc.invalidateQueries({ queryKey: ['youtube-config'] });
    } finally {
      setRefreshingId(null);
    }
  };

  const saveDefaults = () => saveMut.mutateAsync(defaults);

  const accounts: YtAccount[] = config?.accounts || [];
  const totalChannels = accounts.reduce((s: number, a: YtAccount) => s + a.channels.length, 0);

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="flex-1" />
      <div className="w-[400px] bg-[#161929] border-l border-[#2a2d3e] h-full flex flex-col shadow-2xl overflow-y-auto" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2d3e] sticky top-0 bg-[#161929] z-10">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-red-600/20">
              <YtIcon size={14} className="text-red-400" />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-white">YouTube Upload</p>
              {totalChannels > 0 && <p className="text-[10px] text-slate-500">{totalChannels} canal(is) em {accounts.length} conta(s)</p>}
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition"><X size={15} /></button>
        </div>

        <div className="flex-1 p-4 space-y-5">

          {/* Setup guide */}
          <button
            onClick={() => setShowGuide(v => !v)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-[#1e2235] border border-[#2a2d3e] text-[12px] text-slate-300 hover:bg-[#252840] transition"
          >
            <span className="flex items-center gap-2"><Info size={13} className="text-red-400" /> Como configurar</span>
            {showGuide ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>

          {showGuide && (
            <div className="bg-[#1e2235] border border-[#2a2d3e] rounded-xl p-3 space-y-3 text-[11px] text-slate-300">
              {[
                { n: '1', text: 'No Google Cloud Console, ative a "YouTube Data API v3"' },
                { n: '2', text: 'Nas credenciais OAuth 2.0, adicione este URI:', code: `${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/youtube/callback` },
                { n: '3', text: 'Cole o Client ID e Secret abaixo (pode ser o mesmo do Drive)' },
                { n: '4', text: 'Clique "Adicionar Conta Google" — uma janela abrirá pedindo qual Gmail usar' },
                { n: '5', text: 'Repita o passo 4 para cada Gmail diferente que quiser vincular' },
              ].map(s => (
                <div key={s.n} className="flex gap-2">
                  <span className="w-5 h-5 rounded-full bg-red-600/20 text-red-400 flex items-center justify-center text-[10px] font-bold shrink-0">{s.n}</span>
                  <div>
                    <span>{s.text}</span>
                    {s.code && <code className="block mt-1 bg-black/30 text-emerald-400 px-2 py-1 rounded font-mono text-[10px] select-all">{s.code}</code>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Credentials */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Credenciais OAuth</p>
              {driveConfig?.has_credentials && (
                <button
                  onClick={() => setCredForm({ client_id: driveConfig.client_id || '', client_secret: '' })}
                  className="text-[10px] text-indigo-400 hover:text-indigo-300 transition"
                >
                  Copiar Client ID do Drive
                </button>
              )}
            </div>
            <div>
              <label className="text-[10px] text-slate-500 mb-1 block">Client ID</label>
              <input
                type="text"
                value={credForm.client_id}
                onChange={e => setCredForm(f => ({ ...f, client_id: e.target.value }))}
                placeholder={config?.has_credentials ? '••••• (já configurado)' : 'Cole o Client ID...'}
                className="w-full bg-[#0f1117] border border-[#2a2d3e] rounded-lg px-3 py-1.5 text-[12px] text-white outline-none focus:border-red-500 transition placeholder:text-slate-600 font-mono"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 mb-1 block">Client Secret</label>
              <input
                type="password"
                value={credForm.client_secret}
                onChange={e => setCredForm(f => ({ ...f, client_secret: e.target.value }))}
                placeholder={config?.has_credentials ? '••••• (já configurado)' : 'Cole o Client Secret...'}
                className="w-full bg-[#0f1117] border border-[#2a2d3e] rounded-lg px-3 py-1.5 text-[12px] text-white outline-none focus:border-red-500 transition placeholder:text-slate-600 font-mono"
              />
            </div>
          </div>

          {/* Add account button */}
          <button
            onClick={addAccount}
            disabled={(!credForm.client_id || !credForm.client_secret) && !config?.has_credentials}
            className="w-full py-2.5 rounded-xl text-[12px] font-medium bg-red-600 hover:bg-red-500 text-white transition disabled:opacity-40 flex items-center justify-center gap-2"
          >
            <Plus size={13} /> Adicionar Conta Google
          </button>
          <p className="text-[10px] text-slate-500 text-center -mt-3">
            Uma janela do Google abrirá. Escolha qual Gmail vincular.
          </p>

          {/* Accounts list */}
          {!isLoading && accounts.length > 0 && (
            <div className="space-y-3">
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Contas Vinculadas</p>
              {accounts.map((account) => (
                <div key={account.id} className="bg-[#1e2235] border border-[#2a2d3e] rounded-xl overflow-hidden">
                  {/* Account header */}
                  <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#2a2d3e]">
                    <div className="flex items-center gap-2 min-w-0">
                      <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />
                      <p className="text-[12px] text-white font-medium truncate">{account.email}</p>
                      <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/20">
                        {account.upload_count} upload{account.upload_count !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => refreshAccount(account.id)}
                        disabled={refreshingId === account.id}
                        title="Atualizar canais"
                        className="p-1 rounded text-slate-500 hover:text-white transition"
                      >
                        <RefreshCw size={11} className={refreshingId === account.id ? 'animate-spin' : ''} />
                      </button>
                      <button
                        onClick={() => reAuthAccount(account.id)}
                        title="Re-autenticar"
                        className="p-1 rounded text-slate-500 hover:text-indigo-400 transition"
                      >
                        <ExternalLink size={11} />
                      </button>
                      <button
                        onClick={() => removeMut.mutate(account.id)}
                        title="Remover conta"
                        className="p-1 rounded text-slate-500 hover:text-red-400 transition"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>

                  {/* Channels */}
                  {account.channels.length === 0 ? (
                    <p className="text-[11px] text-slate-500 px-3 py-2">Nenhum canal encontrado — clique em atualizar.</p>
                  ) : (
                    <div className="divide-y divide-[#2a2d3e]">
                      {account.channels.map((ch) => (
                        <div key={ch.id} className="flex items-center gap-2.5 px-3 py-2">
                          <span className="text-[10px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 rounded px-1.5 py-0.5 shrink-0 font-mono">{ch.label}</span>
                          {ch.thumbnail && <img src={ch.thumbnail} alt="" className="w-6 h-6 rounded-full shrink-0" />}
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] text-white truncate">{ch.title}</p>
                            {ch.custom_url && <p className="text-[10px] text-slate-500 truncate">{ch.custom_url}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {!isLoading && accounts.length === 0 && (
            <div className="rounded-xl p-4 bg-[#1e2235] border border-[#2a2d3e] flex items-center gap-3">
              <AlertTriangle size={14} className="text-slate-500 shrink-0" />
              <p className="text-[11px] text-slate-400">Nenhuma conta vinculada. Adicione uma conta Google acima.</p>
            </div>
          )}

          {/* Upload defaults */}
          {accounts.length > 0 && (
            <div className="space-y-2 border-t border-[#2a2d3e] pt-4">
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Padrões de Upload</p>
              <div>
                <label className="text-[10px] text-slate-500 mb-1 block">Privacidade padrão</label>
                <select
                  value={defaults.default_privacy}
                  onChange={e => setDefaults(d => ({ ...d, default_privacy: e.target.value }))}
                  className="w-full bg-[#0f1117] border border-[#2a2d3e] rounded-lg px-3 py-1.5 text-[12px] text-white outline-none focus:border-red-500 transition cursor-pointer"
                >
                  <option value="private">Privado</option>
                  <option value="unlisted">Não listado</option>
                  <option value="public">Público</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-slate-500 mb-1 block">Categoria padrão</label>
                <select
                  value={defaults.default_category_id}
                  onChange={e => setDefaults(d => ({ ...d, default_category_id: e.target.value }))}
                  className="w-full bg-[#0f1117] border border-[#2a2d3e] rounded-lg px-3 py-1.5 text-[12px] text-white outline-none focus:border-red-500 transition cursor-pointer"
                >
                  {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
              <button
                onClick={saveDefaults}
                disabled={saveMut.isPending}
                className="w-full py-2 rounded-lg text-[12px] font-medium bg-red-600/80 hover:bg-red-600 text-white transition disabled:opacity-40"
              >
                {saveMut.isPending ? 'Salvando...' : 'Salvar padrões'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
