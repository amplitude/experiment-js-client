import { activateConsent } from './consent-test-util';

import { EventStorageManager } from 'src/behavioral-targeting/event-storage';
import { SessionManager } from 'src/behavioral-targeting/session-manager';
import { consentGate } from 'src/consent/consent-gate';

const testApiKey = 'test-api-key';
const storageKey = `EXP_${testApiKey.slice(0, 10)}_rtbt_events`;
const sessionCookieKey = `EXP_${testApiKey.slice(0, 10)}_rtbt_session`;

const newStore = () =>
  new EventStorageManager(testApiKey, new SessionManager(testApiKey));

const persisted = (): { events: { event_type: string }[] } | undefined => {
  const raw = localStorage.getItem(storageKey);
  return raw ? JSON.parse(raw) : undefined;
};

const persistedTypes = (): string[] | undefined =>
  persisted()?.events.map((e) => e.event_type);

/** A store as an earlier, consented visit would have left it. */
const seedPersistedEvents = () => {
  localStorage.setItem(
    storageKey,
    JSON.stringify({
      events: [
        {
          uuid: 'prior-uuid',
          id: 1,
          event_type: 'prior',
          timestamp: 1,
          session_id: 's1',
          properties: {},
        },
      ],
      nextId: 2,
    }),
  );
};

describe('EventStorageManager consent gating', () => {
  beforeEach(() => {
    consentGate.reset();
    localStorage.clear();
    sessionStorage.clear();
    document.cookie = `${sessionCookieKey}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('persists events when consent gating was never activated', () => {
    const store = newStore();

    store.addEvent('click');
    store.flush();

    expect(persistedTypes()).toEqual(['click']);
  });

  it('persists events when consent was granted from the start', () => {
    activateConsent('granted');
    const store = newStore();

    store.addEvent('click');
    store.flush();

    expect(persistedTypes()).toEqual(['click']);
  });

  describe('pending', () => {
    it('keeps events in memory and off the device', () => {
      activateConsent('pending');
      const store = newStore();

      store.addEvent('click');
      store.flush();

      expect(persisted()).toBeUndefined();
      // The events stay targetable for the rest of the page.
      expect(store.getEventCount('click')).toBe(1);
    });

    it('does not load the events of an earlier consented visit', () => {
      seedPersistedEvents();
      activateConsent('pending');

      const store = newStore();

      expect(store.getAllEvents()).toEqual([]);
      // Left intact for denial cleanup to remove.
      expect(persistedTypes()).toEqual(['prior']);
    });

    it('does not rewrite the store to backfill uuids on load', () => {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          events: [
            { id: 1, event_type: 'prior', timestamp: 1, properties: {} },
          ],
          nextId: 2,
        }),
      );
      const before = localStorage.getItem(storageKey);
      activateConsent('pending');

      newStore();

      expect(localStorage.getItem(storageKey)).toEqual(before);
    });
  });

  describe('grant', () => {
    it('persists the events gathered while pending, then writes through directly', () => {
      activateConsent('pending');
      const store = newStore();
      store.addEvent('first');
      store.addEvent('second');
      store.flush();

      consentGate.manager.setStatus('granted');

      expect(persistedTypes()).toEqual(['first', 'second']);

      store.addEvent('third');
      store.flush();
      expect(persistedTypes()).toEqual(['first', 'second', 'third']);
    });
  });

  describe('denial', () => {
    it('keeps later events in memory rather than persisting them', () => {
      // Revocation leaves a running client; it must stop writing, or cleanup
      // would simply be undone.
      activateConsent('granted');
      consentGate.manager.setStatus('denied');
      const store = newStore();

      store.addEvent('click');
      store.flush();

      expect(persisted()).toBeUndefined();
      expect(store.getEventCount('click')).toBe(1);
    });

    it('does not persist on cleanup, which runs as the client is torn down', () => {
      activateConsent('pending');
      const store = newStore();
      store.addEvent('click');
      consentGate.manager.setStatus('denied');

      store.cleanup();

      expect(persisted()).toBeUndefined();
    });

    it('does not resurrect pending-window events after denial and a later re-grant', () => {
      activateConsent('pending');
      const store = newStore();
      store.addEvent('before-denial');
      consentGate.manager.setStatus('denied');
      consentGate.manager.setStatus('granted');

      store.addEvent('after-grant');
      store.flush();

      expect(persistedTypes()).toEqual(['after-grant']);
    });
  });
});
