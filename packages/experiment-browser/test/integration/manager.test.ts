import { safeGlobal } from '@amplitude/experiment-core';
import { ExperimentConfig } from 'src/config';
import { ExperimentClient } from 'src/experimentClient';
import {
  IntegrationManager,
  PersistentTrackingQueue,
  SessionDedupeCache,
} from 'src/integration/manager';
import { ExperimentEvent } from 'src/types/plugin';

describe('IntegrationManager', () => {
  let manager: IntegrationManager;
  beforeEach(() => {
    safeGlobal.sessionStorage.clear();
    safeGlobal.localStorage.clear();
    const config = { test: 'config' } as ExperimentConfig;
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const client = { test: 'client' } as ExperimentClient;
    manager = new IntegrationManager(config, client);
  });

  describe('ready', () => {
    test('no integration, resolved', async () => {
      await Promise.race([
        manager.ready(),
        new Promise((_, reject) => setTimeout(() => reject('timeout'), 100)),
      ]);
    });
  });
  describe('setIntegration', () => {
    test('no, integration, setup not defined, ready resolves', async () => {
      manager.setIntegration({
        type: 'integration',
        getUser: () => {
          return {};
        },
        track: (): boolean => {
          return true;
        },
      });
      await Promise.race([
        manager.ready(),
        new Promise((_, reject) => setTimeout(() => reject('timeout'), 100)),
      ]);
      expect(manager['queue']['tracker']).toBeDefined();
    });
    test('no integration, setup defined, setup called', async () => {
      let setupCalled = false;
      manager.setIntegration({
        type: 'integration',
        setup: async () => {
          setupCalled = true;
        },
        getUser: () => {
          return {};
        },
        track: (): boolean => {
          return true;
        },
      });
      await Promise.race([
        manager.ready(),
        new Promise((_, reject) => setTimeout(() => reject('timeout'), 100)),
      ]);
      expect(setupCalled).toBe(true);
      expect(manager['queue']['tracker']).toBeDefined();
    });
    test('setup throws, resolved', async () => {
      let setupCalled = false;
      manager.setIntegration({
        type: 'integration',
        setup: async () => {
          setupCalled = true;
          throw new Error('failure');
        },
        getUser: () => {
          return {};
        },
        track: (): boolean => {
          return true;
        },
      });
      await Promise.race([
        manager.ready(),
        new Promise((_, reject) => setTimeout(() => reject('timeout'), 100)),
      ]);
      expect(setupCalled).toBe(true);
      expect(manager['queue']['tracker']).toBeDefined();
    });
    test('existing integration teardown called', async () => {
      let teardownCalled = false;
      manager.setIntegration({
        type: 'integration',
        teardown: async () => {
          teardownCalled = true;
        },
        getUser: () => {
          return {};
        },
        track: (): boolean => {
          return true;
        },
      });
      manager.setIntegration({
        type: 'integration',
        getUser: () => {
          return {};
        },
        track: (): boolean => {
          return true;
        },
      });
      expect(teardownCalled).toBe(true);
    });
    test('existing integration without teardown', async () => {
      manager.setIntegration({
        type: 'integration',
        getUser: () => {
          return {};
        },
        track: (): boolean => {
          return true;
        },
      });
      manager.setIntegration({
        type: 'integration',
        getUser: () => {
          return {};
        },
        track: (): boolean => {
          return true;
        },
      });
    });
  });
  describe('getUser', () => {
    test('no integration, returns empty object', async () => {
      expect(manager.getUser()).toEqual({});
    });
    test('with integration, calls integration', async () => {
      manager.setIntegration({
        type: 'integration',
        getUser: () => {
          return {
            user_id: 'userId',
            device_id: 'deviceId',
          };
        },
        track: (): boolean => {
          return true;
        },
      });
      expect(manager.getUser()).toEqual({
        user_id: 'userId',
        device_id: 'deviceId',
      });
    });
  });
  describe('track', () => {
    test('correct event pushed to queue', async () => {
      manager.track({
        flag_key: 'flag-key',
        variant: 'treatment',
        experiment_key: 'exp-1',
        metadata: {
          test: 'test',
        },
      });
      expect(manager['queue']['inMemoryQueue'][0]).toEqual({
        eventType: '$exposure',
        eventProperties: {
          flag_key: 'flag-key',
          variant: 'treatment',
          experiment_key: 'exp-1',
          metadata: {
            test: 'test',
          },
        },
      });
    });
    test('web exposure tracked as impression', () => {
      manager.track({
        flag_key: 'flag-key',
        variant: 'treatment',
        experiment_key: 'exp-1',
        metadata: {
          deliveryMethod: 'web',
        },
      });
      expect(manager['queue']['inMemoryQueue'][0]).toEqual({
        eventType: '$impression',
        eventProperties: {
          flag_key: 'flag-key',
          variant: 'treatment',
          experiment_key: 'exp-1',
          metadata: {
            deliveryMethod: 'web',
          },
        },
      });
    });
    test('un exposure is deduped', () => {
      manager.track({ flag_key: 'flag-key' });
      manager.track({ flag_key: 'flag-key' });
      manager.track({ flag_key: 'flag-key' });
      expect(manager['queue']['inMemoryQueue'].length).toEqual(1);
      expect(manager['queue']['inMemoryQueue'][0]).toEqual({
        eventType: '$exposure',
        eventProperties: {
          flag_key: 'flag-key',
        },
      });
    });
    test('different variant values for same key are all tracked', () => {
      manager.track({ flag_key: 'flag-key' });
      manager.track({ flag_key: 'flag-key', variant: 'control' });
      manager.track({ flag_key: 'flag-key' });
      manager.track({ flag_key: 'flag-key', variant: 'control' });
      manager.track({ flag_key: 'flag-key', variant: 'treatment' });
      expect(manager['queue']['inMemoryQueue'].length).toEqual(5);
      expect(manager['queue']['inMemoryQueue'][0]).toEqual({
        eventType: '$exposure',
        eventProperties: {
          flag_key: 'flag-key',
        },
      });
      expect(manager['queue']['inMemoryQueue'][1]).toEqual({
        eventType: '$exposure',
        eventProperties: {
          flag_key: 'flag-key',
          variant: 'control',
        },
      });
      expect(manager['queue']['inMemoryQueue'][2]).toEqual({
        eventType: '$exposure',
        eventProperties: {
          flag_key: 'flag-key',
        },
      });
      expect(manager['queue']['inMemoryQueue'][3]).toEqual({
        eventType: '$exposure',
        eventProperties: {
          flag_key: 'flag-key',
          variant: 'control',
        },
      });
      expect(manager['queue']['inMemoryQueue'][4]).toEqual({
        eventType: '$exposure',
        eventProperties: {
          flag_key: 'flag-key',
          variant: 'treatment',
        },
      });
    });
  });
});

