import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { clearTokens, getAccessToken, getRefreshToken, setAccessToken } from './auth';
import type { FieldErrors } from './types';

export const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000/api';

// Fired when we cannot refresh a session; the AuthProvider listens for this.
export const AUTH_EXPIRED_EVENT = 'fleet:auth-expired';

export const apiClient = axios.create({
  baseURL: apiBaseUrl,
  timeout: 15_000,
});

// Attach the access token to every outgoing request.
apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refresh = getRefreshToken();
  if (!refresh) return null;
  try {
    const { data } = await axios.post<{ access: string }>(
      `${apiBaseUrl}/token/refresh/`,
      { refresh },
      { timeout: 15_000 },
    );
    setAccessToken(data.access);
    return data.access;
  } catch {
    return null;
  }
}

interface RetryableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

// Transparently refresh an expired access token once, then replay the request.
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetryableConfig | undefined;
    const status = error.response?.status;
    const isTokenEndpoint = original?.url?.includes('/token') ?? false;

    if (status === 401 && original && !original._retry && !isTokenEndpoint) {
      original._retry = true;
      if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => {
          refreshPromise = null;
        });
      }
      const access = await refreshPromise;
      if (access) {
        original.headers.set('Authorization', `Bearer ${access}`);
        return apiClient(original);
      }
      clearTokens();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
      }
    }
    return Promise.reject(error);
  },
);

// Convert a DRF error body ({ field: ["msg"], detail: "..." }) into field errors.
export function extractFieldErrors(error: unknown): FieldErrors {
  const result: FieldErrors = {};
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
        if (key === 'detail' || key === 'non_field_errors') continue;
        if (Array.isArray(value)) {
          result[key] = value.map(String).join(' ');
        } else if (typeof value === 'string') {
          result[key] = value;
        } else if (value && typeof value === 'object') {
          result[key] = Object.values(value as Record<string, unknown>)
            .map((item) => (Array.isArray(item) ? item.join(' ') : String(item)))
            .join(' ');
        }
      }
    }
  }
  return result;
}

// True when the API returned a 5xx (e.g. a DRF ProtectedError bubbling up).
export function isServerError(error: unknown): boolean {
  return axios.isAxiosError(error) && (error.response?.status ?? 0) >= 500;
}

export function extractErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    if (typeof data === 'string' && data) return data;
    if (data && typeof data === 'object') {
      const record = data as Record<string, unknown>;
      if (typeof record.detail === 'string') return record.detail;
      const fieldErrors = extractFieldErrors(error);
      const first = Object.values(fieldErrors)[0];
      if (first) return first;
    }
    if (error.response) {
      return `Request failed with status ${error.response.status}.`;
    }
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return 'An unexpected error occurred.';
}
