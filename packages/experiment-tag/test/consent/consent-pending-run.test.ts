import * as experimentCore from '@amplitude/experiment-core';
import { EvaluationOperator } from '@amplitude/experiment-core';
import {
  Experiment,
  ExperimentClient,
  MemoryStorage,
} from '@amplitude/experiment-js-client';
import { stringify } from 'ts-jest';

import { createRedirectFlag } from '../util/create-flag';
import { createPageObject } from '../util/create-page-object';
import { createMockGlobal, setupGlobalObservers } from '../util/mocks';

import { activateConsent } from './consent-test-util';

import { RelayClient } from 'src/behavioral-targeting/relay-client';
import { consentGate } from 'src/consent/consent-gate';
import { DefaultWebExperimentClient } from 'src/experiment';
import {
  deleteRawCookie,
  readCookieStorageSync,
  writeCookieStorageSync,
} from 'src/util/cookie';

// In-memory cookie store backing the mocked analytics-core CookieStorage.
const cookieStore: Record<string, any> = {};
const clearCookieStore = () => {
  Object.keys(cookieStore).forEach((key) => delete cookieStore[key]);
  for (const cookie of document.cookie ? document.cookie.split('; ') : []) {
    const eq = cookie.indexOf('=');
    const key = eq === -1 ? cookie : cookie.slice(0, eq);
    if (key) deleteRawCookie(key);
  }
};

jest.mock('@amplitude/analytics-core', () => {
  const actual = jest.requireActual('@amplitude/analytics-core');
  const MockCookieStorage = jest.fn().mockImplementation(() => ({
    get: jest.fn((key: string) => Promise.resolve(cookieStore[key])),
    set: jest.fn((key: string, value: any) => {
      cookieStore[key] = value;
      return Promise.resolve();
    }),
    remove: jest.fn((key: string) => {
      delete cookieStore[key];
      return Promise.resolve();
    }),
    getRaw: jest.fn((key: string) =>
      Promise.resolve(JSON.stringify(cookieStore[key])),
    ),
    isEnabled: jest.fn(() => Promise.resolve(true)),
    reset: jest.fn(() => {
      clearCookieStore();
      return Promise.resolve();
    }),
  }));
  (MockCookieStorage as any).isDomainWritable = jest
    .fn()
    .mockResolvedValue(false);
  return { ...actual, CookieStorage: MockCookieStorage };
});

jest.mock('src/util/messenger', () => ({
  WindowMessenger: { setup: jest.fn() },
}));

const mockRelayInit = jest.fn().mockResolvedValue(undefined);
const mockRelayDestroy = jest.fn();
const mockRelayWaitForAvailable = jest.fn().mockResolvedValue(false);
const mockRelayCheckMigrated = jest.fn().mockResolvedValue(true);
const mockRelayReadEvents = jest
  .fn()
  .mockResolvedValue({ events: [], nextId: 1 });
// Mutable so individual tests can flip the relay to "available" (a successful
// sync path) without re-mocking the module.
const mockRelayState = { available: false };

jest.mock('src/behavioral-targeting/relay-client', () => {
  const actual = jest.requireActual('src/behavioral-targeting/relay-client');
  return {
    ...actual,
    RelayClient: jest.fn().mockImplementation(() => ({
      init: mockRelayInit,
      destroy: mockRelayDestroy,
      get relayAvailable() {
        return mockRelayState.available;
      },
      waitForAvailable: mockRelayWaitForAvailable,
      checkMigrated: mockRelayCheckMigrated,
      readEvents: mockRelayReadEvents,
      writeEvent: jest.fn(),
      flush: jest.fn(),
    })),
  };
});

setupGlobalObservers();

const BEHAVIORAL_TARGETING_RULES = {
  flag_a: {
    behavior_1: [
      [
        {
          condition: {
            type: 'behavior',
            event_type: 'click',
            op: EvaluationOperator.GREATER_THAN_EQUALS,
            value: 1,
            time_type: 'rolling',
            time_value: 7,
            interval: 'day',
          },
        },
      ],
    ],
  },
};

const DEFAULT_PAGE_OBJECTS = {
  test: createPageObject('A', 'url_change', undefined, 'http://test.com'),
};
const DEFAULT_REDIRECT_SCOPE = { treatment: ['A'], control: ['A'] };

const flushAsync = async (): Promise<void> => {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
  }
  await new Promise((resolve) => setTimeout(resolve, 0));
};

