import { safeGlobal } from '@amplitude/experiment-core';
import { ExperimentEvent } from '@amplitude/experiment-js-client';
import { Analytics } from '@segment/analytics-next';

import { segmentIntegrationPlugin } from '../src/plugin';
import { PersistentTrackingQueue } from '../src/queue';
import { snippetInstance } from '../src/snippet';

export const sleep = (time: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, time);
  });

const anonymousId = 'anon';
const userId = 'user';
const traits = { k: 'v' };

const impression: ExperimentEvent = {
  eventType: '$impression',
  eventProperties: { flag_key: 'flag-key', variant: 'on' },
};

const mockAnalytics = (isReady = true): Analytics =>
  ({
    initialized: false,
    initialize: () => Promise.resolve({} as Analytics),
    ready: isReady
      ? (fn) => fn()
      : () => {
          // Do nothing
        },
    user: () => ({
      id: () => userId,
      anonymousId: () => anonymousId,
      traits: () => traits,
    }),
    track: jest.fn().mockImplementation(() => Promise.resolve()),
  } as unknown as Analytics);

let instance: Analytics;

describe('SegmentIntegrationPlugin', () => {
  beforeEach(async () => {
    safeGlobal.analytics = undefined;
    safeGlobal.asdf = undefined;
    safeGlobal.localStorage.clear();
    instance = mockAnalytics();
    jest.clearAllMocks();
  });

  test('name', async () => {
    const plugin = segmentIntegrationPlugin();
    expect(plugin.name).toEqual('@amplitude/experiment-plugin-segment');
  });
  test('type', async () => {
    const plugin = segmentIntegrationPlugin();
    expect(plugin.type).toEqual('integration');
  });
  test('sets analytics global if not already defined', async () => {
    segmentIntegrationPlugin();
    expect(safeGlobal.analytics).toBeDefined();
    const expected = snippetInstance();
    expect(safeGlobal.analytics).toEqual(expected);
    expect(JSON.stringify(safeGlobal.analytics)).toEqual(JSON.stringify([]));
  });
  test('does not set analytics global if not already defined', async () => {
    safeGlobal.analytics = ['test'];
    segmentIntegrationPlugin();
    expect(safeGlobal.analytics).toBeDefined();
    const expected = snippetInstance();
    expect(safeGlobal.analytics).toEqual(expected);
    expect(JSON.stringify(safeGlobal.analytics)).toEqual(
      JSON.stringify(['test']),
    );
  });
  test('with instance key, sets analytics global if not already defined', async () => {
    segmentIntegrationPlugin({ instanceKey: 'asdf' });
    expect(safeGlobal.analytics).toBeUndefined();
    expect(safeGlobal.asdf).toBeDefined();
    const expected = snippetInstance('asdf');
    expect(safeGlobal.asdf).toEqual(expected);
    expect(JSON.stringify(safeGlobal.asdf)).toEqual(JSON.stringify([]));
  });
  test('with instance key, does not set analytics global if not already defined', async () => {
    safeGlobal.asdf = ['test'];
    segmentIntegrationPlugin({ instanceKey: 'asdf' });
    expect(safeGlobal.analytics).toBeUndefined();
    expect(safeGlobal.asdf).toBeDefined();
    const expected = snippetInstance('asdf');
    expect(safeGlobal.asdf).toEqual(expected);
    expect(JSON.stringify(safeGlobal.asdf)).toEqual(JSON.stringify(['test']));
  });
  test('with instance config, does not set instance', async () => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    segmentIntegrationPlugin({ instance });
    expect(safeGlobal.analytics).toBeUndefined();
  });
  describe('setup', () => {
    test('no options, setup function exists', async () => {
      const plugin = segmentIntegrationPlugin();
      expect(plugin.setup).toBeDefined();
    });
    test('setup config false, setup function undefined', async () => {
      const plugin = segmentIntegrationPlugin({ skipSetup: true });
      expect(plugin.setup).toBeUndefined();
      expect(safeGlobal.analytics).toBeDefined();
    });
  });
  describe('getUser', () => {
    test('returns user from local storage', async () => {
      const plugin = segmentIntegrationPlugin();
      expect(plugin.getUser()).toEqual({});
      safeGlobal.localStorage.setItem(
        'ajs_anonymous_id',
        JSON.stringify(anonymousId),
      );
      safeGlobal.localStorage.setItem('ajs_user_id', JSON.stringify(userId));
      safeGlobal.localStorage.setItem(
        'ajs_user_traits',
        JSON.stringify(traits),
      );
      expect(plugin.getUser()).toEqual({
        user_id: userId,
        device_id: anonymousId,
        user_properties: traits,
      });
      safeGlobal.localStorage.setItem('ajs_user_id', JSON.stringify(null));
      expect(plugin.getUser()).toEqual({
        device_id: anonymousId,
        user_properties: traits,
      });
    });
    test('with instance, returns user from instance', async () => {
      const plugin = segmentIntegrationPlugin({ instance });
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      await plugin.setup();
      expect(plugin.getUser()).toEqual({
        user_id: userId,
        device_id: anonymousId,
        user_properties: traits,
      });
    });
    test('with instance, not initialized, returns user from local storage', async () => {
      instance = mockAnalytics(false);
      const plugin = segmentIntegrationPlugin({ instance });
      expect(plugin.getUser()).toEqual({});
    });
    test('without instance, initialized, returns user from instance', async () => {
      safeGlobal.analytics = mockAnalytics();
      const plugin = segmentIntegrationPlugin();
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      await plugin.setup();
      expect(plugin.getUser()).toEqual({
        user_id: userId,
        device_id: anonymousId,
        user_properties: traits,
      });
    });
  });
  describe('track', () => {
    test('without instance, not initialized, returns false', async () => {
      const plugin = segmentIntegrationPlugin();
      expect(plugin.track(impression)).toEqual(false);
    });
    test('without instance, initialized, returns true', async () => {
      safeGlobal.analytics = mockAnalytics();
      const plugin = segmentIntegrationPlugin();
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      await plugin.setup();
      expect(plugin.track(impression)).toEqual(true);
    });
    test('with instance, not initialized, returns false', async () => {
      instance = mockAnalytics(false);
      const plugin = segmentIntegrationPlugin({ instance });
      expect(plugin.track(impression)).toEqual(false);
    });
    test('with instance, initialized, returns false', async () => {
      const plugin = segmentIntegrationPlugin();
      expect(plugin.track(impression)).toEqual(false);
    });
  });
  describe('npm installation', () => {
    test('poller catches initialized instance', async () => {
      instance = mockAnalytics(false);
      const plugin = segmentIntegrationPlugin();
      let resolved = false;
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      plugin.setup().then(() => {
        resolved = true;
      });
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      window.analytics = instance;
      instance.initialized = true;
      await sleep(100);
      expect(resolved).toEqual(true);
    });
  });
  describe('PersistentTrackingQueue', () => {
    let queueSpy: jest.SpyInstance;

    beforeEach(() => {
      // Spy on the class constructor
      queueSpy = jest.spyOn(PersistentTrackingQueue.prototype, 'push');
    });

    afterEach(() => {
      queueSpy.mockRestore();
    });

    test('should initialize queue with default instance name', () => {
      const plugin = segmentIntegrationPlugin({ instance });
      // Verify storage key by checking localStorage
      plugin.track(impression);
      const storedEvents = JSON.parse(
        safeGlobal.localStorage.getItem('EXP_segment_unsent_analytics') || '[]',
      );
      expect(storedEvents).toEqual([impression]);
    });

    test('should queue events when Segment is not ready', () => {
      const plugin = segmentIntegrationPlugin({ instance });
      plugin.track(impression);
      expect(queueSpy).toHaveBeenCalledWith(impression);
    });

    test('should set up tracker when Segment becomes ready', async () => {
      const setTrackerSpy = jest
        .spyOn(PersistentTrackingQueue.prototype, 'setTracker')
        .mockImplementation((tracker) => {
          // Simulate immediate flush when tracker is set
          tracker(impression);
        });

      const plugin = segmentIntegrationPlugin({ instance });
      await plugin.setup();
      expect(setTrackerSpy).toHaveBeenCalled();

      setTrackerSpy.mockRestore();
    });

    test('should track events directly when Segment is ready', async () => {
      const plugin = segmentIntegrationPlugin({ instance });
      await plugin.setup();
      plugin.track(impression);
      expect(instance.track).toHaveBeenCalledWith('$impression', {
        flag_key: 'flag-key',
        variant: 'on',
      });
    });

    test('should store events in localStorage when Segment is not ready', () => {
      const plugin = segmentIntegrationPlugin({ instance });
      plugin.track(impression);
      const storedEvents = JSON.parse(
        safeGlobal.localStorage.getItem('EXP_segment_unsent_analytics') || '[]',
      );
      expect(storedEvents).toEqual([impression]);
    });

    test('should flush events when Segment becomes ready', async () => {
      const plugin = segmentIntegrationPlugin({ instance });
      plugin.track(impression);
      await plugin.setup();
      expect(instance.track).toHaveBeenCalledWith('$impression', {
        flag_key: 'flag-key',
        variant: 'on',
      });
      // Verify events are cleared from localStorage after flush
      const storedEvents = JSON.parse(
        safeGlobal.localStorage.getItem('EXP_segment_unsent_analytics') || '[]',
      );
      expect(storedEvents).toEqual([]);
    });
  });
});
