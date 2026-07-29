import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { runSingleFlightRefresh } from '../auth/refreshQueue';
import { handleSessionExpired } from '../auth/sessionExpired';
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from '../auth/tokenStorage';

type RetryableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

export type AuthTokensResponse = {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
};

export const http = axios.create({
  baseURL: '/api',
  timeout: 300000, // AI 作答可能超过 60s
});

/** Bare axios refresh — must not use intercepted `http` (avoids 401 loops). */
export async function refreshTokensRequest(refreshToken: string) {
  const { data } = await axios.post<AuthTokensResponse>('/api/auth/refresh', {
    refreshToken,
  });
  return data;
}

http.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalConfig = error.config as RetryableConfig | undefined;

    if (error.response?.status !== 401) {
      return Promise.reject(error);
    }

    const url = originalConfig?.url ?? '';
    if (url.includes('/auth/login') || url.includes('/auth/refresh')) {
      clearTokens();
      return Promise.reject(error);
    }

    if (!originalConfig || originalConfig._retry) {
      await handleSessionExpired();
      return Promise.reject(error);
    }

    const refresh = getRefreshToken();
    if (!refresh) {
      await handleSessionExpired();
      return Promise.reject(error);
    }

    try {
      const tokens = await runSingleFlightRefresh(() => {
        const current = getRefreshToken();
        if (!current) {
          return Promise.reject(new Error('No refresh token'));
        }
        return refreshTokensRequest(current);
      });
      setTokens(tokens.accessToken, tokens.refreshToken);
      originalConfig._retry = true;
      originalConfig.headers = originalConfig.headers ?? {};
      originalConfig.headers.Authorization = `Bearer ${tokens.accessToken}`;
      return http.request(originalConfig);
    } catch {
      await handleSessionExpired();
      return Promise.reject(error);
    }
  },
);
