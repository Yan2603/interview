import { clearTokens } from './tokenStorage';
import { sanitizeRedirect } from './redirect';

let redirectingToLogin = false;

function redirectToLogin(): void {
  if (redirectingToLogin) return;
  if (window.location.pathname === '/login') return;

  redirectingToLogin = true;
  const target = sanitizeRedirect(
    `${window.location.pathname}${window.location.search}${window.location.hash}`,
  );
  window.location.assign(`/login?redirect=${encodeURIComponent(target)}`);
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
