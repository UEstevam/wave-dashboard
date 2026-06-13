import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { youtubeApi } from '../api/client';
import type { Creative } from '../types';
import { X, Upload, ExternalLink, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

interface Props {
  creative: Creative;
  onClose: () => void;
}

interface Channel {
  id: string; title: string; label: string;
  thumbnail: string; accountEmail: string;
}

const PRIVACY_OPTIONS = [
  { value: 'private',  label: 'Privado',      desc: 'Só você' },
  { value: 'unlisted', label: 'Não listado',  desc: 'Com o link' },
  { value: 'public',   label: 'Público',       desc: 'Para todos' },
];

type Status = 'idle' | 'pending' | 'downloading' | 'uploading' | 'done' | 'error';

export default function UploadModal({ creative, onClose }: Props) {
  const { data: config } = useQuery({ queryKey: ['youtube-config'], queryFn: youtubeApi.getConfig });

  const allChannels: Channel[] = config?.all_channels || [];
  const defaultTitle = creative.criativo.replace(/\.[^.]+$/, '');

  const [title, setTitle] = useState(defaultTitle);
  const [description, setDescription] = useState('');
  const [privacy, setPrivacy] = useState('private');
  const [channelId, setChannelId] = useState('');
  const [categoryId, setCategoryId] = useState('22');
  const [jobId, setJobId] = useState<string | null>(null);

  useEffect(() => {
    if (config && allChannels.length > 0 && !channelId) {
      setPrivacy(config.default_privacy || 'private');
      setCategoryId(config.default_category_id || '22');
      setChannelId(allChannels[0].id);
    }
  }, [config]);

  const { data: job } = useQuery({
    queryKey: ['upload-job', jobId],
    queryFn: () => youtubeApi.getJobStatus(jobId!),
    enabled: !!jobId,
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      return s && s !== 'done' && s !== 'error' ? 800 : false;
    },
  });

  const uploadMut = useMutation({
    mutationFn: () => youtubeApi.upload({
      creativeId: creative.id,
      title: title.trim() || defaultTitle,
      description,
      privacyStatus: privacy,
      channelId,
      categoryId,
    }),
    onSuccess: (data) => setJobId(data.jobId),
  });

  const status: Status = uploadMut.isPending ? 'pending' : (job?.status || 'idle');
  const isInProgress = ['pending', 'downloading', 'uploading'].includes(status);
  const isDone = status === 'done';
  const isError = status === 'error';

  const statusLabels: Record<string, string> = {
    pending: 'Iniciando...',
    downloading: 'Baixando arquivo do Drive...',
    uploading: 'Enviando para o YouTube...',
  };

  const canUpload = !!creative.link_drive && !!channelId && allChannels.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-[480px] bg-[#161929] border border-[#2a2d3e] rounded-2xl shadow-2xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2d3e]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-red-600/20 flex items-center justify-center">
              <svg viewBox="0 90 580 400" width="14" height="10" fill="#ef4444">
                <path d="M549.7 124.1c-6.3-23.7-24.8-42.3-48.3-48.6C458.8 64 288 64 288 64S117.2 64 74.6 75.5c-23.5 6.3-42 24.9-48.3 48.6-11.4 42.9-11.4 132.3-11.4 132.3s0 89.4 11.4 132.3c6.3 23.7 24.8 41.5 48.3 47.8C117.2 448 288 448 288 448s170.8 0 213.4-11.5c23.5-6.3 42-24.2 48.3-47.8 11.4-42.9 11.4-132.3 11.4-132.3s0-89.4-11.4-132.3zm-317.5 213.5V162.4l142.7 87.6-142.7 87.6z"/>
              </svg>
            </div>
            <div>
              <p className="text-[13px] font-semibold text-white">Upload para o YouTube</p>
              <p className="text-[10px] text-slate-500 truncate max-w-[300px]">{creative.criativo}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition"><X size={15} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* Warnings */}
          {!creative.link_drive && (
            <div className="rounded-xl p-3 bg-amber-500/10 border border-amber-500/20 flex items-center gap-2">
              <AlertCircle size={13} className="text-amber-400 shrink-0" />
              <p className="text-[11px] text-amber-300">Criativo sem link do Drive. Vincule o arquivo antes de fazer upload.</p>
            </div>
          )}
          {allChannels.length === 0 && (
            <div className="rounded-xl p-3 bg-[#1e2235] border border-[#2a2d3e] flex items-center gap-2">
              <AlertCircle size={13} className="text-slate-500 shrink-0" />
              <p className="text-[11px] text-slate-400">Nenhum canal vinculado. Configure o YouTube no painel lateral.</p>
            </div>
          )}
          {creative.youtube_url && !isDone && (
            <div className="rounded-xl p-3 bg-red-500/10 border border-red-500/20 flex items-center justify-between">
              <p className="text-[11px] text-slate-300">Já enviado anteriormente</p>
              <a href={creative.youtube_url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-red-400 hover:text-red-300 flex items-center gap-1">
                Ver <ExternalLink size={10} />
              </a>
            </div>
          )}

          {!isDone && !isError && (
            <>
              {/* Channel selector */}
              {allChannels.length > 0 && (
                <div>
                  <label className="text-[11px] text-slate-400 font-medium mb-1 block">Canal de destino</label>
                  <select
                    value={channelId}
                    onChange={e => setChannelId(e.target.value)}
                    disabled={isInProgress}
                    className="w-full bg-[#0f1117] border border-[#2a2d3e] rounded-lg px-3 py-2 text-[12px] text-white outline-none focus:border-red-500 transition cursor-pointer disabled:opacity-50"
                  >
                    {allChannels.map(ch => (
                      <option key={ch.id} value={ch.id}>
                        {ch.label} — {ch.title} ({ch.accountEmail})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Title */}
              <div>
                <label className="text-[11px] text-slate-400 font-medium mb-1 block">Título</label>
                <input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  disabled={isInProgress}
                  maxLength={100}
                  className="w-full bg-[#0f1117] border border-[#2a2d3e] rounded-lg px-3 py-2 text-[12px] text-white outline-none focus:border-red-500 transition disabled:opacity-50"
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-[11px] text-slate-400 font-medium mb-1 block">
                  Descrição <span className="text-slate-600 font-normal">(opcional)</span>
                </label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  disabled={isInProgress}
                  rows={3}
                  placeholder="Descrição do vídeo..."
                  className="w-full bg-[#0f1117] border border-[#2a2d3e] rounded-lg px-3 py-2 text-[12px] text-white outline-none focus:border-red-500 transition resize-none disabled:opacity-50 placeholder:text-slate-600"
                />
              </div>

              {/* Privacy */}
              <div>
                <label className="text-[11px] text-slate-400 font-medium mb-1.5 block">Privacidade</label>
                <div className="grid grid-cols-3 gap-2">
                  {PRIVACY_OPTIONS.map(opt => (
                    <label key={opt.value} className={`flex flex-col gap-0.5 p-2.5 rounded-lg border cursor-pointer transition ${privacy === opt.value ? 'bg-red-500/10 border-red-500/30' : 'bg-[#1e2235] border-[#2a2d3e] hover:border-red-500/20'}`}>
                      <input type="radio" name="privacy" value={opt.value} checked={privacy === opt.value} onChange={() => setPrivacy(opt.value)} disabled={isInProgress} className="hidden" />
                      <span className="text-[12px] font-medium text-white">{opt.label}</span>
                      <span className="text-[10px] text-slate-500">{opt.desc}</span>
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Progress */}
          {isInProgress && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Loader2 size={13} className="text-red-400 animate-spin shrink-0" />
                <p className="text-[12px] text-slate-300">{statusLabels[status]}</p>
              </div>
              {status === 'uploading' && (
                <div className="space-y-1">
                  <div className="w-full bg-[#1e2235] rounded-full h-2 overflow-hidden">
                    <div className="h-2 bg-red-500 rounded-full transition-all duration-500" style={{ width: `${job?.progress || 0}%` }} />
                  </div>
                  <p className="text-[10px] text-slate-500 text-right">{job?.progress || 0}%</p>
                </div>
              )}
            </div>
          )}

          {/* Success */}
          {isDone && job?.youtube_url && (
            <div className="rounded-xl p-4 bg-red-500/10 border border-red-500/20 space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-red-400" />
                <p className="text-[13px] font-semibold text-white">Upload concluído!</p>
              </div>
              <a href={job.youtube_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-[12px] font-medium transition">
                <ExternalLink size={13} /> Abrir no YouTube
              </a>
            </div>
          )}

          {/* Error */}
          {isError && (
            <div className="rounded-xl p-3 bg-red-500/10 border border-red-500/20 flex items-start gap-2">
              <AlertCircle size={13} className="text-red-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-red-300">{job?.error || (uploadMut.error as Error)?.message || 'Erro desconhecido'}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-[#2a2d3e] flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-[12px] text-slate-400 hover:text-white hover:bg-[#1e2235] transition">
            {isDone ? 'Fechar' : 'Cancelar'}
          </button>
          {!isDone && !isError && (
            <button
              onClick={() => uploadMut.mutate()}
              disabled={isInProgress || !canUpload}
              title={!canUpload ? (!creative.link_drive ? 'Sem link do Drive' : 'Configure canais no painel YouTube') : undefined}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-[12px] font-medium transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Upload size={13} /> {isInProgress ? 'Enviando...' : 'Fazer Upload'}
            </button>
          )}
          {isError && (
            <button onClick={() => { setJobId(null); uploadMut.reset(); }}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-[12px] font-medium transition">
              Tentar novamente
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
