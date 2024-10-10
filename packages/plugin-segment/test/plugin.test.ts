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

const mockAnalytics = (): Analytics =>
  ({
    initialized: true,
    initialize: () => Promise.resolve({} as Analytics),
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

  test('name', () => {
    const plugin = segmentIntegrationPlugin();
    expect(plugin.name).toEqual('@amplitude/experiment-plugin-segment');
  });
  test('type', () => {
    const plugin = segmentIntegrationPlugin();
    expect(plugin.type).toEqual('integration');
  });
  test('sets analytics global if not already defined', () => {
    segmentIntegrationPlugin();
    expect(safeGlobal.analytics).toBeDefined();
    const expected = snippetInstance();
    expect(safeGlobal.analytics).toEqual(expected);
    expect(JSON.stringify(safeGlobal.analytics)).toEqual(JSON.stringify([]));
  });
  test('does not set analytics global if not already defined', () => {
    safeGlobal.analytics = ['test'];
    segmentIntegrationPlugin();
    expect(safeGlobal.analytics).toBeDefined();
    const expected = snippetInstance();
    expect(safeGlobal.analytics).toEqual(expected);
    expect(JSON.stringify(safeGlobal.analytics)).toEqual(
      JSON.stringify(['test']),
    );
  });
  test('with instance key, sets analytics global if not already defined', () => {
    segmentIntegrationPlugin({ instanceKey: 'asdf' });
    expect(safeGlobal.analytics).toBeUndefined();
    expect(safeGlobal.asdf).toBeDefined();
    const expected = snippetInstance('asdf');
    expect(safeGlobal.asdf).toEqual(expected);
    expect(JSON.stringify(safeGlobal.asdf)).toEqual(JSON.stringify([]));
  });
  test('with instance key, does not set analytics global if not already defined', () => {
    safeGlobal.asdf = ['test'];
    segmentIntegrationPlugin({ instanceKey: 'asdf' });
    expect(safeGlobal.analytics).toBeUndefined();
    expect(safeGlobal.asdf).toBeDefined();
    const expected = snippetInstance('asdf');
    expect(safeGlobal.asdf).toEqual(expected);
    expect(JSON.stringify(safeGlobal.asdf)).toEqual(JSON.stringify(['test']));
  });
  test('with instance config, does not set instance', () => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    segmentIntegrationPlugin({ instance });
    expect(safeGlobal.analytics).toBeUndefined();
  });
  describe('setup', () => {
    test('no options, setup function exists', () => {
      const plugin = segmentIntegrationPlugin();
      expect(plugin.setup).toBeDefined();
    });
    test('setup config false, setup function undefined', () => {
      const plugin = segmentIntegrationPlugin({ skipSetup: true });
      expect(plugin.setup).toBeUndefined();
      expect(safeGlobal.analytics).toBeDefined();
    });
  });
  describe('getUser', () => {
    test('returns user from local storage', () => {
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
    test('with instance, returns user from instance', () => {
      const plugin = segmentIntegrationPlugin({ instance });
      expect(plugin.getUser()).toEqual({
        user_id: userId,
        device_id: anonymousId,
        user_properties: traits,
      });
    });
    test('with instance, not initialized, returns user from local storage', () => {
      instance.initialized = false;
      const plugin = segmentIntegrationPlugin({ instance });
      expect(plugin.getUser()).toEqual({});
    });
    test('without instance, initialized, returns user from instance', () => {
      safeGlobal.analytics = mockAnalytics();
      const plugin = segmentIntegrationPlugin();
      expect(plugin.getUser()).toEqual({
        user_id: userId,
        device_id: anonymousId,
        user_properties: traits,
      });
    });
  });
  describe('track', () => {
    test('without instance, not initialized, returns false', () => {
      const plugin = segmentIntegrationPlugin();
      expect(plugin.track(impression)).toEqual(false);
    });
    test('without instance, initialized, returns true', () => {
      safeGlobal.analytics = mockAnalytics();
      const plugin = segmentIntegrationPlugin();
      expect(plugin.track(impression)).toEqual(true);
    });
    test('with instance, not initialized, returns false', () => {
      instance.initialized = false;
      const plugin = segmentIntegrationPlugin({ instance });
      expect(plugin.track(impression)).toEqual(false);
    });
    test('with instance, initialized, returns false', () => {
      const plugin = segmentIntegrationPlugin();
      expect(plugin.track(impression)).toEqual(false);
    });
  });
});