describe('pending-run wiring', () => {
  let apiKey = 0;
  const mockGetGlobalScope = jest.spyOn(experimentCore, 'getGlobalScope');
  let mockGlobal: ReturnType<typeof createMockGlobal>;

  const newBehavioralClient = () =>
    DefaultWebExperimentClient.getInstance(stringify(apiKey), {
      initialFlags: JSON.stringify([]),
      pageObjects: JSON.stringify({
        flag_a: createPageObject(
          'A',
          'url_change',
          undefined,
          'http://test.com',
        ),
      }),
      behavioralTargetingRules: JSON.stringify(BEHAVIORAL_TARGETING_RULES),
    });

  beforeEach(() => {
    apiKey++;
    jest.clearAllMocks();
    consentGate.reset();
    clearCookieStore();
    mockRelayState.available = false;
    jest.spyOn(experimentCore, 'isLocalStorageAvailable').mockReturnValue(true);
    mockGlobal = createMockGlobal();
    mockGetGlobalScope.mockReturnValue(
      mockGlobal as unknown as typeof globalThis,
    );
    jest.spyOn(ExperimentClient.prototype, 'setUser').mockImplementation();
    // `all` is left real so the redirect tests evaluate their local flag; the
    // relay tests pass empty initialFlags, so it returns {} for them anyway.
    jest
      .spyOn(ExperimentClient.prototype, 'fetch')
      .mockResolvedValue({} as never);
  });

  describe('relay iframe gating', () => {
    test('not injected while consent is pending', async () => {
      activateConsent('pending');
      await newBehavioralClient().start();
      await flushAsync();

      expect(RelayClient).not.toHaveBeenCalled();
      expect(mockRelayInit).not.toHaveBeenCalled();
    });

    test('grant injects the deferred relay', async () => {
      activateConsent('pending');
      await newBehavioralClient().start();
      await flushAsync();
      expect(RelayClient).not.toHaveBeenCalled();

      consentGate.manager.setStatus('granted');
      await flushAsync();

      expect(RelayClient).toHaveBeenCalledTimes(1);
      expect(mockRelayInit).toHaveBeenCalled();
    });

    test('refusal never injects the relay, even after a same-page re-opt-in', async () => {
      activateConsent('pending');
      await newBehavioralClient().start();
      await flushAsync();

      consentGate.manager.setStatus('denied');
      await flushAsync();
      expect(RelayClient).not.toHaveBeenCalled();

      // The refusal spent the deferral's one-shot subscription without
      // injecting, and nothing re-arms it — a re-opt-in gets the relay on
      // the next page load, never this one.
      consentGate.manager.setStatus('granted');
      await flushAsync();
      expect(RelayClient).not.toHaveBeenCalled();
    });

    test('revocation tears down a live relay (stops third-party requests)', async () => {
      activateConsent('granted');
      // Successful sync path: relay available, nothing to merge.
      // syncFromRelay needs location.origin (absent from the default mock).
      mockRelayState.available = true;
      mockGlobal = createMockGlobal({
        location: { origin: 'http://test.com' },
      });
      mockGetGlobalScope.mockReturnValue(
        mockGlobal as unknown as typeof globalThis,
      );

      await newBehavioralClient().start();
      await flushAsync();
      expect(RelayClient).toHaveBeenCalledTimes(1);
      expect(mockRelayDestroy).not.toHaveBeenCalled();

      consentGate.manager.setStatus('denied');
      await flushAsync();
      expect(mockRelayDestroy).toHaveBeenCalled();
    });

    test('revocation tears down a relay that was injected by a grant', async () => {
      // Regression: the teardown listener is armed inside the pending-grant
      // deferral callback, i.e. while the manager is still notifying grant
      // listeners. Live-Set iteration would spend the one-shot on the grant
      // itself, leaving the relay alive through the revocation.
      activateConsent('pending');
      mockRelayState.available = true;
      mockGlobal = createMockGlobal({
        location: { origin: 'http://test.com' },
      });
      mockGetGlobalScope.mockReturnValue(
        mockGlobal as unknown as typeof globalThis,
      );

      await newBehavioralClient().start();
      await flushAsync();
      expect(RelayClient).not.toHaveBeenCalled();

      consentGate.manager.setStatus('granted');
      await flushAsync();
      expect(RelayClient).toHaveBeenCalledTimes(1);
      expect(mockRelayDestroy).not.toHaveBeenCalled();

      consentGate.manager.setStatus('denied');
      await flushAsync();
      expect(mockRelayDestroy).toHaveBeenCalled();
    });

    test('grant moves the client onto the durable identity before the relay binds', async () => {
      // Pending gated reads hide the identity an earlier consented visit
      // stored, so start() mints an ephemeral one. The grant flush restores
      // the durable identity on disk; the refresh must move the running
      // client onto it and the deferred relay must bind to it — otherwise
      // this page's behavioral data fragments under an id that never
      // appears again.
      activateConsent('pending');
      const expKey = `EXP_${stringify(apiKey).slice(0, 10)}`;
      mockGlobal.localStorage.setItem(
        expKey,
        JSON.stringify({
          web_exp_id: 'durable-id',
          web_exp_id_v2: 'durable-v2',
        }),
      );
      writeCookieStorageSync(
        `${expKey}_identity`,
        JSON.stringify({
          web_exp_id_v2: 'durable-v2',
          first_seen: '100',
        }),
      );

      await newBehavioralClient().start();
      await flushAsync();
      expect(RelayClient).not.toHaveBeenCalled();

      consentGate.manager.setStatus('granted');
      await flushAsync();

      expect(RelayClient).toHaveBeenCalledTimes(1);
      expect((RelayClient as unknown as jest.Mock).mock.calls[0][1]).toEqual(
        'durable-v2',
      );
      const setUserCalls = (ExperimentClient.prototype.setUser as jest.Mock)
        .mock.calls;
      expect(setUserCalls[setUserCalls.length - 1][0]).toEqual(
        expect.objectContaining({
          web_exp_id: 'durable-id',
          web_exp_id_v2: 'durable-v2',
        }),
      );
    });

    test('grant restores durable localStorage identity when no durable cookie existed', async () => {
      // Cookie expired (or was cleared) but localStorage survived: the grant
      // flush writes the pending-time mint into the cookie (no durable cookie
      // wins the merge), so a plain re-read returns this page's own mint. An
      // ungated start() would have seeded the cookie from localStorage — the
      // refresh must converge to that, not let the mint become permanent.
      activateConsent('pending');
      const expKey = `EXP_${stringify(apiKey).slice(0, 10)}`;
      mockGlobal.localStorage.setItem(
        expKey,
        JSON.stringify({
          web_exp_id: 'durable-id',
          web_exp_id_v2: 'durable-v2',
        }),
      );
      mockGlobal.localStorage.setItem(
        `${expKey}_DEFAULT_USER_PROVIDER`,
        JSON.stringify({ first_seen: '1000' }),
      );

      await newBehavioralClient().start();
      await flushAsync();

      consentGate.manager.setStatus('granted');
      await flushAsync();

      expect(RelayClient).toHaveBeenCalledTimes(1);
      expect((RelayClient as unknown as jest.Mock).mock.calls[0][1]).toEqual(
        'durable-v2',
      );
      const setUserCalls = (ExperimentClient.prototype.setUser as jest.Mock)
        .mock.calls;
      expect(setUserCalls[setUserCalls.length - 1][0]).toEqual(
        expect.objectContaining({
          web_exp_id: 'durable-id',
          web_exp_id_v2: 'durable-v2',
          first_seen: '1000',
        }),
      );
      // The cookie was rewritten with the durable values, so later loads
      // resolve the same identity instead of the pending-time mint.
      expect(
        JSON.parse(readCookieStorageSync<string>(`${expKey}_identity`)!),
      ).toEqual({
        web_exp_id_v2: 'durable-v2',
        first_seen: '1000',
      });
    });

    test('a denial racing start() keeps the relay out for the page, even across a re-opt-in', async () => {
      // Regression: when the denial lands before scheduleRelaySync runs, the
      // status is already 'denied' at the withheld check. Arming the deferral
      // there would hand the relay to a same-page re-opt-in — unlike the
      // pending path, where the refusal spends the subscription and the relay
      // waits for the next load.
      activateConsent('pending');
      const startPromise = newBehavioralClient().start();
      consentGate.manager.setStatus('denied');
      await startPromise;
      await flushAsync();
      expect(RelayClient).not.toHaveBeenCalled();

      consentGate.manager.setStatus('granted');
      await flushAsync();
      expect(RelayClient).not.toHaveBeenCalled();
    });
  });

  describe('memory-backed amp-exp-* caches', () => {
    test('pending injects a MemoryStorage internal cache', () => {
      const initSpy = jest.spyOn(Experiment, 'initialize');
      activateConsent('pending');
      DefaultWebExperimentClient.getInstance(stringify(apiKey), {
        initialFlags: JSON.stringify([]),
        pageObjects: JSON.stringify({}),
      });

      expect(initSpy).toHaveBeenCalledWith(
        stringify(apiKey),
        expect.objectContaining({
          internalCacheStorage: expect.any(MemoryStorage),
        }),
      );
    });

    test('without consent gating the cache storage is not overridden', () => {
      const initSpy = jest.spyOn(Experiment, 'initialize');
      DefaultWebExperimentClient.getInstance(stringify(apiKey), {
        initialFlags: JSON.stringify([]),
        pageObjects: JSON.stringify({}),
      });

      const config = initSpy.mock.calls[0][1] as Record<string, unknown>;
      expect(config.internalCacheStorage).toBeUndefined();
    });
  });

  describe('constructor localStorage probe', () => {
    test('skipped while consent is withheld (the probe writes a throwaway key)', () => {
      activateConsent('pending');
      newBehavioralClient();
      expect(experimentCore.isLocalStorageAvailable).not.toHaveBeenCalled();
    });

    test('runs as usual once consent is granted', () => {
      activateConsent('granted');
      newBehavioralClient();
      expect(experimentCore.isLocalStorageAvailable).toHaveBeenCalled();
    });
  });

  describe('redirect impressions under pending', () => {
    test('forces the AMP_REDIRECT URL transport without the encodeRedirectInUrl opt-in', async () => {
      activateConsent('pending');
      const client = DefaultWebExperimentClient.getInstance(stringify(apiKey), {
        initialFlags: JSON.stringify([
          createRedirectFlag(
            'test',
            'treatment',
            'http://test.com/2',
            undefined,
            DEFAULT_REDIRECT_SCOPE,
          ),
        ]),
        pageObjects: JSON.stringify(DEFAULT_PAGE_OBJECTS),
      });
      await client.start();

      // Impression cookies/sessionStorage stay gated; the stick-detector
      // marker is exempt so a hard nav can still suppress a strip loop.
      const sessionKeys = mockGlobal.sessionStorage.setItem.mock.calls.map(
        ([key]) => key,
      );
      expect(sessionKeys.every((key) => key.endsWith('_REDIRECT_MARKER'))).toBe(
        true,
      );
      expect(sessionKeys.length).toBeGreaterThan(0);
      expect(mockGlobal.location.replace).toHaveBeenCalledTimes(1);
      const targetUrl = mockGlobal.location.replace.mock.calls[0][0] as string;
      const encoded = new URL(targetUrl).searchParams.get('AMP_REDIRECT');
      expect(encoded).not.toBeNull();
      expect(JSON.parse(atob(encoded as string))).toMatchObject({
        test: { redirectUrl: 'http://test.com/2', variantKey: 'treatment' },
      });
    });

    test('pending hard-nav marker survives so a server strip is suppressed', async () => {
      activateConsent('pending');
      const key = stringify(apiKey);
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {
        // swallow expected loop warning
      });
      mockGlobal.sessionStorage.setItem(
        `EXP_${key.slice(0, 10)}_REDIRECT_MARKER`,
        JSON.stringify({
          test: {
            from: 'http://test.com',
            target: 'http://test.com/2',
            distinguishingParams: [],
            landed: false,
          },
        }),
      );
      mockGetGlobalScope.mockReturnValue(
        mockGlobal as unknown as typeof globalThis,
      );

      try {
        await DefaultWebExperimentClient.getInstance(key, {
          initialFlags: JSON.stringify([
            createRedirectFlag(
              'test',
              'treatment',
              'http://test.com/2',
              undefined,
              DEFAULT_REDIRECT_SCOPE,
            ),
          ]),
          pageObjects: JSON.stringify(DEFAULT_PAGE_OBJECTS),
        }).start();

        expect(mockGlobal.location.replace).not.toHaveBeenCalled();
        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining('redirect loop detected'),
        );
      } finally {
        warnSpy.mockRestore();
      }
    });

    test('a gated destination consumes the URL param and cleans the URL', async () => {
      activateConsent('pending');
      const encoded = btoa(
        JSON.stringify({
          test: { redirectUrl: 'http://test.com/2', variantKey: 'treatment' },
        }),
      );
      mockGlobal = createMockGlobal({
        location: {
          href: `http://test.com/2?AMP_REDIRECT=${encodeURIComponent(encoded)}`,
          search: `?AMP_REDIRECT=${encodeURIComponent(encoded)}`,
        },
      });
      mockGetGlobalScope.mockReturnValue(
        mockGlobal as unknown as typeof globalThis,
      );
      const mockExposureInternal = jest.spyOn(
        ExperimentClient.prototype as any,
        'exposureInternal',
      );

      const replaceStateSpy = mockGlobal.history.replaceState;
      const client = DefaultWebExperimentClient.getInstance(stringify(apiKey), {
        initialFlags: JSON.stringify([]),
        pageObjects: JSON.stringify({}),
      });
      await client.start();
      await flushAsync();

      expect(mockExposureInternal).toHaveBeenCalledTimes(1);
      expect(mockExposureInternal.mock.calls[0][0]).toBe('test');
      expect(replaceStateSpy).toHaveBeenCalledWith({}, '', 'http://test.com/2');
    });
  });
});
