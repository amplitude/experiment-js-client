import * as experimentCore from '@amplitude/experiment-core';

import { createMockGlobal } from '../util/mocks';

import { consentGate } from 'src/consent/consent-gate';
import {
  getStorageItem,
  removeStorageItem,
  setStorageItem,
} from 'src/util/storage';
import {
  PREVIEW_MODE_SESSION_KEY,
  VISUAL_EDITOR_SESSION_KEY,
} from 'src/util/storage-keys';

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

    it('drops later writes rather than persisting them', () => {
      // A visitor who withdraws consent leaves a client already running; erasing
      // its data would achieve nothing if that client kept writing.
      activateConsent('granted');
      consentGate.manager.setStatus('denied');

      setStorageItem('localStorage', 'k', { a: 1 });

      expect(globalScope.localStorage.setItem).not.toHaveBeenCalled();
      expect(getStorageItem('localStorage', 'k')).toBeNull();
    });

    it('reads as absent rather than returning persisted data', () => {
      globalScope.localStorage.setItem('k', JSON.stringify({ prior: true }));
      activateConsent('granted');
      consentGate.manager.setStatus('denied');

      expect(getStorageItem('localStorage', 'k')).toBeNull();
    });

    it('still removes from real storage, which is how cleanup erases data', () => {
      globalScope.localStorage.setItem('k', JSON.stringify({ prior: true }));
      activateConsent('granted');
      consentGate.manager.setStatus('denied');

      removeStorageItem('localStorage', 'k');

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

  describe('exempt keys', () => {
    // Amplitude's own tooling state, entered deliberately through a URL param by
    // the person building the experiment — not something a banner asks about.
    it.each([
      ['preview mode', PREVIEW_MODE_SESSION_KEY],
      ['visual editor', VISUAL_EDITOR_SESSION_KEY],
    ])('reads and writes %s state while pending', (_name, key) => {
      activateConsent('pending');

      setStorageItem('sessionStorage', key, { on: true });

      expect(globalScope.sessionStorage.getItem(key)).toEqual(
        JSON.stringify({ on: true }),
      );
      expect(getStorageItem('sessionStorage', key)).toEqual({ on: true });
    });

    it('reads state written before the page loaded, so it survives the redirect', () => {
      // The PREVIEW param is stripped from the URL, so the only way the editor
      // knows it is in preview on the next page is this key.
      globalScope.sessionStorage.setItem(
        PREVIEW_MODE_SESSION_KEY,
        JSON.stringify({ previewFlags: { flag: 'treatment' } }),
      );
      activateConsent('pending');

      expect(
        getStorageItem('sessionStorage', PREVIEW_MODE_SESSION_KEY),
      ).toEqual({ previewFlags: { flag: 'treatment' } });
    });

    it('removes state directly rather than only from the buffer', () => {
      globalScope.sessionStorage.setItem(PREVIEW_MODE_SESSION_KEY, '{}');
      activateConsent('pending');

      removeStorageItem('sessionStorage', PREVIEW_MODE_SESSION_KEY);

      expect(
        globalScope.sessionStorage.getItem(PREVIEW_MODE_SESSION_KEY),
      ).toBeNull();
    });

    it('writes through after consent is refused', () => {
      activateConsent('granted');
      consentGate.manager.setStatus('denied');

      setStorageItem('sessionStorage', VISUAL_EDITOR_SESSION_KEY, { on: true });

      expect(
        globalScope.sessionStorage.getItem(VISUAL_EDITOR_SESSION_KEY),
      ).toEqual(JSON.stringify({ on: true }));
    });

    it('does not gate a key that merely resembles an exempt one', () => {
      activateConsent('pending');

      setStorageItem('sessionStorage', `${PREVIEW_MODE_SESSION_KEY}-other`, 1);

      expect(
        globalScope.sessionStorage.getItem(`${PREVIEW_MODE_SESSION_KEY}-other`),
      ).toBeNull();
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
