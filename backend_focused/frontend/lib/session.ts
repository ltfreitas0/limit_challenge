'use client';

// A tiny external store for the authenticated session. Backed by localStorage
// so `useSyncExternalStore` can read it during render without a hydration
// mismatch and without setting state inside an effect.
import { AUTH_EXPIRED_EVENT } from './api-client';
import { clearTokens, getAccessToken, setTokens } from './auth';
import type { TokenPair } from './types';

const USERNAME_KEY = 'fleet.username';

// An empty string means signed out; otherwise "1|<username>". Using a compact
// string keeps React's Object.is snapshot comparison stable.
const SIGNED_OUT = '';

const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) {
    listener();
  }
}

function handleExternalChange(): void {
  emit();
}

export function subscribeSession(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener(AUTH_EXPIRED_EVENT, handleExternalChange);
  window.addEventListener('storage', handleExternalChange);
  return () => {
    listeners.delete(listener);
    window.removeEventListener(AUTH_EXPIRED_EVENT, handleExternalChange);
    window.removeEventListener('storage', handleExternalChange);
  };
}

export function getSessionSnapshot(): string {
  if (typeof window === 'undefined') return SIGNED_OUT;
  if (!getAccessToken()) return SIGNED_OUT;
  const username = window.localStorage.getItem(USERNAME_KEY) ?? '';
  return `1|${username}`;
}

export function getServerSessionSnapshot(): string {
  return SIGNED_OUT;
}

export function usernameFromSnapshot(snapshot: string): string | null {
  if (!snapshot) return null;
  const name = snapshot.slice(2);
  return name || null;
}

export function signIn(tokens: TokenPair, username: string): void {
  setTokens(tokens);
  window.localStorage.setItem(USERNAME_KEY, username);
  emit();
}

export function signOut(): void {
  clearTokens();
  window.localStorage.removeItem(USERNAME_KEY);
  emit();
}