describe('SessionDedupeCache', () => {
  beforeEach(() => {
    safeGlobal.sessionStorage.clear();
  });
  test('old v1 storage is cleared', () => {
    const instanceName = '$default_instance';
    safeGlobal.sessionStorage.setItem(
      'EXP_sent_$default_instance',
      `{"flag-key":"variant"}`,
    );
    new SessionDedupeCache(instanceName);
    expect(
      safeGlobal.sessionStorage.getItem('EXP_sent_$default_instance'),
    ).toBeNull();
  });
  test('old v2 storage is cleared', () => {
    const instanceName = '$default_instance';
    safeGlobal.sessionStorage.setItem(
      'EXP_sent_v2_$default_instance',
      `{"flag-key":{"flag_key":"flag-key","variant":"on"}}`,
    );
    new SessionDedupeCache(instanceName);
    expect(
      safeGlobal.sessionStorage.getItem('EXP_sent_v2_$default_instance'),
    ).toBeNull();
  });
  test('test storage key', () => {
    const instanceName = '$default_instance';
    const cache = new SessionDedupeCache(instanceName);
    expect(cache['storageKey']).toEqual('EXP_sent_v3_$default_instance');
  });
  test('should track with empty storage returns true, sets storage', () => {
    const instanceName = '$default_instance';
    const cache = new SessionDedupeCache(instanceName);
    const exposure = {
      flag_key: 'flag-key',
      variant: 'on',
    };
    expect(cache.shouldTrack(exposure)).toEqual(true);
    const storedCache = JSON.parse(
      safeGlobal.sessionStorage.getItem(cache['storageKey']),
    );
    const expected = { 'flag-key': 'on' };
    expect(storedCache).toEqual(expected);
    expect(cache['inMemoryCache']).toEqual(expected);
  });
  test('should track with entry in storage returns false, storage unchanged', () => {
    const instanceName = '$default_instance';
    const cache = new SessionDedupeCache(instanceName);
    const exposure = {
      flag_key: 'flag-key',
      variant: 'on',
    };
    safeGlobal.sessionStorage.setItem(
      cache['storageKey'],
      JSON.stringify({ 'flag-key': 'on' }),
    );
    expect(cache.shouldTrack(exposure)).toEqual(false);
    const storedCache = JSON.parse(
      safeGlobal.sessionStorage.getItem(cache['storageKey']),
    );
    const expected = { 'flag-key': 'on' };
    expect(storedCache).toEqual(expected);
    expect(cache['inMemoryCache']).toEqual(expected);
  });
  test('should track with different entry in storage returns true, sets storage', () => {
    const instanceName = '$default_instance';
    const cache = new SessionDedupeCache(instanceName);
    const exposure = {
      flag_key: 'flag-key',
      variant: 'on',
    };
    safeGlobal.sessionStorage.setItem(
      cache['storageKey'],
      JSON.stringify({ 'flag-key-2': 'on' }),
    );
    expect(cache.shouldTrack(exposure)).toEqual(true);
    const storedCache = JSON.parse(
      safeGlobal.sessionStorage.getItem(cache['storageKey']),
    );
    const expected = {
      'flag-key': 'on',
      'flag-key-2': 'on',
    };
    expect(storedCache).toEqual(expected);
    expect(cache['inMemoryCache']).toEqual(expected);
  });
  test('should track with web delivery method exposure, always true', () => {
    const instanceName = '$default_instance';
    const cache = new SessionDedupeCache(instanceName);
    const exposure = {
      flag_key: 'flag-key',
      variant: 'on',
      metadata: {
        deliveryMethod: 'web',
      },
    };
    expect(cache.shouldTrack(exposure)).toEqual(true);
    expect(safeGlobal.sessionStorage.getItem(cache['storageKey'])).toBeNull();
    expect(cache.shouldTrack(exposure)).toEqual(true);
    expect(safeGlobal.sessionStorage.getItem(cache['storageKey'])).toBeNull();
  });
  test('should track undefined variant, then dedupe subsequent undefined variants', () => {
    const instanceName = '$default_instance';
    const cache = new SessionDedupeCache(instanceName);
    const exposure = {
      flag_key: 'flag-key',
      variant: undefined,
    };
    // First call should track
    expect(cache.shouldTrack(exposure)).toEqual(true);
    // Subsequent calls should dedupe
    expect(cache.shouldTrack(exposure)).toEqual(false);
    expect(cache.shouldTrack(exposure)).toEqual(false);
    // Changing to a defined variant should track
    const exposureWithVariant = {
      flag_key: 'flag-key',
      variant: 'on',
    };
    expect(cache.shouldTrack(exposureWithVariant)).toEqual(true);
    // Changing back to undefined should track
    expect(cache.shouldTrack(exposure)).toEqual(true);
    expect(cache.shouldTrack(exposure)).toEqual(false);
  });
  test('should track null variant, then dedupe subsequent null variants', () => {
    const instanceName = '$default_instance';
    const cache = new SessionDedupeCache(instanceName);
    const exposure = {
      flag_key: 'flag-key',
      variant: null as unknown as string,
    };
    // First call should track
    expect(cache.shouldTrack(exposure)).toEqual(true);
    // Subsequent calls should dedupe
    expect(cache.shouldTrack(exposure)).toEqual(false);
    expect(cache.shouldTrack(exposure)).toEqual(false);
    // Changing to a defined variant should track
    const exposureWithVariant = {
      flag_key: 'flag-key',
      variant: 'on',
    };
    expect(cache.shouldTrack(exposureWithVariant)).toEqual(true);
    // Changing back to null should track
    expect(cache.shouldTrack(exposure)).toEqual(true);
    expect(cache.shouldTrack(exposure)).toEqual(false);
  });
  test('should treat null and undefined variants as equivalent', () => {
    const instanceName = '$default_instance';
    const cache = new SessionDedupeCache(instanceName);
    const exposureUndefined = {
      flag_key: 'flag-key',
      variant: undefined,
    };
    const exposureNull = {
      flag_key: 'flag-key',
      variant: null as unknown as string,
    };
    // First call with undefined should track
    expect(cache.shouldTrack(exposureUndefined)).toEqual(true);
    // Subsequent call with null should dedupe (null and undefined are equivalent)
    expect(cache.shouldTrack(exposureNull)).toEqual(false);
    // Subsequent call with undefined should also dedupe
    expect(cache.shouldTrack(exposureUndefined)).toEqual(false);
  });
  test('should gracefully handle storage quota exceeded error', () => {
    const instanceName = '$default_instance';
    const cache = new SessionDedupeCache(instanceName);
    // Mock sessionStorage.setItem to throw QuotaExceededError
    const originalSetItem = safeGlobal.sessionStorage.setItem;
    safeGlobal.sessionStorage.setItem = jest.fn(() => {
      const error = new Error('QuotaExceededError');
      error.name = 'QuotaExceededError';
      throw error;
    });
    const exposure = {
      flag_key: 'flag-key',
      variant: 'on',
    };
    // Should not throw, and should still return true for first call
    expect(() => cache.shouldTrack(exposure)).not.toThrow();
    expect(cache.shouldTrack(exposure)).toEqual(false); // In-memory cache still works
    // Restore original setItem
    safeGlobal.sessionStorage.setItem = originalSetItem;
  });

  // User-aware deduplication tests
  describe('user-aware deduplication', () => {
    test('same user_id, same flag+variant is deduplicated', () => {
      const cache = new SessionDedupeCache('$default_instance');
      const exposure = { flag_key: 'flag-key', variant: 'on' };
      const user = { user_id: 'user-1', device_id: 'device-1' };

      expect(cache.shouldTrack(exposure, user)).toEqual(true);
      expect(cache.shouldTrack(exposure, user)).toEqual(false);
      expect(cache.shouldTrack(exposure, user)).toEqual(false);
    });

    test('same user_id but different device_id is still deduplicated (user_id priority)', () => {
      const cache = new SessionDedupeCache('$default_instance');
      const exposure = { flag_key: 'flag-key', variant: 'on' };
      const user1 = { user_id: 'user-1', device_id: 'device-1' };
      const user2 = { user_id: 'user-1', device_id: 'device-2' };

      expect(cache.shouldTrack(exposure, user1)).toEqual(true);
      // Same user_id, different device_id should still dedupe
      expect(cache.shouldTrack(exposure, user2)).toEqual(false);
    });

    test('different user_id clears cache and tracks again', () => {
      const cache = new SessionDedupeCache('$default_instance');
      const exposure = { flag_key: 'flag-key', variant: 'on' };
      const user1 = { user_id: 'user-1', device_id: 'device-1' };
      const user2 = { user_id: 'user-2', device_id: 'device-1' };

      expect(cache.shouldTrack(exposure, user1)).toEqual(true);
      expect(cache.shouldTrack(exposure, user1)).toEqual(false);
      // Different user_id should clear cache and track again
      expect(cache.shouldTrack(exposure, user2)).toEqual(true);
      expect(cache.shouldTrack(exposure, user2)).toEqual(false);
    });

    test('no user_id, same device_id is deduplicated', () => {
      const cache = new SessionDedupeCache('$default_instance');
      const exposure = { flag_key: 'flag-key', variant: 'on' };
      const user1 = { device_id: 'device-1' };
      const user2 = { device_id: 'device-1' };

      expect(cache.shouldTrack(exposure, user1)).toEqual(true);
      expect(cache.shouldTrack(exposure, user2)).toEqual(false);
    });

    test('no user_id, different device_id clears cache and tracks again', () => {
      const cache = new SessionDedupeCache('$default_instance');
      const exposure = { flag_key: 'flag-key', variant: 'on' };
      const user1 = { device_id: 'device-1' };
      const user2 = { device_id: 'device-2' };

      expect(cache.shouldTrack(exposure, user1)).toEqual(true);
      expect(cache.shouldTrack(exposure, user1)).toEqual(false);
      // Different device_id should clear cache and track again
      expect(cache.shouldTrack(exposure, user2)).toEqual(true);
      expect(cache.shouldTrack(exposure, user2)).toEqual(false);
    });

    test('user gains user_id clears cache', () => {
      const cache = new SessionDedupeCache('$default_instance');
      const exposure = { flag_key: 'flag-key', variant: 'on' };
      const anonymousUser = { device_id: 'device-1' };
      const loggedInUser = { user_id: 'user-1', device_id: 'device-1' };

      expect(cache.shouldTrack(exposure, anonymousUser)).toEqual(true);
      expect(cache.shouldTrack(exposure, anonymousUser)).toEqual(false);
      // User logs in (gains user_id) - cache should clear
      expect(cache.shouldTrack(exposure, loggedInUser)).toEqual(true);
      expect(cache.shouldTrack(exposure, loggedInUser)).toEqual(false);
    });

    test('user loses user_id clears cache', () => {
      const cache = new SessionDedupeCache('$default_instance');
      const exposure = { flag_key: 'flag-key', variant: 'on' };
      const loggedInUser = { user_id: 'user-1', device_id: 'device-1' };
      const anonymousUser = { device_id: 'device-1' };

      expect(cache.shouldTrack(exposure, loggedInUser)).toEqual(true);
      expect(cache.shouldTrack(exposure, loggedInUser)).toEqual(false);
      // User logs out (loses user_id) - cache should clear
      expect(cache.shouldTrack(exposure, anonymousUser)).toEqual(true);
      expect(cache.shouldTrack(exposure, anonymousUser)).toEqual(false);
    });

    test('identity change clears both in-memory and session storage', () => {
      const cache = new SessionDedupeCache('$default_instance');
      const exposure = { flag_key: 'flag-key', variant: 'on' };
      const user1 = { user_id: 'user-1' };
      const user2 = { user_id: 'user-2' };

      // Track for user1
      cache.shouldTrack(exposure, user1);
      expect(cache['inMemoryCache']).toEqual({ 'flag-key': 'on' });
      expect(
        safeGlobal.sessionStorage.getItem(cache['storageKey']),
      ).not.toBeNull();

      // Switch to user2 - should clear everything
      cache.shouldTrack(exposure, user2);
      // After clearing, it should have stored the new exposure
      expect(cache['inMemoryCache']).toEqual({ 'flag-key': 'on' });
    });

    test('no user provided deduplicates with other no-user calls', () => {
      const cache = new SessionDedupeCache('$default_instance');
      const exposure = { flag_key: 'flag-key', variant: 'on' };

      expect(cache.shouldTrack(exposure)).toEqual(true);
      expect(cache.shouldTrack(exposure)).toEqual(false);
      expect(cache.shouldTrack(exposure, undefined)).toEqual(false);
      expect(cache.shouldTrack(exposure, {})).toEqual(false);
    });

    test('user with empty object deduplicates with undefined user', () => {
      const cache = new SessionDedupeCache('$default_instance');
      const exposure = { flag_key: 'flag-key', variant: 'on' };

      expect(cache.shouldTrack(exposure, {})).toEqual(true);
      expect(cache.shouldTrack(exposure, undefined)).toEqual(false);
      expect(cache.shouldTrack(exposure)).toEqual(false);
    });
  });
});

