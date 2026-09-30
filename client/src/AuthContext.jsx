import { createContext, useContext, useMemo, useState, useCallback, useEffect } from 'react';
import { api, clearToken, getToken, setToken, getStoredRole, setStoredRole, clearStoredRole } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setTokenState] = useState(() => getToken());
  const [role, setRole] = useState(() => getStoredRole());
  const [roleLoaded, setRoleLoaded] = useState(() => !getToken());
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setRole(null);
      setRoleLoaded(true);
      return undefined;
    }
    let cancelled = false;
    setRoleLoaded(false);
    api
      .me()
      .then((data) => {
        if (cancelled) return;
        const next = data?.role || 'member';
        setRole(next);
        setStoredRole(next);
        setRoleLoaded(true);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err?.status === 401) {
          clearToken();
          clearStoredRole();
          setTokenState(null);
          setRole(null);
        } else {
          const stored = getStoredRole();
          if (stored) setRole(stored);
        }
        setRoleLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const login = useCallback(async (password) => {
    setError('');
    try {
      const data = await api.login(password);
      setToken(data.token);
      setTokenState(data.token);
      const nextRole = data.role || 'owner';
      setRole(nextRole);
      setStoredRole(nextRole);
      setRoleLoaded(true);
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // ignore network errors on logout
    }
    clearToken();
    clearStoredRole();
    setTokenState(null);
    setRole(null);
    setRoleLoaded(true);
  }, []);

  const value = useMemo(
    () => ({
      isAuthenticated: Boolean(token),
      role,
      isOwner: role === 'owner',
      roleLoaded,
      login,
      logout,
      error,
      clearError: () => setError(''),
    }),
    [token, role, roleLoaded, login, logout, error]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
