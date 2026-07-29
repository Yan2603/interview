import { clearTokens } from './tokenStorage';

function redirectToLogin(): void {
  const redirect = encodeURIComponent(
    `${window.location.pathname}${window.location.search}${window.location.hash}`,
  );
  window.location.assign(`/login?redirect=${redirect}`);
}

/** Clear tokens, reset auth user when Pinia is available, then redirect to login. */
export async function handleSessionExpired(): Promise<void> {
  clearTokens();
  try {
    const { useAuthStore } = await import('./authStore');
    useAuthStore().user = null;
  } catch {
    // Pinia not ready — full-page redirect remounts the app and clears in-memory state.
  }
  redirectToLogin();
}
