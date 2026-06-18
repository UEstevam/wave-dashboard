import { Film, AlertCircle, Clock } from 'lucide-react';
import { authApi } from '../api/client';

export default function LoginPage() {
  const params = new URLSearchParams(window.location.search);
  const status = params.get('status');
  const error = params.get('error');

  return (
    <div className="min-h-screen bg-[#0a0c14] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center">
            <Film size={20} className="text-white" />
          </div>
          <div>
            <div className="text-white font-bold text-xl leading-none">Wave Dashboard</div>
            <div className="text-slate-500 text-xs mt-0.5">Gestão de Criativos</div>
          </div>
        </div>

        {/* Card */}
        <div className="bg-[#111424] border border-[#1e2235] rounded-2xl p-8">
          {status === 'pending' ? (
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
                <Clock size={26} className="text-amber-400" />
              </div>
              <h2 className="text-white font-semibold text-lg mb-2">Aguardando aprovação</h2>
              <p className="text-slate-400 text-sm mb-6">
                Seu acesso está pendente de aprovação pelo administrador.
                Você será notificado quando seu acesso for liberado.
              </p>
              <button
                onClick={() => window.location.href = '/login'}
                className="text-sm text-indigo-400 hover:text-indigo-300 transition"
              >
                Tentar novamente
              </button>
            </div>
          ) : (
            <>
              <h2 className="text-white font-semibold text-lg mb-1 text-center">Entrar</h2>
              <p className="text-slate-400 text-sm text-center mb-6">
                Use sua conta Google para acessar
              </p>

              {error && (
                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5 mb-4 text-red-400 text-sm">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{decodeURIComponent(error)}</span>
                </div>
              )}

              <a
                href={authApi.loginUrl()}
                className="flex items-center justify-center gap-3 w-full bg-white hover:bg-slate-100 text-slate-800 font-medium rounded-xl px-4 py-3 transition text-sm"
              >
                <svg width="18" height="18" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                </svg>
                Continuar com Google
              </a>

              <p className="text-center text-xs text-slate-600 mt-4">
                Apenas emails autorizados pelo administrador terão acesso.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
