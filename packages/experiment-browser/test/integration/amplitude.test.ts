import {
  AnalyticsConnector,
  AnalyticsEvent,
} from '@amplitude/analytics-connector';
import { safeGlobal } from '@amplitude/experiment-core';
import { AmplitudeIntegrationPlugin } from 'src/integration/amplitude';
import { AmplitudeState } from 'src/util/state';

import { clearAllCookies } from '../util/misc';

const apiKey = '1234567890abcdefabcdefabcdefabcd';
const instanceName = '$default_instance';

describe('AmplitudeIntegrationPlugin', () => {
  let connector: AnalyticsConnector;
  beforeEach(() => {
    clearAllCookies();
    safeGlobal.localStorage.clear();
    safeGlobal.sessionStorage.clear();
    safeGlobal['analyticsConnectorInstances'] = {};
    connector = AnalyticsConnector.getInstance('$default_instance');
  });
  describe('constructor', () => {
    test('user loaded from legacy cookie, setup undefined, connector identity set', () => {
      const cookieValue = `device.${btoa('user')}........`;
      safeGlobal.document.cookie = `amp_123456=${cookieValue}`;
      const integration = new AmplitudeIntegrationPlugin(
        apiKey,
        instanceName,
        connector,
        10000,
      );
      expect(integration.setup).toBeUndefined();
      expect(connector.identityStore.getIdentity()).toEqual({
        userId: 'user',
        deviceId: 'device',
        userProperties: {},
      });
    });
    test('user loaded from cookie, setup undefined, connector identity set', () => {
      const state: AmplitudeState = {
        userId: 'user',
        deviceId: 'device',
      };
      const cookieValue = btoa(encodeURIComponent(JSON.stringify(state)));
      safeGlobal.document.cookie = `AMP_1234567890=${cookieValue}`;
      const integration = new AmplitudeIntegrationPlugin(
        apiKey,
        instanceName,
        connector,
        10000,
      );
      expect(integration.setup).toBeUndefined();
      expect(connector.identityStore.getIdentity()).toEqual({
        userId: 'user',
        deviceId: 'device',
        userProperties: {},
      });
    });
    test('user loaded from local storage, setup undefined, connector identity set', () => {
      const state: AmplitudeState = {
        userId: 'user',
        deviceId: 'device',
      };
      safeGlobal.localStorage.setItem('AMP_1234567890', JSON.stringify(state));
      const integration = new AmplitudeIntegrationPlugin(
        apiKey,
        instanceName,
        connector,
        10000,
      );
      expect(integration.setup).toBeUndefined();
      expect(connector.identityStore.getIdentity()).toEqual({
        userId: 'user',
        deviceId: 'device',
        userProperties: {},
      });
    });
    test('user loaded from session storage, setup undefined, connector identity set', () => {
      const state: AmplitudeState = {
        userId: 'user',
        deviceId: 'device',
      };
      safeGlobal.sessionStorage.setItem(
        'AMP_1234567890',
        JSON.stringify(state),
      );
      const integration = new AmplitudeIntegrationPlugin(
        apiKey,
        instanceName,
        connector,
        10000,
      );
      expect(integration.setup).toBeUndefined();
      expect(connector.identityStore.getIdentity()).toEqual({
        userId: 'user',
        deviceId: 'device',
        userProperties: {},
      });
    });
    test('user not loaded, setup defined, connector identity empty', () => {
      const integration = new AmplitudeIntegrationPlugin(
        apiKey,
        instanceName,
        connector,
        10000,
      );
      expect(integration.setup).toBeDefined();
      expect(connector.identityStore.getIdentity()).toEqual({
        userProperties: {},
      });
    });
  });
  describe('setup', () => {
    test('setup times out', async () => {
      const integration = new AmplitudeIntegrationPlugin(
        apiKey,
        instanceName,
        connector,
        100,
      );
      try {
        await Promise.race([
          integration.setup(),
          new Promise<void>((resolve) => setTimeout(() => resolve(), 500)),
        ]);
        fail('expected setup() to throw an error');
      } catch (e) {
        // Expected
      }
    });
    test('setup resolves when connector identity set before', async () => {
      const integration = new AmplitudeIntegrationPlugin(
        apiKey,
        instanceName,
        connector,
        10000,
      );
      connector.identityStore.setIdentity({
        userId: 'user',
        deviceId: 'device',
      });
      await Promise.race([
        integration.setup(),
        new Promise((_, reject) => setTimeout(() => reject('timeout'), 500)),
      ]);
    });
    test('setup resolves when connector identity set after', async () => {
      const integration = new AmplitudeIntegrationPlugin(
        apiKey,
        instanceName,
        connector,
        10000,
      );
      const race = Promise.race([
        integration.setup(),
        new Promise((_, reject) => setTimeout(() => reject('timeout'), 500)),
      ]);
      setTimeout(() => {
        connector.identityStore.setIdentity({
          userId: 'user',
          deviceId: 'device',
        });
      }, 100);
      await race;
    });
  });
  describe('getUser', () => {
    test('returns empty user', () => {
      const integration = new AmplitudeIntegrationPlugin(
        apiKey,
        instanceName,
        connector,
        10000,
      );
      expect(integration.getUser()).toEqual({ user_properties: {} });
    });
    test('returns expected properties from connector', () => {
      const integration = new AmplitudeIntegrationPlugin(
        apiKey,
        instanceName,
        connector,
        10000,
      );
      connector.identityStore.setIdentity({
        userId: 'user',
        deviceId: 'device',
        userProperties: { k: 'v' },
      });
      connector.applicationContextProvider.versionName = '1.0.0';
      expect(integration.getUser()).toEqual({
        user_id: 'user',
        device_id: 'device',
        user_properties: { k: 'v' },
        version: '1.0.0',
      });
    });
  });
  describe('track', () => {
    test('event bridge receiver not set, returns false', () => {
      const integration = new AmplitudeIntegrationPlugin(
        apiKey,
        instanceName,
        connector,
        10000,
      );
      expect(
        integration.track({
          eventType: '$exposure',
          eventProperties: {
            flag_key: 'flag-key',
            variant: 'on',
          },
        }),
      ).toEqual(false);
    });
    test('event bridge receiver set, calls connector event bridge, returns true', () => {
      const integration = new AmplitudeIntegrationPlugin(
        apiKey,
        instanceName,
        connector,
        10000,
      );
      let event: AnalyticsEvent;
      connector.eventBridge.setEventReceiver((e) => {
        event = e;
      });
      expect(
        integration.track({
          eventType: '$exposure',
          eventProperties: {
            flag_key: 'flag-key',
            variant: 'on',
          },
        }),
      ).toEqual(true);
      expect(event).toEqual({
        eventType: '$exposure',
        eventProperties: {
          flag_key: 'flag-key',
          variant: 'on',
        },
      });
    });
  });
});
