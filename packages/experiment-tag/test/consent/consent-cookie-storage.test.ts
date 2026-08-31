import { activateConsent } from './consent-test-util';

import {
  ConsentAwareCookieStorage,
  SyncCookieStore,
} from 'src/consent/consent-cookie-storage';
import { consentGate } from 'src/consent/consent-gate';

/** Records what reached the real (synchronous) cookie storage. */
const fakeStore = <T = string>(initial: Record<string, T> = {}) => {
  const store: Record<string, T> = { ...initial };
  return {
    store,
    get: jest.fn((key: string): T | undefined => store[key]),
    set: jest.fn((key: string, value: T) => {
      store[key] = value;
    }),
    remove: jest.fn((key: string) => {
      delete store[key];
    }),
  } satisfies SyncCookieStore<T> & { store: Record<string, T> };
};

describe('ConsentAwareCookieStorage', () => {
  beforeEach(() => {
    consentGate.reset();
  });

  it('delegates when consent gating was never activated', () => {
    const delegate = fakeStore();
    const storage = new ConsentAwareCookieStorage(delegate);

    storage.set('ck', 'value');

    expect(storage.get('ck')).toEqual('value');
    expect(delegate.store).toEqual({ ck: 'value' });
  });

  it('delegates when consent was granted from the start', () => {
    activateConsent('granted');
    const delegate = fakeStore();
    const storage = new ConsentAwareCookieStorage(delegate);

    storage.set('ck', 'value');

    expect(delegate.set).toHaveBeenCalledWith('ck', 'value');
  });

  describe('pending', () => {
    it('buffers writes and serves reads from the buffer', () => {
      activateConsent('pending');
      const delegate = fakeStore();
      const storage = new ConsentAwareCookieStorage(delegate);

      storage.set('ck', 'fresh');

      expect(delegate.set).not.toHaveBeenCalled();
      expect(storage.get('ck')).toEqual('fresh');
    });

    it('does not read a cookie from an earlier consented visit', () => {
      activateConsent('pending');
      const delegate = fakeStore({ ck: 'stale' });
      const storage = new ConsentAwareCookieStorage(delegate);

      expect(storage.get('ck')).toBeUndefined();
      expect(delegate.get).not.toHaveBeenCalled();
    });

    it('drops a buffered write on remove without expiring the cookie', () => {
      activateConsent('pending');
      const delegate = fakeStore({ ck: 'stale' });
      const storage = new ConsentAwareCookieStorage(delegate);
      storage.set('ck', 'fresh');

      storage.remove('ck');

      expect(storage.get('ck')).toBeUndefined();
      expect(delegate.remove).not.toHaveBeenCalled();
      expect(delegate.store).toEqual({ ck: 'stale' });
    });
  });

  describe('grant', () => {
    it('hands buffered writes to the real storage, then writes through directly', () => {
      activateConsent('pending');
      const delegate = fakeStore();
      const storage = new ConsentAwareCookieStorage(delegate);
      storage.set('a', '1');
      storage.set('b', '2');

      consentGate.manager.setStatus('granted');

      // The flush runs synchronously as consent is granted.
      expect(storage.get('a')).toEqual('1');
      expect(delegate.store).toEqual({ a: '1', b: '2' });

      storage.set('ck', 'after');
      expect(delegate.store).toEqual({ a: '1', b: '2', ck: 'after' });
    });

    it('reads a cookie written before the visit once consent lands', () => {
      activateConsent('pending');
      const delegate = fakeStore({ ck: 'prior' });
      const storage = new ConsentAwareCookieStorage(delegate);
      expect(storage.get('ck')).toBeUndefined();

      consentGate.manager.setStatus('granted');

      expect(storage.get('ck')).toEqual('prior');
    });

    it('merges the durable device identity when flushing a buffered write', () => {
      activateConsent('pending');
      const delegate = fakeStore({
        // Durable identity an earlier consented visit persisted.
        id: JSON.stringify({ web_exp_id_v2: 'durable-id', first_seen: '100' }),
      });
      const storage = new ConsentAwareCookieStorage(delegate);
      // The gated visit read the cookie as absent, so it minted a fresh id.
      storage.set('id', JSON.stringify({ web_exp_id_v2: 'fresh-id' }));

      consentGate.manager.setStatus('granted');

      // The durable id (and first_seen) win over the gated visit's fresh mint.
      expect(JSON.parse(delegate.store.id)).toEqual({
        web_exp_id_v2: 'durable-id',
        first_seen: '100',
      });
    });

    it('keeps a write blocked mid-flush from stopping the rest', () => {
      activateConsent('pending');
      const delegate = fakeStore();
      delegate.set.mockImplementationOnce(() => {
        throw new Error('cookies blocked');
      });
      const storage = new ConsentAwareCookieStorage(delegate);
      storage.set('a', '1');
      storage.set('b', '2');

      consentGate.manager.setStatus('granted');

      // The blocked key is lost, the rest still lands.
      expect(delegate.store).toEqual({ b: '2' });
    });
  });

  describe('lazy delegate', () => {
    it('does not resolve the delegate while consent is withheld', () => {
      activateConsent('pending');
      const factory = jest.fn(() => fakeStore());
      const storage = new ConsentAwareCookieStorage(factory);

      storage.set('ck', 'fresh');
      expect(storage.get('ck')).toEqual('fresh');

      expect(factory).not.toHaveBeenCalled();
    });

    it('resolves the delegate at grant flush, so it captures post-grant state', () => {
      activateConsent('pending');
      const delegate = fakeStore();
      // Stands in for the cookie-domain probe: real only once granted.
      const factory = jest.fn(() => {
        expect(consentGate.manager.getStatus()).toEqual('granted');
        return delegate;
      });
      const storage = new ConsentAwareCookieStorage(factory);
      storage.set('ck', 'fresh');

      consentGate.manager.setStatus('granted');
      expect(storage.get('ck')).toEqual('fresh');

      expect(factory).toHaveBeenCalledTimes(1);
      expect(delegate.store).toEqual({ ck: 'fresh' });
    });

    it('never resolves the delegate when consent is denied', () => {
      activateConsent('pending');
      const factory = jest.fn(() => fakeStore());
      const storage = new ConsentAwareCookieStorage(factory);
      storage.set('ck', 'fresh');

      consentGate.manager.setStatus('denied');
      expect(storage.get('ck')).toBeUndefined();

      expect(factory).not.toHaveBeenCalled();
    });

    it('drops the buffer without poisoning later access when the factory throws', () => {
      activateConsent('pending');
      const factory = (): SyncCookieStore<string> => {
        throw new Error('probe failed');
      };
      const storage = new ConsentAwareCookieStorage(factory);
      storage.set('ck', 'fresh');

      consentGate.manager.setStatus('granted');

      expect(() => storage.get('ck')).toThrow('probe failed');
    });
  });

  describe('denial', () => {
    it('discards buffered writes instead of flushing them', () => {
      activateConsent('pending');
      const delegate = fakeStore();
      const storage = new ConsentAwareCookieStorage(delegate);
      storage.set('ck', 'fresh');

      consentGate.manager.setStatus('denied');

      expect(delegate.set).not.toHaveBeenCalled();
      expect(storage.get('ck')).toBeUndefined();
    });

    it('drops later writes rather than persisting them', () => {
      activateConsent('granted');
      const delegate = fakeStore();
      const storage = new ConsentAwareCookieStorage(delegate);
      consentGate.manager.setStatus('denied');

      storage.set('ck', 'fresh');

      expect(delegate.set).not.toHaveBeenCalled();
    });

    it('reads as absent rather than returning a persisted cookie', () => {
      activateConsent('granted');
      const delegate = fakeStore({ ck: 'prior' });
      const storage = new ConsentAwareCookieStorage(delegate);
      consentGate.manager.setStatus('denied');

      expect(storage.get('ck')).toBeUndefined();
    });

    it('still removes, which is how cleanup erases the cookie', () => {
      activateConsent('granted');
      const delegate = fakeStore({ ck: 'prior' });
      const storage = new ConsentAwareCookieStorage(delegate);
      consentGate.manager.setStatus('denied');

      storage.remove('ck');

      expect(delegate.store).toEqual({});
    });

    it('does not flush a value buffered before refusal if consent arrives later', () => {
      activateConsent('pending');
      const delegate = fakeStore();
      const storage = new ConsentAwareCookieStorage(delegate);
      storage.set('ck', 'fresh');
      consentGate.manager.setStatus('denied');

      consentGate.manager.setStatus('granted');

      expect(delegate.set).not.toHaveBeenCalled();
    });

    it('does not flush a mutated in-memory copy', () => {
      activateConsent('pending');
      const delegate = fakeStore<{ v: number }>();
      const storage = new ConsentAwareCookieStorage(delegate);
      storage.set('ck', { v: 1 });
      const cached = storage.get('ck');
      (cached as { v: number }).v = 99;

      consentGate.manager.setStatus('granted');
      storage.get('ck');

      expect(delegate.store.ck).toEqual({ v: 1 });
    });
  });
});
