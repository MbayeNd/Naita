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

  // Clears the UI immediately (no network wait) and revokes the session
  // server-side in the background. Also used as the automatic handler when
  // any request comes back 401 after a failed refresh — calling /auth/logout
  // again in that case is harmless, since revoking an already-invalid
  // session is a no-op on the server.
  const signOut = useCallback(() => {
    tokenStore.clear();
    setUser(null);
    setStatus('signed-out');
    api.logout().catch(() => {});
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(signOut);
  }, [signOut]);

  // There is nothing to check client-side anymore before attempting this —
  // the access token doesn't survive a reload by design, and the httpOnly
  // refresh cookie can't be read from JS to check it exists. So every load
  // just asks the server: is there a valid session behind this cookie or not.
  useEffect(() => {
    let cancelled = false;
    async function restore() {
      try {
        const { user: me } = await api.refresh();
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