import {
  deleteRawCookie,
  readRawCookie,
  resolveCrossSubdomainObject,
  SyncJsonCookie,
  writeRawCookie,
} from '../../src/util/cookie';

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

// jsdom shares document.cookie across tests in a file; clear between tests.
function clearAllCookies() {
  for (const cookie of document.cookie ? document.cookie.split('; ') : []) {
    const eq = cookie.indexOf('=');
    const key = eq === -1 ? cookie : cookie.slice(0, eq);
    if (key) deleteRawCookie(key);
  }
}

describe('raw cookie helpers', () => {
  afterEach(clearAllCookies);

  it('round-trips a value (host-only) and url-encodes it', () => {
    expect(writeRawCookie('rawk', 'a b=c')).toBe(true);
    expect(readRawCookie('rawk')).toBe('a b=c');
    expect(document.cookie).toContain('rawk=a%20b%3Dc');
  });

  it('returns undefined for an absent cookie', () => {
    expect(readRawCookie('missing')).toBeUndefined();
  });

  it('deletes a cookie', () => {
    writeRawCookie('delk', 'x');
    deleteRawCookie('delk');
    expect(readRawCookie('delk')).toBeUndefined();
  });
});

describe('SyncJsonCookie', () => {
  afterEach(clearAllCookies);

  it('round-trips a JSON value via the cookie', () => {
    const store = new SyncJsonCookie<{ n: number }>('sjc', () => '');
    store.write({ n: 7 });
    expect(store.read()).toEqual({ n: 7 });
    expect(readRawCookie('sjc')).toBe(JSON.stringify({ n: 7 }));
  });

  it('returns undefined when nothing is stored', () => {
    expect(new SyncJsonCookie('empty', () => '').read()).toBeUndefined();
  });

  it('clears the value', () => {
    const store = new SyncJsonCookie<number>('sjc2', () => '');
    store.write(1);
    store.clear();
    expect(store.read()).toBeUndefined();
  });

  it('rejects payloads failing validate() and falls back to memory', () => {
    type V = { ok: boolean };
    const validate = (v: unknown): V | undefined =>
      v && typeof (v as V).ok === 'boolean' ? (v as V) : undefined;
    // Pre-seed a structurally-invalid (but valid JSON) cookie.
    writeRawCookie('sjc3', JSON.stringify({ nope: 1 }));
    const store = new SyncJsonCookie<V>('sjc3', () => '', { validate });
    // Invalid cookie shape rejected, no memory yet -> undefined.
    expect(store.read()).toBeUndefined();
    // After a valid write, read returns it.
    store.write({ ok: true });
    expect(store.read()).toEqual({ ok: true });
  });

  it('falls back to in-memory when cookie writes are blocked', () => {
    const original = Object.getOwnPropertyDescriptor(
      Document.prototype,
      'cookie',
    );
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      get: () => '',
      set: () => undefined,
    });
    try {
      const store = new SyncJsonCookie<{ v: string }>('blocked', () => '');
      store.write({ v: 'in-memory' });
      expect(store.read()).toEqual({ v: 'in-memory' });
    } finally {
      if (original) {
        Object.defineProperty(document, 'cookie', original);
      }
    }
  });
});
