import * as experimentCore from '@amplitude/experiment-core';

import { createMockGlobal, setupGlobalObservers } from '../util/mocks';

import { consentGate } from 'src/consent/consent-gate';
import { initialize, setConsentStatus } from 'src/index';
import { InitConfigs } from 'src/types';
import * as antiFlickerUtils from 'src/util/anti-flicker';
import * as uuid from 'src/util/uuid';

// In-memory cookie store backing the mocked analytics-core CookieStorage.
const cookieStore: Record<string, any> = {};
const clearCookieStore = () =>
  Object.keys(cookieStore).forEach((key) => delete cookieStore[key]);

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

setupGlobalObservers();

const API_KEY = 'testkey123';
const IDENTITY_LS_KEY = `EXP_${API_KEY}`;
const INIT_CONFIGS: InitConfigs = {
  initialFlags: JSON.stringify([]),
  pageObjects: JSON.stringify({}),
};

const flushAsync = async (): Promise<void> => {
  // startClient runs client.start() detached (void); give its microtasks +
  // the jsdom macrotask queue a chance to settle before asserting.
  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
  }
  await new Promise((resolve) => setTimeout(resolve, 0));
};

describe('consent journeys', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockGlobal: any;

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    consentGate.reset();
    clearCookieStore();
    mockGlobal = createMockGlobal();
    jest
      .spyOn(experimentCore, 'getGlobalScope')
      .mockReturnValue(mockGlobal as never);
    jest.spyOn(experimentCore, 'isLocalStorageAvailable').mockReturnValue(true);
    jest.spyOn(uuid, 'UUID').mockReturnValue('mock');
    jest
      .spyOn(antiFlickerUtils, 'removeAntiFlickerCss')
      .mockImplementation(jest.fn());
    jest
      .spyOn(antiFlickerUtils, 'applyAntiFlickerCss')
      .mockImplementation(jest.fn());
  });

  test('consentRequired absent: starts and writes identity storage as today', async () => {
    initialize(API_KEY, INIT_CONFIGS, {});
    await flushAsync();
    expect(mockGlobal.webExperiment?.isStub).toBeFalsy();
    expect(mockGlobal.localStorage.setItem).toHaveBeenCalledWith(
      IDENTITY_LS_KEY,
      expect.any(String),
    );
  });

  test('pending: client runs, but nothing reaches storage', async () => {
    initialize(API_KEY, INIT_CONFIGS, {
      consentOptions: { consentRequired: true, consentStatus: 'pending' },
    });
    await flushAsync();

    // The client is real and running — experiments are live under pending —
    // while every persistence surface stays untouched.
    expect(mockGlobal.webExperiment.isStub).toBeFalsy();
    expect(mockGlobal.webExperiment.isRunning).toBe(true);
    expect(mockGlobal.localStorage.setItem).not.toHaveBeenCalled();
    expect(mockGlobal.sessionStorage.setItem).not.toHaveBeenCalled();
    expect(Object.keys(cookieStore)).toHaveLength(0);
  });

  test('pending -> granted: the running client flushes identity to storage', async () => {
    initialize(API_KEY, INIT_CONFIGS, {
      consentOptions: { consentRequired: true, consentStatus: 'pending' },
    });
    await flushAsync();
    expect(mockGlobal.webExperiment.isRunning).toBe(true);
    expect(mockGlobal.localStorage.setItem).not.toHaveBeenCalled();

    // Customer CMP grants consent on the already-running client: no relaunch,
    // the buffered identity write flushes out.
    mockGlobal.webExperiment.setConsentStatus('granted');
    await flushAsync();

    expect(mockGlobal.webExperiment.isRunning).toBe(true);
    expect(mockGlobal.localStorage.setItem).toHaveBeenCalledWith(
      IDENTITY_LS_KEY,
      expect.any(String),
    );
  });

  test('pending -> denied: nothing is written, and a later re-opt-in does not resurrect pre-denial data', async () => {
    initialize(API_KEY, INIT_CONFIGS, {
      consentOptions: { consentRequired: true, consentStatus: 'pending' },
    });
    await flushAsync();
    expect(mockGlobal.webExperiment.isRunning).toBe(true);

    mockGlobal.webExperiment.setConsentStatus('denied');
    await flushAsync();
    expect(mockGlobal.localStorage.setItem).not.toHaveBeenCalled();
    expect(mockGlobal.sessionStorage.setItem).not.toHaveBeenCalled();
    expect(Object.keys(cookieStore)).toHaveLength(0);

    // The denial dropped the buffers and spent the one-shot flush listeners,
    // so a preference-center re-opt-in must not write out pre-denial data.
    mockGlobal.webExperiment.setConsentStatus('granted');
    await flushAsync();
    expect(mockGlobal.localStorage.setItem).not.toHaveBeenCalled();
  });

  test('denied at load: strips the AMP_REDIRECT param a pending source page added', async () => {
    // A pending-window redirect on the source page forces its impression
    // payload onto this URL. Denied here means the impression is dropped, so
    // the payload must not stay in the address bar or replay on re-grant.
    const encoded = btoa(
      JSON.stringify({ 'flag-1': { redirectUrl: 'http://test.com/landing' } }),
    );
    mockGlobal.location.href = `http://test.com/landing?AMP_REDIRECT=${encoded}`;
    mockGlobal.location.search = `?AMP_REDIRECT=${encoded}`;

    initialize(API_KEY, INIT_CONFIGS, {
      consentOptions: { consentRequired: true, consentStatus: 'denied' },
    });
    await flushAsync();

    expect(mockGlobal.history.replaceState).toHaveBeenCalledWith(
      {},
      '',
      'http://test.com/landing',
    );
  });

  test('denied at load: leaves the URL alone when no redirect param is present', async () => {
    initialize(API_KEY, INIT_CONFIGS, {
      consentOptions: { consentRequired: true, consentStatus: 'denied' },
    });
    await flushAsync();

    expect(mockGlobal.history.replaceState).not.toHaveBeenCalled();
  });

  test('denied at load -> granted: re-opt-in starts the client and persists identity', async () => {
    initialize(API_KEY, INIT_CONFIGS, {
      consentOptions: { consentRequired: true, consentStatus: 'denied' },
    });
    await flushAsync();
    expect(mockGlobal.webExperiment.isStub).toBe(true);
    expect(mockGlobal.localStorage.setItem).not.toHaveBeenCalled();

    // Preference-center re-opt-in: the later grant starts the client in-session.
    setConsentStatus('granted');
    await flushAsync();

    expect(mockGlobal.webExperiment.isStub).toBeFalsy();
    expect(mockGlobal.webExperiment.isRunning).toBe(true);
    expect(mockGlobal.localStorage.setItem).toHaveBeenCalledWith(
      IDENTITY_LS_KEY,
      expect.any(String),
    );
  });
});
