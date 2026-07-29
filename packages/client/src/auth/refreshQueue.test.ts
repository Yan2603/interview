import { describe, expect, it } from 'vitest';
import { runSingleFlightRefresh } from './refreshQueue';

describe('refreshQueue', () => {
  it('shares one in-flight refresh among concurrent callers', async () => {
    let calls = 0;
    const doRefresh = async () => {
      calls += 1;
      await new Promise((r) => setTimeout(r, 20));
      return { accessToken: 'newA', refreshToken: 'newR' };
    };
    const [a, b] = await Promise.all([
      runSingleFlightRefresh(doRefresh),
      runSingleFlightRefresh(doRefresh),
    ]);
    expect(calls).toBe(1);
    expect(a.accessToken).toBe('newA');
    expect(b.accessToken).toBe('newA');
  });
});