describe('PersistentTrackingQueue', () => {
  beforeEach(() => {
    safeGlobal.localStorage.clear();
  });

  test('test storage key', () => {
    const instanceName = '$default_instance';
    const queue = new PersistentTrackingQueue(instanceName);
    expect(queue['storageKey']).toEqual('EXP_unsent_$default_instance');
  });

  test('push, no tracker', () => {
    const instanceName = '$default_instance';
    const queue = new PersistentTrackingQueue(instanceName);
    const event: ExperimentEvent = {
      eventType: '$exposure',
      eventProperties: {
        flag_key: 'flag-key',
        variant: 'on',
      },
    };

    queue.push(event);
    expect(queue['inMemoryQueue']).toEqual([event]);
    expect(safeGlobal.localStorage.getItem(queue['storageKey'])).toEqual(
      JSON.stringify([event]),
    );

    queue.push(event);
    expect(queue['inMemoryQueue']).toEqual([event, event]);
    expect(safeGlobal.localStorage.getItem(queue['storageKey'])).toEqual(
      JSON.stringify([event, event]),
    );
  });

  test('push, with tracker returns false', () => {
    const instanceName = '$default_instance';
    const queue = new PersistentTrackingQueue(instanceName);
    const trackedEvents: ExperimentEvent[] = [];
    queue.setTracker((event) => {
      trackedEvents.push(event);
      return false;
    });
    const event: ExperimentEvent = {
      eventType: '$exposure',
      eventProperties: {
        flag_key: 'flag-key',
        variant: 'on',
      },
    };

    queue.push(event);
    expect(queue['inMemoryQueue']).toEqual([event]);
    expect(safeGlobal.localStorage.getItem(queue['storageKey'])).toEqual(
      JSON.stringify([event]),
    );
    expect(trackedEvents).toEqual([event]);

    queue.push(event);
    expect(queue['inMemoryQueue']).toEqual([event, event]);
    expect(safeGlobal.localStorage.getItem(queue['storageKey'])).toEqual(
      JSON.stringify([event, event]),
    );
    expect(trackedEvents).toEqual([event, event]);
  });

  test('push, with tracker returns true', () => {
    const instanceName = '$default_instance';
    const queue = new PersistentTrackingQueue(instanceName);
    const trackedEvents: ExperimentEvent[] = [];
    queue.setTracker((event) => {
      trackedEvents.push(event);
      return true;
    });
    const event: ExperimentEvent = {
      eventType: '$exposure',
      eventProperties: {
        flag_key: 'flag-key',
        variant: 'on',
      },
    };

    queue.push(event);
    expect(queue['inMemoryQueue']).toEqual([]);
    expect(safeGlobal.localStorage.getItem(queue['storageKey'])).toEqual(
      JSON.stringify([]),
    );
    expect(trackedEvents).toEqual([event]);

    queue.push(event);
    expect(queue['inMemoryQueue']).toEqual([]);
    expect(safeGlobal.localStorage.getItem(queue['storageKey'])).toEqual(
      JSON.stringify([]),
    );
    expect(trackedEvents).toEqual([event, event]);
  });

  test('push, late set tracker', () => {
    const instanceName = '$default_instance';
    const queue = new PersistentTrackingQueue(instanceName);
    const trackedEvents: ExperimentEvent[] = [];
    const event: ExperimentEvent = {
      eventType: '$exposure',
      eventProperties: {
        flag_key: 'flag-key',
        variant: 'on',
      },
    };

    queue.push(event);
    expect(queue['inMemoryQueue']).toEqual([event]);
    expect(safeGlobal.localStorage.getItem(queue['storageKey'])).toEqual(
      JSON.stringify([event]),
    );

    queue.setTracker((event) => {
      trackedEvents.push(event);
      return true;
    });

    queue.push(event);
    expect(queue['inMemoryQueue']).toEqual([]);
    expect(safeGlobal.localStorage.getItem(queue['storageKey'])).toEqual(
      JSON.stringify([]),
    );
    expect(trackedEvents).toEqual([event, event]);
  });

  test('oldest events over max queue size are trimmed', () => {
    const maxQueueSize = 5;
    const instanceName = '$default_instance';
    const queue = new PersistentTrackingQueue(instanceName, maxQueueSize);
    for (let i = 0; i < maxQueueSize + 1; i++) {
      queue.push({ eventType: `${i}` });
    }
    expect(queue['inMemoryQueue']).toEqual([
      { eventType: '1' },
      { eventType: '2' },
      { eventType: '3' },
      { eventType: '4' },
      { eventType: '5' },
    ]);
  });

  test('tracker returns false, event is not pushed', () => {
    const instanceName = '$default_instance';
    const queue = new PersistentTrackingQueue(instanceName);
    let count = 0;
    let success = 0;
    const returnValues = [false, true, false, true, true, true];
    queue.setTracker((event) => {
      if (returnValues[count++]) {
        success++;
        return true;
      }
      return false;
    });
    queue.push({ eventType: 'test' });
    expect(queue['inMemoryQueue'].length).toEqual(1);
    expect(success).toEqual(0);
    queue.push({ eventType: 'test1' });
    expect(queue['inMemoryQueue'].length).toEqual(1);
    expect(success).toEqual(1);
    queue.push({ eventType: 'test2' });
    expect(queue['inMemoryQueue'].length).toEqual(0);
    expect(success).toEqual(3);
  });
});
