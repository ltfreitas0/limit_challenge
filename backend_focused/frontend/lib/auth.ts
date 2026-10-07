// Token storage helpers. Tokens live in localStorage so the API client can
// attach them synchronously to every request.
import type { TokenPair } from './types';

const ACCESS_KEY = 'fleet.access';
const REFRESH_KEY = 'fleet.refresh';

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function getAccessToken(): string | null {
  if (!canUseStorage()) return null;
  return window.localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  if (!canUseStorage()) return null;
  return window.localStorage.getItem(REFRESH_KEY);
}

export function setAccessToken(token: string): void {
  if (!canUseStorage()) return;
  window.localStorage.setItem(ACCESS_KEY, token);
}

export function setRefreshToken(token: string): void {
  if (!canUseStorage()) return;
  window.localStorage.setItem(REFRESH_KEY, token);
}

export function setTokens(tokens: TokenPair): void {
  setAccessToken(tokens.access);
  setRefreshToken(tokens.refresh);
}

export function clearTokens(): void {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(ACCESS_KEY);
  window.localStorage.removeItem(REFRESH_KEY);
}
