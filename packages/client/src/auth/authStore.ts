import { defineStore } from 'pinia';
import { api } from '../api';
import { refreshTokensRequest } from '../api/http';
import { runSingleFlightRefresh } from './refreshQueue';
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from './tokenStorage';

export type AuthUser = { id: string; username: string };

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null as null | AuthUser,
  }),
  getters: {
    isAuthenticated: () => Boolean(getAccessToken() || getRefreshToken()),
  },
  actions: {
    async login(username: string, password: string) {
      const data = await api.login({ username, password });
      setTokens(data.accessToken, data.refreshToken);
      await this.fetchMe();
    },

    async logout() {
      const refreshToken = getRefreshToken();
      try {
        if (refreshToken) {
          await api.logout(refreshToken);
        }
      } finally {
        clearTokens();
        this.user = null;
      }
    },

    async fetchMe() {
      this.user = await api.me();
    },

    /** Ensure tokens are usable and `user` is loaded. Returns false if session cannot be restored. */
    async ensureSession(): Promise<boolean> {
      if (!getAccessToken() && !getRefreshToken()) {
        this.user = null;
        return false;
      }

      if (!getAccessToken() && getRefreshToken()) {
        try {
          const tokens = await runSingleFlightRefresh(() => {
            const refresh = getRefreshToken();
            if (!refresh) {
              return Promise.reject(new Error('No refresh token'));
            }
            return refreshTokensRequest(refresh);
          });
          setTokens(tokens.accessToken, tokens.refreshToken);
        } catch {
          clearTokens();
          this.user = null;
          return false;
        }
      }

      if (this.user) {
        return true;
      }

      try {
        await this.fetchMe();
        return true;
      } catch {
        clearTokens();
        this.user = null;
        return false;
      }
    },
  },
});
