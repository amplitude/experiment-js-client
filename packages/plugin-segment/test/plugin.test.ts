import { safeGlobal } from '@amplitude/experiment-core';
import { ExperimentEvent } from '@amplitude/experiment-js-client';
import { Analytics } from '@segment/analytics-next';
import { segmentIntegrationPlugin } from 'src/plugin';
import { snippetInstance } from 'src/snippet';

const anonymousId = 'anon';
const userId = 'user';
const traits = { k: 'v' };

const impression: ExperimentEvent = {
  eventType: '$impression',
  eventProperties: { flag_key: 'flag-key', variant: 'on' },
};

const mockAnalytics = (isReady = true): Analytics =>
  ({
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
    track: () => Promise.resolve(),
  } as unknown as Analytics);

let instance: Analytics;

describe('SegmentIntegrationPlugin', () => {
  beforeEach(async () => {
    safeGlobal.analytics = undefined;
    safeGlobal.asdf = undefined;
    safeGlobal.localStorage.clear();
    instance = mockAnalytics();
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
});
