import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { api, tokenStore, setUnauthorizedHandler } from '../api/client.js';

const AuthContext = createContext(null);

export const ROLE_LABELS = {
  admin: 'Administrator',
  coordinator: 'Coordinator',
  chief_examiner: 'Chief Examiner',
  support_examiner: 'Support Examiner',
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading');

  const signOut = useCallback(() => {
    tokenStore.clear();
    setUser(null);
    setStatus('signed-out');
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(signOut);
  }, [signOut]);

  // Restore the session on reload so a refresh mid-evaluation isn't a sign-out.
  useEffect(() => {
    let cancelled = false;
    async function restore() {
      if (!tokenStore.get()) {
        setStatus('signed-out');
        return;
      }
      try {
        const { user: me } = await api.me();
        if (!cancelled) {
          setUser(me);
          setStatus('signed-in');
        }
      } catch {
        if (!cancelled) {
          tokenStore.clear();
          setStatus('signed-out');
        }
      }
    }
    restore();
    return () => { cancelled = true; };
  }, []);

  const signIn = useCallback(async (email, password) => {
    const { token, user: me } = await api.login(email, password);
    tokenStore.set(token);
    setUser(me);
    setStatus('signed-in');
    return me;
  }, []);

  const value = useMemo(
    () => ({ user, status, signIn, signOut, setUser, isExaminer: user?.role === 'chief_examiner' || user?.role === 'support_examiner' }),
    [user, status, signIn, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
