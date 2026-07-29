/** Only allow same-origin relative paths; never bounce back to /login. */
export function sanitizeRedirect(raw: unknown): string {
  if (typeof raw !== 'string' || !raw.startsWith('/') || raw.startsWith('//')) {
    return '/';
  }
  if (raw === '/login' || raw.startsWith('/login?') || raw.startsWith('/login/')) {
    return '/';
  }
  return raw;
}
