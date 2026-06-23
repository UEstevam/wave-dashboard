import { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './components/Toaster';
import CreativesTable from './components/CreativesTable';
import LoginPage from './pages/LoginPage';
import { Film } from 'lucide-react';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 2000, retry: 1 } },
});

// Handles the /auth/callback?token=... redirect from backend
function AuthCallbackHandler() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      localStorage.setItem('wave_auth_token', token);
    }
    window.location.replace('/');
  }, []);
  return (
    <div className="min-h-screen bg-[#0a0c14] flex items-center justify-center">
      <div className="text-slate-400 text-sm animate-pulse">Autenticando...</div>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-[#0a0c14] flex items-center justify-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center animate-pulse">
        <Film size={16} className="text-white" />
      </div>
      <span className="text-slate-400 text-sm">Carregando...</span>
    </div>
  );
}

function Main() {
  const { user, loading } = useAuth();
  const path = window.location.pathname;

  if (path === '/login') return <LoginPage />;
  if (loading) return <LoadingScreen />;
  if (!user) return <LoginPage />;
  return <CreativesTable />;
}

export default function App() {
  const path = window.location.pathname;

  if (path === '/auth/callback') {
    return <AuthCallbackHandler />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <Main />
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
