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
    safeGlobal.sessionStorage.setItem(
      'EXP_sent_$default_instance',
      `{"flag-key":"variant"}`,
    );
    safeGlobal.sessionStorage.clear();
  });
  test('old storage is cleared', () => {
    const instanceName = '$default_instance';
    new SessionDedupeCache(instanceName);
    expect(
      safeGlobal.sessionStorage.getItem('EXP_sent_$default_instance'),
    ).toBeNull();
  });
  test('test storage key', () => {
    const instanceName = '$default_instance';
    const cache = new SessionDedupeCache(instanceName);
    expect(cache['storageKey']).toEqual('EXP_sent_v2_$default_instance');
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
    const expected = { 'flag-key': exposure };
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
      JSON.stringify({ [`${exposure.flag_key}`]: exposure }),
    );
    expect(cache.shouldTrack(exposure)).toEqual(false);
    const storedCache = JSON.parse(
      safeGlobal.sessionStorage.getItem(cache['storageKey']),
    );
    const expected = { 'flag-key': exposure };
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
    const exposure2 = {
      flag_key: 'flag-key-2',
      variant: 'on',
    };
    safeGlobal.sessionStorage.setItem(
      cache['storageKey'],
      JSON.stringify({ [exposure2.flag_key]: exposure2 }),
    );
    expect(cache.shouldTrack(exposure)).toEqual(true);
    const storedCache = JSON.parse(
      safeGlobal.sessionStorage.getItem(cache['storageKey']),
    );
    const expected = {
      'flag-key': exposure,
      'flag-key-2': exposure2,
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
});
