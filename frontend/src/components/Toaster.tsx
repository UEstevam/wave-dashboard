import { createContext, useContext, useState, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import { X, CheckCircle2, XCircle, Info, AlertTriangle } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface Toast { id: number; message: string; type: ToastType }
interface ConfirmState { message: string; resolve: (v: boolean) => void }

interface ToastCtx {
  success: (msg: string) => void;
  error:   (msg: string) => void;
  info:    (msg: string) => void;
  confirm: (msg: string) => Promise<boolean>;
}

const Ctx = createContext<ToastCtx>({
  success: () => {}, error: () => {}, info: () => {}, confirm: async () => false,
});

export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts]       = useState<Toast[]>([]);
  const [confirmState, setConfirm] = useState<ConfirmState | null>(null);
  const nextId = useRef(0);

  const addToast = useCallback((message: string, type: ToastType) => {
    const id = ++nextId.current;
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), type === 'error' ? 5000 : 3000);
  }, []);

  const confirm = useCallback((message: string): Promise<boolean> =>
    new Promise(resolve => setConfirm({ message, resolve })), []);

  const resolve = (result: boolean) => { confirmState?.resolve(result); setConfirm(null); };

  const ICON = {
    success: <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />,
    error:   <XCircle      size={14} className="text-red-400    shrink-0" />,
    info:    <Info         size={14} className="text-indigo-400 shrink-0" />,
  };
  const BORDER = { success: 'border-emerald-500/20', error: 'border-red-500/20', info: 'border-indigo-500/20' };

  return (
    <Ctx.Provider value={{ success: m => addToast(m, 'success'), error: m => addToast(m, 'error'), info: m => addToast(m, 'info'), confirm }}>
      {children}

      {/* ── Confirm dialog ── */}
      {confirmState && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#0d0f1a] border border-[#1e2235] rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-start gap-3 mb-5">
              <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
              <p className="text-[13px] text-slate-200 leading-relaxed">{confirmState.message}</p>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => resolve(false)}
                className="px-4 py-2 rounded-lg text-[12px] text-slate-400 hover:text-white hover:bg-white/5 transition">
                Cancelar
              </button>
              <button onClick={() => resolve(true)}
                className="px-4 py-2 rounded-lg text-[12px] font-semibold bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/25 transition">
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast stack ── */}
      <div className="fixed bottom-4 right-4 z-[99] flex flex-col gap-2 pointer-events-none" role="alert" aria-live="polite">
        {toasts.map(t => (
          <div key={t.id}
            className={`pointer-events-auto flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-[#111424] border ${BORDER[t.type]} shadow-xl text-[12px] text-slate-200 max-w-xs toast-in`}>
            {ICON[t.type]}
            <span className="flex-1 leading-snug">{t.message}</span>
            <button onClick={() => setToasts(p => p.filter(x => x.id !== t.id))}
              className="text-slate-600 hover:text-slate-300 transition ml-1">
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
