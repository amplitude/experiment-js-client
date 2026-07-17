import * as experimentCore from '@amplitude/experiment-core';

import { createMockGlobal, setupGlobalObservers } from '../util/mocks';

import { consentGate } from 'src/consent-gate';
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

describe('consent journeys (v0)', () => {
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

  test('pending: nothing is constructed and no storage is written', async () => {
    initialize(API_KEY, INIT_CONFIGS, {
      consentOptions: { consentRequired: true, consentStatus: 'pending' },
    });
    await flushAsync();

    expect(mockGlobal.webExperiment.isStub).toBe(true);
    expect(mockGlobal.localStorage.setItem).not.toHaveBeenCalled();
    expect(mockGlobal.sessionStorage.setItem).not.toHaveBeenCalled();
    expect(Object.keys(cookieStore)).toHaveLength(0);
  });

  test('pending -> granted: client starts and identity is persisted', async () => {
    initialize(API_KEY, INIT_CONFIGS, {
      consentOptions: { consentRequired: true, consentStatus: 'pending' },
    });
    await flushAsync();
    expect(mockGlobal.localStorage.setItem).not.toHaveBeenCalled();

    // Customer CMP grants consent via the stub.
    mockGlobal.webExperiment.setConsentStatus('granted');
    await flushAsync();

    expect(mockGlobal.webExperiment.isStub).toBeFalsy();
    expect(mockGlobal.webExperiment.isRunning).toBe(true);
    expect(mockGlobal.localStorage.setItem).toHaveBeenCalledWith(
      IDENTITY_LS_KEY,
      expect.any(String),
    );
  });

  test('denied at load is terminal: a later grant does not start or write storage', async () => {
    initialize(API_KEY, INIT_CONFIGS, {
      consentOptions: { consentRequired: true, consentStatus: 'denied' },
    });
    await flushAsync();
    expect(mockGlobal.webExperiment.isStub).toBe(true);
    expect(mockGlobal.localStorage.setItem).not.toHaveBeenCalled();

    // Denial is terminal for the page load: the grant is ignored until reload.
    setConsentStatus('granted');
    await flushAsync();

    expect(mockGlobal.webExperiment.isStub).toBe(true);
    expect(mockGlobal.localStorage.setItem).not.toHaveBeenCalled();
    expect(Object.keys(cookieStore)).toHaveLength(0);
  });
});
