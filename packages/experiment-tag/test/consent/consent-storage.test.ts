import * as experimentCore from '@amplitude/experiment-core';

import { createMockGlobal } from '../util/mocks';

import { consentGate } from 'src/consent/consent-gate';
import {
  getStorageItem,
  removeStorageItem,
  setStorageItem,
} from 'src/util/storage';

describe('consent-gated storage helpers', () => {
  let globalScope: ReturnType<typeof createMockGlobal>;

  beforeEach(() => {
    jest.restoreAllMocks();
    consentGate.reset();
    globalScope = createMockGlobal();
    jest
      .spyOn(experimentCore, 'getGlobalScope')
      .mockReturnValue(globalScope as never);
  });

  /** Puts the gate in the state `initialize` leaves it in for a given status. */
  const activateConsent = (status: 'pending' | 'granted' | 'denied') => {
    consentGate.required = true;
    consentGate.manager.seedFromConfig(status);
  };

  describe('feature off', () => {
    it('writes and reads through when consent gating was never activated', () => {
      // The manager reports 'pending' for everyone until told otherwise, so this
      // is the case that would break every existing customer if the gates keyed
      // off the status alone.
      expect(consentGate.manager.getStatus()).toEqual('pending');

      setStorageItem('localStorage', 'k', { a: 1 });

      expect(globalScope.localStorage.getItem('k')).toEqual(
        JSON.stringify({ a: 1 }),
      );
      expect(getStorageItem('localStorage', 'k')).toEqual({ a: 1 });
    });

    it('removes through when consent gating was never activated', () => {
      globalScope.localStorage.setItem('k', '1');

      removeStorageItem('localStorage', 'k');

      expect(globalScope.localStorage.getItem('k')).toBeNull();
    });
  });

  describe('pending', () => {
    it('buffers writes without touching real storage, and reads them back', () => {
      activateConsent('pending');

      setStorageItem('localStorage', 'k', { a: 1 });
      setStorageItem('sessionStorage', 's', 'v');

      expect(globalScope.localStorage.setItem).not.toHaveBeenCalled();
      expect(globalScope.sessionStorage.setItem).not.toHaveBeenCalled();
      expect(getStorageItem('localStorage', 'k')).toEqual({ a: 1 });
      expect(getStorageItem('sessionStorage', 's')).toEqual('v');
    });

    it('keys the buffer by storage type, so the same key in both stores is distinct', () => {
      activateConsent('pending');

      setStorageItem('localStorage', 'k', 'local');
      setStorageItem('sessionStorage', 'k', 'session');

      expect(getStorageItem('localStorage', 'k')).toEqual('local');
      expect(getStorageItem('sessionStorage', 'k')).toEqual('session');
    });

    it('does not read data an earlier consented session left behind', () => {
      globalScope.localStorage.setItem('k', JSON.stringify({ stale: true }));
      activateConsent('pending');

      expect(getStorageItem('localStorage', 'k')).toBeNull();
      expect(globalScope.localStorage.getItem).not.toHaveBeenCalled();
    });

    it('returns a fresh copy per read, so a caller mutating it cannot corrupt the buffer', () => {
      activateConsent('pending');
      setStorageItem('localStorage', 'k', { a: 1 });

      const first = getStorageItem<{ a: number }>('localStorage', 'k');
      (first as { a: number }).a = 999;

      expect(getStorageItem('localStorage', 'k')).toEqual({ a: 1 });
    });

    it('drops a buffered write on remove, leaving the persisted key alone', () => {
      globalScope.localStorage.setItem('k', 'persisted');
      activateConsent('pending');
      setStorageItem('localStorage', 'k', 1);

      removeStorageItem('localStorage', 'k');

      expect(getStorageItem('localStorage', 'k')).toBeNull();
      expect(globalScope.localStorage.getItem('k')).toEqual('persisted');
      expect(globalScope.localStorage.removeItem).not.toHaveBeenCalled();
    });

    it('keeps the last write when a key is written more than once', () => {
      activateConsent('pending');

      setStorageItem('localStorage', 'k', 1);
      setStorageItem('localStorage', 'k', 2);

      expect(getStorageItem('localStorage', 'k')).toEqual(2);
    });
  });

  describe('grant', () => {
    it('flushes buffered writes to the store each was destined for', () => {
      activateConsent('pending');
      setStorageItem('localStorage', 'k', { a: 1 });
      setStorageItem('sessionStorage', 's', 'v');

      consentGate.manager.setStatus('granted');

      expect(globalScope.localStorage.getItem('k')).toEqual(
        JSON.stringify({ a: 1 }),
      );
      expect(globalScope.sessionStorage.getItem('s')).toEqual(
        JSON.stringify('v'),
      );
    });

    it('writes through directly afterwards', () => {
      activateConsent('pending');
      consentGate.manager.setStatus('granted');

      setStorageItem('localStorage', 'k2', 2);

      expect(globalScope.localStorage.getItem('k2')).toEqual('2');
    });

    it('reads real storage afterwards, including data written before the visit', () => {
      globalScope.localStorage.setItem('k', JSON.stringify({ prior: true }));
      activateConsent('pending');
      expect(getStorageItem('localStorage', 'k')).toBeNull();

      consentGate.manager.setStatus('granted');

      expect(getStorageItem('localStorage', 'k')).toEqual({ prior: true });
    });

    it('does not flush a key that was removed while pending', () => {
      activateConsent('pending');
      setStorageItem('localStorage', 'k', 1);
      removeStorageItem('localStorage', 'k');

      consentGate.manager.setStatus('granted');

      expect(globalScope.localStorage.getItem('k')).toBeNull();
    });
  });

  describe('denial', () => {
    it('discards buffered writes instead of flushing them', () => {
      activateConsent('pending');
      setStorageItem('localStorage', 'k', { a: 1 });

      consentGate.manager.setStatus('denied');

      expect(globalScope.localStorage.setItem).not.toHaveBeenCalled();
      expect(globalScope.localStorage.getItem('k')).toBeNull();
    });

    it('does not replay the discarded buffer if consent is granted later', () => {
      activateConsent('pending');
      setStorageItem('localStorage', 'k', { a: 1 });
      consentGate.manager.setStatus('denied');

      consentGate.manager.setStatus('granted');

      expect(globalScope.localStorage.getItem('k')).toBeNull();
    });
  });

  describe('reset', () => {
    it('re-arms against the replacement manager, so a later grant still flushes', () => {
      activateConsent('pending');
      setStorageItem('localStorage', 'stale', 1);

      consentGate.reset();
      activateConsent('pending');
      setStorageItem('localStorage', 'fresh', 2);
      consentGate.manager.setStatus('granted');

      expect(globalScope.localStorage.getItem('fresh')).toEqual('2');
      // The buffer from before the reset is gone rather than flushed alongside.
      expect(globalScope.localStorage.getItem('stale')).toBeNull();
    });
  });
});
