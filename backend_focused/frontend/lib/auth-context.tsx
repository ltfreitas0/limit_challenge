'use client';

import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type PropsWithChildren,
} from 'react';

import { apiClient } from './api-client';
import {
  getServerSessionSnapshot,
  getSessionSnapshot,
  signIn,
  signOut,
  subscribeSession,
  usernameFromSnapshot,
} from './session';
import type { TokenPair } from './types';

// Stable no-op subscription used to detect the client without an effect.
const emptySubscribe = () => () => {};

function useIsClient(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

interface AuthContextValue {
  isAuthenticated: boolean;
  ready: boolean;
  username: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const snapshot = useSyncExternalStore(
    subscribeSession,
    getSessionSnapshot,
    getServerSessionSnapshot,
  );
  const isClient = useIsClient();

  const login = useCallback(async (username: string, password: string) => {
    const { data } = await apiClient.post<TokenPair>('/token/', { username, password });
    signIn(data, username);
  }, []);

  const logout = useCallback(() => {
    signOut();
    queryClient.clear();
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated: snapshot !== '',
      ready: isClient,
      username: usernameFromSnapshot(snapshot),
      login,
      logout,
    }),
    [snapshot, isClient, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
