import { createContext, useContext, useEffect, useState } from 'react';
import type { AppUser } from '../types';
import { authApi } from '../api/client';

interface AuthContextType {
  user: AppUser | null;
  token: string | null;
  loading: boolean;
  logout: () => void;
  setToken: (token: string) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  loading: true,
  logout: () => {},
  setToken: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  function setToken(t: string) {
    localStorage.setItem('wave_auth_token', t);
    setTokenState(t);
  }

  function logout() {
    localStorage.removeItem('wave_auth_token');
    setTokenState(null);
    setUser(null);
    window.location.href = '/login';
  }

  useEffect(() => {
    const stored = localStorage.getItem('wave_auth_token');
    if (!stored) {
      setLoading(false);
      return;
    }
    setTokenState(stored);
    authApi.me()
      .then(u => setUser(u))
      .catch(() => {
        localStorage.removeItem('wave_auth_token');
        setTokenState(null);
      })
      .finally(() => setLoading(false));
  }, []);

  // Re-fetch user when token changes (e.g., after callback)
  useEffect(() => {
    if (!token) return;
    authApi.me()
      .then(u => setUser(u))
      .catch(() => {});
  }, [token]);

  return (
    <AuthContext.Provider value={{ user, token, loading, logout, setToken }}>
      {children}
    </AuthContext.Provider>
  );
}
