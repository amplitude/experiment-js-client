import { resolveCrossSubdomainObject } from '../../src/util/cookie';

/**
 * Minimal in-memory stand-in for analytics-core's async CookieStorage<string>,
 * matching the get/set surface resolveCrossSubdomainObject uses.
 */
function fakeCookieStorage(initial: Record<string, string> = {}) {
  const store: Record<string, string> = { ...initial };
  return {
    store,
    get: jest.fn((key: string) => Promise.resolve(store[key])),
    set: jest.fn((key: string, value: string) => {
      store[key] = value;
      return Promise.resolve();
    }),
  };
}

describe('resolveCrossSubdomainObject', () => {
  type Identity = { web_exp_id_v2: string; first_seen: string };

  it('returns existing cookie fields without rewriting', async () => {
    const storage = fakeCookieStorage({
      KEY: JSON.stringify({ web_exp_id_v2: 'abc', first_seen: '123' }),
    });
    const resolved = await resolveCrossSubdomainObject<Identity>(
      storage as never,
      'KEY',
      { web_exp_id_v2: 'fallback', first_seen: 'fallback' },
      { web_exp_id_v2: () => 'gen', first_seen: () => 'gen' },
    );
    expect(resolved).toEqual({ web_exp_id_v2: 'abc', first_seen: '123' });
    expect(storage.set).not.toHaveBeenCalled();
  });

  it('seeds missing fields from fallback, then persists once', async () => {
    const storage = fakeCookieStorage();
    const resolved = await resolveCrossSubdomainObject<Identity>(
      storage as never,
      'KEY',
      { web_exp_id_v2: 'from-fallback' },
      { web_exp_id_v2: () => 'gen', first_seen: () => 'generated' },
    );
    expect(resolved).toEqual({
      web_exp_id_v2: 'from-fallback',
      first_seen: 'generated',
    });
    expect(storage.set).toHaveBeenCalledTimes(1);
    expect(JSON.parse(storage.store['KEY'])).toEqual(resolved);
  });

  it('falls back to generators when no cookie or fallback', async () => {
    const storage = fakeCookieStorage();
    const resolved = await resolveCrossSubdomainObject<Identity>(
      storage as never,
      'KEY',
      {},
      { web_exp_id_v2: () => 'gen-id', first_seen: () => 'gen-ts' },
    );
    expect(resolved).toEqual({ web_exp_id_v2: 'gen-id', first_seen: 'gen-ts' });
  });

  it('re-seeds when the cookie holds only some fields', async () => {
    const storage = fakeCookieStorage({
      KEY: JSON.stringify({ web_exp_id_v2: 'kept' }),
    });
    const resolved = await resolveCrossSubdomainObject<Identity>(
      storage as never,
      'KEY',
      { first_seen: 'seed-ts' },
      { web_exp_id_v2: () => 'gen', first_seen: () => 'gen' },
    );
    expect(resolved).toEqual({ web_exp_id_v2: 'kept', first_seen: 'seed-ts' });
    expect(storage.set).toHaveBeenCalledTimes(1);
  });

  it('tolerates malformed cookie json by re-seeding', async () => {
    const storage = fakeCookieStorage({ KEY: 'not-json{' });
    const resolved = await resolveCrossSubdomainObject<Identity>(
      storage as never,
      'KEY',
      {},
      { web_exp_id_v2: () => 'fresh', first_seen: () => 'fresh-ts' },
    );
    expect(resolved).toEqual({
      web_exp_id_v2: 'fresh',
      first_seen: 'fresh-ts',
    });
  });
});
