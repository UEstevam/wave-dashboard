import { useState, useEffect } from 'react';
import { X, Link2, ExternalLink, Trash2, CheckCircle2 } from 'lucide-react';

interface Props {
  url: string;
  onClose: () => void;
  onSave: (url: string) => void;
}

// Normalise any Google Drive input to a canonical URL
function normalizeDriveInput(raw: string): { url: string; hint: string | null } {
  const s = raw.trim();
  if (!s) return { url: '', hint: null };

  // Already a full URL — return as-is
  if (/^https?:\/\//i.test(s)) {
    // Convert old ?id= format to /file/d/ID/view
    const idParam = s.match(/[?&]id=([a-zA-Z0-9_-]{20,})/);
    if (idParam) {
      const normalized = `https://drive.google.com/file/d/${idParam[1]}/view`;
      return { url: normalized, hint: `Convertido para: ${normalized}` };
    }
    return { url: s, hint: null };
  }

  // Bare file ID (25–44 chars, alphanumeric + _ + -)
  if (/^[a-zA-Z0-9_-]{25,44}$/.test(s)) {
    const normalized = `https://drive.google.com/file/d/${s}/view`;
    return { url: normalized, hint: `ID detectado → ${normalized}` };
  }

  // Folder ID pattern (same chars, typically longer)
  if (/^[a-zA-Z0-9_-]{15,}$/.test(s)) {
    const normalized = `https://drive.google.com/drive/folders/${s}`;
    return { url: normalized, hint: `ID de pasta detectado → ${normalized}` };
  }

  // Unrecognised — keep as typed but warn
  return { url: s, hint: null };
}

export default function DriveModal({ url, onClose, onSave }: Props) {
  const [draft, setDraft] = useState(url);
  const [normalized, setNormalized] = useState<{ url: string; hint: string | null }>({ url, hint: null });

  useEffect(() => {
    setNormalized(normalizeDriveInput(draft));
  }, [draft]);

  const resolvedUrl = normalized.url;
  const canSave = resolvedUrl !== '';
  const isHttp = /^https?:\/\//i.test(resolvedUrl);

  const handleSave = () => {
    onSave(resolvedUrl);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#1a1d2e] border border-[#2a2d3e] rounded-2xl w-full max-w-md shadow-2xl p-5" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center">
              <Link2 size={14} className="text-emerald-400" />
            </div>
            <h2 className="text-sm font-semibold text-white">Link do Drive</h2>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition"><X size={16} /></button>
        </div>

        {/* Input */}
        <div className="mb-3">
          <label className="text-[11px] text-slate-400 mb-1.5 block">
            Cole a URL, link de compartilhamento ou ID do arquivo
          </label>
          <input
            type="text"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && canSave) handleSave(); if (e.key === 'Escape') onClose(); }}
            placeholder="https://drive.google.com/file/d/...  ou  ID do arquivo"
            autoFocus
            className="w-full bg-[#0f1117] border border-[#2a2d3e] rounded-lg px-3 py-2 text-[13px] text-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition placeholder:text-slate-600 font-mono"
          />
        </div>

        {/* Normalisation hint */}
        {normalized.hint && (
          <div className="flex items-start gap-2 bg-indigo-500/10 border border-indigo-500/20 rounded-lg px-3 py-2 mb-3">
            <CheckCircle2 size={12} className="text-indigo-400 mt-0.5 shrink-0" />
            <span className="text-[11px] text-indigo-300 break-all">{normalized.hint}</span>
          </div>
        )}

        {/* Resolved URL preview + test */}
        {resolvedUrl && isHttp && (
          <div className="flex items-center gap-2 bg-[#0f1117] border border-[#2a2d3e] rounded-lg px-3 py-2 mb-4">
            <span className="flex-1 text-[11px] text-slate-400 truncate font-mono">{resolvedUrl}</span>
            <a
              href={resolvedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 transition"
              onClick={e => e.stopPropagation()}
            >
              <ExternalLink size={11} /> Testar
            </a>
          </div>
        )}

        {/* Accepted formats hint */}
        {!draft && (
          <div className="mb-4 space-y-1">
            {[
              'https://drive.google.com/file/d/ID/view',
              'https://drive.google.com/drive/folders/ID',
              'https://drive.google.com/open?id=ID',
              'Apenas o ID do arquivo (detectado automaticamente)',
            ].map(ex => (
              <p key={ex} className="text-[10px] text-slate-600 font-mono">{ex}</p>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between">
          {url && (
            <button
              onClick={() => { onSave(''); onClose(); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] text-red-400 hover:bg-red-500/10 transition"
            >
              <Trash2 size={12} /> Remover link
            </button>
          )}
          <div className="flex items-center gap-2 ml-auto">
            <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-[12px] text-slate-400 hover:text-white hover:bg-[#2a2d3e] transition">
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={!canSave}
              className="px-4 py-1.5 rounded-lg text-[12px] font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition disabled:opacity-40"
            >
              Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
