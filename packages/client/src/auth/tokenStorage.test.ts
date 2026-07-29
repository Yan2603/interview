import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from './tokenStorage';

const store = new Map<string, string>();

vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => {
    store.set(k, v);
  },
  removeItem: (k: string) => {
    store.delete(k);
  },
  clear: () => store.clear(),
});

describe('tokenStorage', () => {
  beforeEach(() => localStorage.clear());

  it('roundtrips tokens', () => {
    setTokens('a', 'r');
    expect(getAccessToken()).toBe('a');
    expect(getRefreshToken()).toBe('r');
    clearTokens();
    expect(getAccessToken()).toBeNull();
  });
});
