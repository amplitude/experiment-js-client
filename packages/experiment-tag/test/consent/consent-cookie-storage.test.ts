import { activateConsent } from './consent-test-util';

import {
  AsyncCookieStore,
  ConsentAwareCookieStorage,
} from 'src/consent/consent-cookie-storage';
import { consentGate } from 'src/consent/consent-gate';

/** Records what reached the real cookie storage. */
const fakeStore = (initial: Record<string, string> = {}) => {
  const store: Record<string, string> = { ...initial };
  return {
    store,
    get: jest.fn((key: string) => Promise.resolve(store[key])),
    set: jest.fn((key: string, value: string) => {
      store[key] = value;
      return Promise.resolve();
    }),
    remove: jest.fn((key: string) => {
      delete store[key];
      return Promise.resolve();
    }),
  } satisfies AsyncCookieStore<string> & { store: Record<string, string> };
};

describe('ConsentAwareCookieStorage', () => {
  beforeEach(() => {
    consentGate.reset();
  });

  it('delegates when consent gating was never activated', async () => {
    const delegate = fakeStore();
    const storage = new ConsentAwareCookieStorage(delegate);

    await storage.set('ck', 'value');

    expect(await storage.get('ck')).toEqual('value');
    expect(delegate.store).toEqual({ ck: 'value' });
  });

  it('delegates when consent was granted from the start', async () => {
    activateConsent('granted');
    const delegate = fakeStore();
    const storage = new ConsentAwareCookieStorage(delegate);

    await storage.set('ck', 'value');

    expect(delegate.set).toHaveBeenCalledWith('ck', 'value');
  });

  describe('pending', () => {
    it('buffers writes and serves reads from the buffer', async () => {
      activateConsent('pending');
      const delegate = fakeStore();
      const storage = new ConsentAwareCookieStorage(delegate);

      await storage.set('ck', 'fresh');

      expect(delegate.set).not.toHaveBeenCalled();
      expect(await storage.get('ck')).toEqual('fresh');
    });

    it('does not read a cookie from an earlier consented visit', async () => {
      activateConsent('pending');
      const delegate = fakeStore({ ck: 'stale' });
      const storage = new ConsentAwareCookieStorage(delegate);

      expect(await storage.get('ck')).toBeUndefined();
      expect(delegate.get).not.toHaveBeenCalled();
    });

    it('drops a buffered write on remove without expiring the cookie', async () => {
      activateConsent('pending');
      const delegate = fakeStore({ ck: 'stale' });
      const storage = new ConsentAwareCookieStorage(delegate);
      await storage.set('ck', 'fresh');

      await storage.remove('ck');

      expect(await storage.get('ck')).toBeUndefined();
      expect(delegate.remove).not.toHaveBeenCalled();
      expect(delegate.store).toEqual({ ck: 'stale' });
    });
  });

  describe('grant', () => {
    it('hands buffered writes to the real storage, then writes through directly', async () => {
      activateConsent('pending');
      const delegate = fakeStore();
      const storage = new ConsentAwareCookieStorage(delegate);
      await storage.set('a', '1');
      await storage.set('b', '2');

      consentGate.manager.setStatus('granted');

      // The read joins the in-flight flush, so both writes have landed by now.
      expect(await storage.get('a')).toEqual('1');
      expect(delegate.store).toEqual({ a: '1', b: '2' });

      await storage.set('ck', 'after');
      expect(delegate.store).toEqual({ a: '1', b: '2', ck: 'after' });
    });

    it('does not expose a half-flushed store to a read that races the flush', async () => {
      activateConsent('pending');
      const delegate = fakeStore();
      // Stall the first write so the flush is still in flight when we read.
      let releaseFirstWrite: () => void = () => undefined;
      const gate = new Promise<void>((resolve) => {
        releaseFirstWrite = resolve;
      });
      delegate.set.mockImplementationOnce(async (key, value) => {
        await gate;
        delegate.store[key] = value;
      });
      const storage = new ConsentAwareCookieStorage(delegate);
      await storage.set('a', '1');
      await storage.set('b', '2');

      consentGate.manager.setStatus('granted');
      const read = storage.get('b');
      releaseFirstWrite();

      expect(await read).toEqual('2');
    });

    it('reads a cookie written before the visit', async () => {
      activateConsent('pending');
      const delegate = fakeStore({ ck: 'prior' });
      const storage = new ConsentAwareCookieStorage(delegate);
      expect(await storage.get('ck')).toBeUndefined();

      consentGate.manager.setStatus('granted');

      expect(await storage.get('ck')).toEqual('prior');
    });

    it('survives a delegate whose write is blocked', async () => {
      activateConsent('pending');
      const delegate = fakeStore();
      delegate.set.mockRejectedValueOnce(new Error('cookies blocked'));
      const storage = new ConsentAwareCookieStorage(delegate);
      await storage.set('a', '1');
      await storage.set('b', '2');

      consentGate.manager.setStatus('granted');
      // A read joins the in-flight flush, so this also waits for it to finish.
      await storage.get('b');

      // The blocked key is lost, the rest still lands.
      expect(delegate.store).toEqual({ b: '2' });
    });
  });

  describe('denial', () => {
    it('discards buffered writes instead of flushing them', async () => {
      activateConsent('pending');
      const delegate = fakeStore();
      const storage = new ConsentAwareCookieStorage(delegate);
      await storage.set('ck', 'fresh');

      consentGate.manager.setStatus('denied');

      expect(delegate.set).not.toHaveBeenCalled();
      expect(await storage.get('ck')).toBeUndefined();
    });

    it('drops later writes rather than persisting them', async () => {
      activateConsent('granted');
      const delegate = fakeStore();
      const storage = new ConsentAwareCookieStorage(delegate);
      consentGate.manager.setStatus('denied');

      await storage.set('ck', 'fresh');

      expect(delegate.set).not.toHaveBeenCalled();
    });

    it('reads as absent rather than returning a persisted cookie', async () => {
      activateConsent('granted');
      const delegate = fakeStore({ ck: 'prior' });
      const storage = new ConsentAwareCookieStorage(delegate);
      consentGate.manager.setStatus('denied');

      expect(await storage.get('ck')).toBeUndefined();
    });

    it('still removes, which is how cleanup erases the cookie', async () => {
      activateConsent('granted');
      const delegate = fakeStore({ ck: 'prior' });
      const storage = new ConsentAwareCookieStorage(delegate);
      consentGate.manager.setStatus('denied');

      await storage.remove('ck');

      expect(delegate.store).toEqual({});
    });

    it('does not flush a value buffered before refusal if consent arrives later', async () => {
      activateConsent('pending');
      const delegate = fakeStore();
      const storage = new ConsentAwareCookieStorage(delegate);
      await storage.set('ck', 'fresh');
      consentGate.manager.setStatus('denied');

      consentGate.manager.setStatus('granted');

      expect(delegate.set).not.toHaveBeenCalled();
    });

    it('does not flush a mutated in-memory copy', async () => {
      activateConsent('pending');
      const delegate = {
        store: {} as Record<string, { v: number }>,
        get: jest.fn((key: string) => Promise.resolve(delegate.store[key])),
        set: jest.fn((key: string, value: { v: number }) => {
          delegate.store[key] = value;
          return Promise.resolve();
        }),
        remove: jest.fn(async () => undefined),
      };
      const storage = new ConsentAwareCookieStorage(delegate);
      await storage.set('ck', { v: 1 });
      const cached = await storage.get('ck');
      (cached as { v: number }).v = 99;

      consentGate.manager.setStatus('granted');
      await storage.get('ck');

      expect(delegate.store.ck).toEqual({ v: 1 });
    });
  });
});
