import { describe, expect, it } from 'vitest';
import { sanitizeRedirect } from './redirect';

describe('sanitizeRedirect', () => {
  it('allows normal internal paths', () => {
    expect(sanitizeRedirect('/')).toBe('/');
    expect(sanitizeRedirect('/questions')).toBe('/questions');
    expect(sanitizeRedirect('/questions?x=1')).toBe('/questions?x=1');
  });

  it('rejects external and login targets', () => {
    expect(sanitizeRedirect('https://evil.com')).toBe('/');
    expect(sanitizeRedirect('//evil.com')).toBe('/');
    expect(sanitizeRedirect('/login')).toBe('/');
    expect(sanitizeRedirect('/login?redirect=%2F')).toBe('/');
    expect(sanitizeRedirect(undefined)).toBe('/');
  });
});
