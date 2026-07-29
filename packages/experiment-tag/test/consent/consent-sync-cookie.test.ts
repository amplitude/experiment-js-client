import { consentGate } from 'src/consent/consent-gate';
import {
  deleteRawCookie,
  readRawCookie,
  SyncJsonCookie,
  writeRawCookie,
} from 'src/util/cookie';

const clearAllCookies = () => {
  for (const cookie of document.cookie ? document.cookie.split('; ') : []) {
    const eq = cookie.indexOf('=');
    const key = eq === -1 ? cookie : cookie.slice(0, eq);
    if (key) deleteRawCookie(key);
  }
};

/** Puts the gate in the state `initialize` leaves it in for a given status. */
const activateConsent = (status: 'pending' | 'granted' | 'denied') => {
  consentGate.required = true;
  consentGate.manager.seedFromConfig(status);
};

describe('SyncJsonCookie consent gating', () => {
  beforeEach(() => {
    consentGate.reset();
    clearAllCookies();
  });

  afterEach(clearAllCookies);

  it('writes the cookie when consent gating was never activated', () => {
    const store = new SyncJsonCookie<{ v: number }>('sjc_off', () => '');

    store.write({ v: 1 });

    expect(readRawCookie('sjc_off')).toEqual(JSON.stringify({ v: 1 }));
  });

  it('writes the cookie when consent was granted from the start', () => {
    activateConsent('granted');
    const store = new SyncJsonCookie<{ v: number }>('sjc_granted', () => '');

    store.write({ v: 2 });

    expect(readRawCookie('sjc_granted')).toEqual(JSON.stringify({ v: 2 }));
  });

  describe('pending', () => {
    it('keeps a write in memory and serves reads from there', () => {
      activateConsent('pending');
      const store = new SyncJsonCookie<{ v: number }>('sjc_pending', () => '');

      store.write({ v: 1 });

      expect(readRawCookie('sjc_pending')).toBeUndefined();
      expect(store.read()).toEqual({ v: 1 });
    });

    it('does not consult a cookie left by an earlier consented session', () => {
      writeRawCookie('sjc_prior', JSON.stringify({ v: 9 }));
      activateConsent('pending');

      const store = new SyncJsonCookie<{ v: number }>('sjc_prior', () => '');

      expect(store.read()).toBeUndefined();
    });

    it('does not issue an expiry on clear', () => {
      writeRawCookie('sjc_clear', JSON.stringify({ v: 9 }));
      activateConsent('pending');
      const store = new SyncJsonCookie<{ v: number }>('sjc_clear', () => '');
      store.write({ v: 1 });

      store.clear();

      expect(store.read()).toBeUndefined();
      // The pre-existing cookie is left for denial cleanup to remove.
      expect(readRawCookie('sjc_clear')).toEqual(JSON.stringify({ v: 9 }));
    });

    it('does not resolve the cookie domain, which would probe by writing', () => {
      activateConsent('pending');
      const getDomain = jest.fn(() => '');
      const store = new SyncJsonCookie<number>('sjc_domain', getDomain);

      store.write(1);
      store.clear();

      expect(getDomain).not.toHaveBeenCalled();
    });
  });

  describe('grant', () => {
    it('promotes the deferred value to a cookie, keeping the same id', () => {
      activateConsent('pending');
      const store = new SyncJsonCookie<{ sessionId: string }>(
        'sjc_flush',
        () => '',
      );
      store.write({ sessionId: 'abc' });

      consentGate.manager.setStatus('granted');

      expect(readRawCookie('sjc_flush')).toEqual(
        JSON.stringify({ sessionId: 'abc' }),
      );
      expect(store.read()).toEqual({ sessionId: 'abc' });
    });

    it('flushes the latest value when several writes were deferred', () => {
      activateConsent('pending');
      const store = new SyncJsonCookie<number>('sjc_latest', () => '');
      store.write(1);
      store.write(2);

      consentGate.manager.setStatus('granted');

      expect(readRawCookie('sjc_latest')).toEqual('2');
    });

    it('writes through directly afterwards', () => {
      activateConsent('pending');
      const store = new SyncJsonCookie<number>('sjc_after', () => '');
      consentGate.manager.setStatus('granted');

      store.write(5);

      expect(readRawCookie('sjc_after')).toEqual('5');
    });

    it('has nothing to flush when no write was deferred', () => {
      activateConsent('pending');
      new SyncJsonCookie<number>('sjc_untouched', () => '');

      consentGate.manager.setStatus('granted');

      expect(readRawCookie('sjc_untouched')).toBeUndefined();
    });

    it('reads the cookie afterwards, including one written before the visit', () => {
      writeRawCookie('sjc_prior_grant', JSON.stringify({ v: 9 }));
      activateConsent('pending');
      const store = new SyncJsonCookie<{ v: number }>(
        'sjc_prior_grant',
        () => '',
      );
      expect(store.read()).toBeUndefined();

      consentGate.manager.setStatus('granted');

      expect(store.read()).toEqual({ v: 9 });
    });
  });

  describe('denial', () => {
    it('does not promote the deferred value to a cookie', () => {
      activateConsent('pending');
      const store = new SyncJsonCookie<number>('sjc_denied', () => '');
      store.write(1);

      consentGate.manager.setStatus('denied');

      expect(readRawCookie('sjc_denied')).toBeUndefined();
    });
  });
});
