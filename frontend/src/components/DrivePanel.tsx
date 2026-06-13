import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { driveApi, optionsApi } from '../api/client';
import { X, RefreshCw, CheckCircle2, AlertTriangle, ExternalLink, ChevronDown, ChevronUp, Info } from 'lucide-react';

interface Props { onClose: () => void }

type SyncResult = { imported?: string[]; skipped?: string[]; error?: string; skipped_reason?: string };

export default function DrivePanel({ onClose }: Props) {
  const qc = useQueryClient();
  const [formInit, setFormInit] = useState(false);
  const [form, setForm] = useState({
    client_id: '', client_secret: '', folder_id: '',
    poll_interval_minutes: 15,
    auto_status: 'EM TESTE', auto_gestor: '', auto_oferta: '', auto_tipo: '',
  });
  const [showGuide, setShowGuide] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

  const { data: config, isLoading } = useQuery({ queryKey: ['drive-config'], queryFn: driveApi.getConfig });
  const { data: options } = useQuery({ queryKey: ['options'], queryFn: optionsApi.list });

  // Seed form from saved config on first load
  useEffect(() => {
    if (config && !formInit) {
      setForm(f => ({
        ...f,
        folder_id: config.folder_id || '',
        poll_interval_minutes: config.poll_interval_minutes || 15,
        auto_status: config.auto_status || 'EM TESTE',
        auto_gestor: config.auto_gestor || '',
        auto_oferta: config.auto_oferta || '',
        auto_tipo: config.auto_tipo || '',
      }));
      setFormInit(true);
    }
  }, [config, formInit]);

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const saveMut = useMutation({ mutationFn: driveApi.updateConfig, onSuccess: () => qc.invalidateQueries({ queryKey: ['drive-config'] }) });
  const disconnectMut = useMutation({
    mutationFn: driveApi.disconnect,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['drive-config'] }); setSyncResult(null); },
  });
  const syncMut = useMutation({
    mutationFn: driveApi.sync,
    onSuccess: (data: SyncResult) => {
      setSyncResult(data);
      qc.invalidateQueries({ queryKey: ['creatives'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
      qc.invalidateQueries({ queryKey: ['drive-config'] });
    },
    onError: (e: Error) => setSyncResult({ error: e.message }),
  });

  const openAuthUrl = async () => {
    const patch: Record<string, unknown> = {};
    if (form.client_id) patch.client_id = form.client_id;
    if (form.client_secret) patch.client_secret = form.client_secret;
    if (Object.keys(patch).length) await saveMut.mutateAsync(patch);
    const url = await driveApi.getAuthUrl();
    window.open(url, '_blank', 'width=500,height=600');
  };

  const saveSettings = () => {
    const patch: Record<string, unknown> = {
      poll_interval_minutes: form.poll_interval_minutes,
      auto_status: form.auto_status,
      auto_gestor: form.auto_gestor,
      auto_oferta: form.auto_oferta,
      auto_tipo: form.auto_tipo,
      enabled: true,
    };
    // Only update folder_id if the user actually filled it in
    if (form.folder_id.trim()) patch.folder_id = form.folder_id.trim();
    return saveMut.mutateAsync(patch);
  };

  const isConnected = config?.is_authenticated;
  const hasFolderSet = !!(form.folder_id.trim() || config?.folder_id);
  const lastSynced = config?.last_synced ? new Date(config.last_synced).toLocaleString('pt-BR') : null;

  const syncIsError = syncResult && (syncResult.error || syncResult.skipped_reason);

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="flex-1" />
      <div className="w-96 bg-[#161929] border-l border-[#2a2d3e] h-full flex flex-col shadow-2xl overflow-y-auto" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2d3e] sticky top-0 bg-[#161929] z-10">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: '#1a73e822' }}>
              <svg width="14" height="14" viewBox="0 0 87.3 78" fill="none">
                <path d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3L27.5 53h-21c0 1.55.4 3.1 1.1 4.5L6.6 66.85z" fill="#0066da"/>
                <path d="M43.65 25L29.9 1.4c-1.35.8-2.5 1.9-3.3 3.3L1.1 48.5A9.06 9.06 0 0 0 0 53h21L43.65 25z" fill="#00ac47"/>
                <path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3L78.95 70l4.25-7.35c.7-1.4 1.1-2.95 1.1-4.5h-21L73.55 76.8z" fill="#ea4335"/>
                <path d="M43.65 25L57.4 1.4C56.05.6 54.5.2 52.9.2H34.4c-1.6 0-3.15.4-4.5 1.2L43.65 25z" fill="#00832d"/>
                <path d="M63.3 53H21L6.6 66.85c1.35.8 2.9 1.15 4.5 1.15h65.1c1.6 0 3.15-.35 4.5-1.15L63.3 53z" fill="#2684fc"/>
                <path d="M73.4 26.5L58.7 4.7c-.8-1.4-1.95-2.5-3.3-3.3L43.65 25l19.65 28h20.95c0-1.55-.4-3.1-1.1-4.5L73.4 26.5z" fill="#ffba00"/>
              </svg>
            </div>
            <span className="text-sm font-semibold text-white">Google Drive Sync</span>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition"><X size={15} /></button>
        </div>

        <div className="flex-1 p-4 space-y-4">

          {/* Status card */}
          {!isLoading && (
            <div className={`rounded-xl p-3 border flex items-center gap-3 ${isConnected ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-[#1e2235] border-[#2a2d3e]'}`}>
              {isConnected
                ? <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                : <AlertTriangle size={16} className="text-slate-500 shrink-0" />
              }
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-medium text-white">
                  {isConnected ? 'Conectado ao Google Drive' : 'Não conectado'}
                </p>
                {lastSynced && <p className="text-[10px] text-slate-400">Última sync: {lastSynced}</p>}
                {config?.imported_count > 0 && <p className="text-[10px] text-slate-400">{config.imported_count} arquivos importados no total</p>}
              </div>
              {isConnected && (
                <button onClick={() => disconnectMut.mutate()} className="text-[11px] text-red-400 hover:text-red-300 transition shrink-0">
                  Desconectar
                </button>
              )}
            </div>
          )}

          {/* Missing folder warning */}
          {isConnected && !hasFolderSet && (
            <div className="rounded-xl p-3 border bg-amber-500/10 border-amber-500/20 flex items-center gap-2">
              <AlertTriangle size={13} className="text-amber-400 shrink-0" />
              <p className="text-[11px] text-amber-300">Pasta do Drive não configurada. Preencha o ID abaixo e salve.</p>
            </div>
          )}

          {/* Setup guide toggle */}
          <button
            onClick={() => setShowGuide(v => !v)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-[#1e2235] border border-[#2a2d3e] text-[12px] text-slate-300 hover:bg-[#252840] transition"
          >
            <span className="flex items-center gap-2"><Info size={13} className="text-indigo-400" /> Como configurar o Google Cloud</span>
            {showGuide ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>

          {showGuide && (
            <div className="bg-[#1e2235] border border-[#2a2d3e] rounded-xl p-3 space-y-3 text-[11px] text-slate-300">
              {[
                { n: '1', text: 'Acesse', link: 'https://console.cloud.google.com/', label: 'console.cloud.google.com' },
                { n: '2', text: 'Crie um novo projeto (ex: "Wave Dashboard")' },
                { n: '3', text: 'Vá em APIs & Services → Library → pesquise "Google Drive API" → Ativar' },
                { n: '4', text: 'Vá em APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID' },
                { n: '5', text: 'Tipo: Web Application. Em "Authorized redirect URIs" adicione:', code: config?.callback_url || 'http://localhost:3001/api/drive/callback' },
                { n: '6', text: 'Copie o Client ID e Client Secret e cole abaixo' },
              ].map(s => (
                <div key={s.n} className="flex gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-600/30 text-indigo-400 flex items-center justify-center text-[10px] font-bold shrink-0">{s.n}</span>
                  <div>
                    <span>{s.text} </span>
                    {s.link && <a href={s.link} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline inline-flex items-center gap-0.5">{s.label} <ExternalLink size={9} /></a>}
                    {s.code && <code className="block mt-1 bg-black/30 text-emerald-400 px-2 py-1 rounded font-mono text-[10px] select-all">{s.code}</code>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Credentials */}
          <div className="space-y-2">
            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Credenciais OAuth</p>
            {(['client_id', 'client_secret'] as const).map(k => (
              <div key={k}>
                <label className="text-[10px] text-slate-500 mb-1 block">{k === 'client_id' ? 'Client ID' : 'Client Secret'}</label>
                <input
                  type={k === 'client_secret' ? 'password' : 'text'}
                  value={form[k]}
                  onChange={e => set(k, e.target.value)}
                  placeholder={config?.has_credentials && !form[k] ? '••••••••••••••••' : `Cole o ${k === 'client_id' ? 'Client ID' : 'Client Secret'}...`}
                  className="w-full bg-[#0f1117] border border-[#2a2d3e] rounded-lg px-3 py-1.5 text-[12px] text-white outline-none focus:border-indigo-500 transition placeholder:text-slate-600 font-mono"
                />
              </div>
            ))}
            <button
              onClick={openAuthUrl}
              disabled={(!form.client_id || !form.client_secret) && !config?.has_credentials}
              className="w-full py-2 rounded-lg text-[12px] font-medium bg-[#1a73e8] hover:bg-[#1557b0] text-white transition disabled:opacity-40 flex items-center justify-center gap-2"
            >
              <ExternalLink size={13} /> {isConnected ? 'Re-autenticar com Google' : 'Autenticar com Google'}
            </button>
            {!isConnected && (
              <p className="text-[10px] text-slate-500 text-center">Uma janela do Google abrirá para você autorizar o acesso</p>
            )}
          </div>

          {/* Folder & Settings */}
          <div className="space-y-2">
            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Pasta do Drive</p>
            <div>
              <label className="text-[10px] text-slate-500 mb-1 block">
                ID da pasta <span className="text-amber-400">*obrigatório</span>
              </label>
              <input
                value={form.folder_id}
                onChange={e => set('folder_id', e.target.value)}
                placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUq..."
                className={`w-full bg-[#0f1117] border rounded-lg px-3 py-1.5 text-[12px] text-white outline-none focus:border-indigo-500 transition placeholder:text-slate-600 font-mono ${!form.folder_id.trim() ? 'border-amber-500/40' : 'border-[#2a2d3e]'}`}
              />
              <p className="text-[10px] text-slate-600 mt-1">
                Abra a pasta no Drive → URL: drive.google.com/drive/folders/<span className="text-indigo-400">ID_AQUI</span>
              </p>
            </div>
            <div>
              <label className="text-[10px] text-slate-500 mb-1 block">Verificar a cada (minutos)</label>
              <input
                type="number"
                min={5}
                value={form.poll_interval_minutes}
                onChange={e => set('poll_interval_minutes', parseInt(e.target.value) || 15)}
                className="w-full bg-[#0f1117] border border-[#2a2d3e] rounded-lg px-3 py-1.5 text-[12px] text-white outline-none focus:border-indigo-500 transition"
              />
            </div>
          </div>

          {/* Auto-fill defaults */}
          <div className="space-y-2">
            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Padrões para novos criativos</p>
            {(['auto_status', 'auto_gestor', 'auto_oferta', 'auto_tipo'] as const).map(k => {
              const cat = k.replace('auto_', '');
              const label = { auto_status: 'Status', auto_gestor: 'Gestor', auto_oferta: 'Oferta', auto_tipo: 'Tipo' }[k];
              return (
                <div key={k}>
                  <label className="text-[10px] text-slate-500 mb-1 block">{label} padrão</label>
                  <select
                    value={form[k]}
                    onChange={e => set(k, e.target.value)}
                    className="w-full bg-[#0f1117] border border-[#2a2d3e] rounded-lg px-3 py-1.5 text-[12px] text-white outline-none focus:border-indigo-500 transition cursor-pointer"
                  >
                    <option value="">— Nenhum —</option>
                    {options?.[cat]?.map((o: { value: string }) => <option key={o.value} value={o.value}>{o.value}</option>)}
                  </select>
                </div>
              );
            })}
          </div>

          {/* Save settings */}
          <button
            onClick={saveSettings}
            disabled={saveMut.isPending || !form.folder_id.trim()}
            className="w-full py-2 rounded-lg text-[12px] font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition disabled:opacity-40"
          >
            {saveMut.isPending ? 'Salvando...' : 'Salvar configurações'}
          </button>
          {!form.folder_id.trim() && (
            <p className="text-[10px] text-amber-400/70 text-center -mt-2">Preencha o ID da pasta para salvar</p>
          )}

          {/* Sync now */}
          {isConnected && (
            <div className="border-t border-[#2a2d3e] pt-4 space-y-3">
              <button
                onClick={() => { setSyncResult(null); syncMut.mutate(); }}
                disabled={syncMut.isPending || !hasFolderSet}
                title={!hasFolderSet ? 'Configure o ID da pasta primeiro' : undefined}
                className="w-full py-2 rounded-lg text-[12px] font-medium border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <RefreshCw size={13} className={syncMut.isPending ? 'animate-spin' : ''} />
                {syncMut.isPending ? 'Sincronizando...' : 'Sincronizar agora'}
              </button>

              {/* Sync result */}
              {syncResult && (
                <div className={`rounded-xl p-3 border text-[11px] space-y-1 ${syncIsError ? 'bg-red-500/10 border-red-500/20' : 'bg-emerald-500/10 border-emerald-500/20'}`}>
                  {syncIsError ? (
                    <p className="text-red-300">{syncResult.error || syncResult.skipped_reason}</p>
                  ) : (
                    <>
                      <p className="text-emerald-300 font-medium">
                        {syncResult.imported?.length ?? 0} arquivo(s) importado(s)
                      </p>
                      {(syncResult.imported?.length ?? 0) === 0 && (
                        <p className="text-slate-400">Nenhum arquivo novo encontrado na pasta.</p>
                      )}
                      {(syncResult.imported?.length ?? 0) > 0 && (
                        <ul className="text-slate-400 space-y-0.5 max-h-32 overflow-y-auto">
                          {syncResult.imported!.map(name => <li key={name} className="truncate">+ {name}</li>)}
                        </ul>
                      )}
                      {(syncResult.skipped?.length ?? 0) > 0 && (
                        <p className="text-slate-500">{syncResult.skipped!.length} já existentes / ignorados</p>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
