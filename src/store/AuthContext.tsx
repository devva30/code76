import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { API_BASE_URL, accountApi, resetCsrfToken, type UserDto } from '@/lib/api';

/**
 * - `unavailable`: no API configured (static preview), so accounts are switched off.
 * - `loading`: asking the server "who am I?" on first load.
 */
export type AuthStatus = 'unavailable' | 'loading' | 'signed-out' | 'signed-in';

interface AuthContextValue {
  status: AuthStatus;
  user: UserDto | null;
  /** These throw ApiError on failure so forms can show the message next to the right field. */
  signIn: (email: string, password: string) => Promise<UserDto>;
  signUp: (name: string, email: string, password: string) => Promise<UserDto>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>(API_BASE_URL ? 'loading' : 'unavailable');
  const [user, setUser] = useState<UserDto | null>(null);

  // On first load, ask whether the browser already holds a signed-in session cookie.
  useEffect(() => {
    if (!API_BASE_URL) return;
    const ctrl = new AbortController();
    accountApi
      .session(ctrl.signal)
      .then((s) => {
        setUser(s.user);
        setStatus(s.authenticated && s.user ? 'signed-in' : 'signed-out');
      })
      .catch((err) => {
        if ((err as Error).name === 'AbortError') return;
        setStatus('signed-out'); // server unreachable: browse as a guest; sign-in shows the error
      });
    return () => ctrl.abort();
  }, []);

  const signedIn = useCallback((u: UserDto) => {
    resetCsrfToken(); // the session (and its token) changed
    setUser(u);
    setStatus('signed-in');
    return u;
  }, []);

  const signIn = useCallback((email: string, password: string) => accountApi.login({ email, password }).then(signedIn), [signedIn]);

  const signUp = useCallback(
    (name: string, email: string, password: string) => accountApi.register({ name, email, password }).then(signedIn),
    [signedIn],
  );

  const signOut = useCallback(async () => {
    try {
      await accountApi.logout();
    } finally {
      // Even if the request failed, forget the user locally; the server session expires on its own.
      resetCsrfToken();
      setUser(null);
      setStatus('signed-out');
    }
  }, []);

  const value = useMemo(() => ({ status, user, signIn, signUp, signOut }), [status, user, signIn, signUp, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
