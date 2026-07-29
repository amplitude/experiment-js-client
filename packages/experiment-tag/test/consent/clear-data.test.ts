import * as experimentCore from '@amplitude/experiment-core';

import { createMockGlobal } from '../util/mocks';

import * as clearDataModule from 'src/consent/clear-data';
import {
  clearAllPersistedData,
  getPersistedDataKeys,
} from 'src/consent/clear-data';
import { consentGate } from 'src/consent/consent-gate';
import { DefaultWebExperimentClient } from 'src/experiment';
import { initialize, setConsentStatus } from 'src/index';
import { InitConfigs, WebExperimentConfig } from 'src/types';
import * as antiFlickerUtils from 'src/util/anti-flicker';
import * as cookieUtils from 'src/util/cookie';

// First ten characters are 'abcdefghij', last six are 'uvwxyz'.
const API_KEY = 'abcdefghijklmnopqrstuvwxyz';
const SLICE = 'abcdefghij';
const CACHE = 'amp-exp-$default_instance-web-uvwxyz';

describe('getPersistedDataKeys', () => {
  it('builds every key from the apiKey and default instance name', () => {
    expect(getPersistedDataKeys(API_KEY)).toEqual({
      localStorage: [
        `EXP_${SLICE}`,
        `EXP_${SLICE}_DEFAULT_USER_PROVIDER`,
        `EXP_${SLICE}_rtbt_events`,
        `EXP_MKTG_${SLICE}`,
        'EXP_unsent_$default_instance',
      ],
      sessionStorage: [
        `EXP_${SLICE}_DEFAULT_USER_PROVIDER`,
        `EXP_${SLICE}_REDIRECT`,
        CACHE,
        `${CACHE}-flags`,
        `${CACHE}-variants-options`,
        'EXP_sent_v3_$default_instance',
        'EXP_sent_v2_$default_instance',
      ],
      cookies: [
        `EXP_${SLICE}_identity`,
        `EXP_${SLICE}_rtbt_session`,
        `EXP_${SLICE}_REDIRECT`,
        `AMP_MKTG_ORIGINAL_${SLICE}`,
      ],
    });
  });

  it('namespaces the browser SDK keys with a custom instance name', () => {
    const keys = getPersistedDataKeys(API_KEY, 'my-instance');

    expect(keys.sessionStorage).toContain('amp-exp-my-instance-web-uvwxyz');
    expect(keys.sessionStorage).toContain('EXP_sent_v3_my-instance');
    expect(keys.localStorage).toContain('EXP_unsent_my-instance');
    // The EXP_<slice> family is keyed by apiKey alone, so it is unaffected.
    expect(keys.localStorage).toContain(`EXP_${SLICE}`);
  });

  it('slices the apiKey differently for the two key families', () => {
    const keys = getPersistedDataKeys(API_KEY);

    // EXP_* uses the first ten characters; the browser SDK caches use the last
    // six. Conflating them silently leaves data behind.
    expect(keys.localStorage).toContain(`EXP_${SLICE}`);
    const cacheKey = keys.sessionStorage.find((key) =>
      key.startsWith('amp-exp-'),
    );
    expect(cacheKey).toBe(CACHE);
    expect(cacheKey).not.toContain(SLICE);
  });

  it('clears DEFAULT_USER_PROVIDER from both stores', () => {
    // DefaultUserProvider splits one key across two stores: first_seen in
    // localStorage, landing_url in sessionStorage.
    const key = `EXP_${SLICE}_DEFAULT_USER_PROVIDER`;
    const keys = getPersistedDataKeys(API_KEY);

    expect(keys.localStorage).toContain(key);
    expect(keys.sessionStorage).toContain(key);
  });
});

describe('clearAllPersistedData', () => {
  let globalScope: ReturnType<typeof createMockGlobal>;

  beforeEach(() => {
    jest.restoreAllMocks();
    globalScope = createMockGlobal({
      location: { hostname: 'app.example.com' },
    });
    jest
      .spyOn(experimentCore, 'getGlobalScope')
      .mockReturnValue(globalScope as never);
  });

  it('deletes every localStorage and sessionStorage key it owns', () => {
    const keys = getPersistedDataKeys(API_KEY);
    keys.localStorage.forEach((key) =>
      globalScope.localStorage.setItem(key, '"value"'),
    );
    keys.sessionStorage.forEach((key) =>
      globalScope.sessionStorage.setItem(key, '"value"'),
    );

    clearAllPersistedData(API_KEY);

    keys.localStorage.forEach((key) =>
      expect(globalScope.localStorage.getItem(key)).toBeNull(),
    );
    keys.sessionStorage.forEach((key) =>
      expect(globalScope.sessionStorage.getItem(key)).toBeNull(),
    );
  });

  it('leaves another apiKey and other products data intact', () => {
    const otherApiKey = 'zyxwvutsrqponmlkjihgfedcba';
    getPersistedDataKeys(otherApiKey).localStorage.forEach((key) =>
      globalScope.localStorage.setItem(key, '"other-slice"'),
    );
    // analytics-browser's own campaign cookie key, which experiment-tag reads
    // but never writes.
    globalScope.localStorage.setItem(`AMP_MKTG_${SLICE}`, '"analytics"');
    globalScope.localStorage.setItem('unrelated-key', '"keep me"');

    clearAllPersistedData(API_KEY);

    expect(
      globalScope.localStorage.getItem(`EXP_${otherApiKey.slice(0, 10)}`),
    ).toBe('"other-slice"');
    // The instance-scoped exposure keys are the one overlap between apiKeys, and
    // they are cleared on purpose: a visitor who denied consent shouldn't have
    // queued exposures left by any SDK on the page.
    expect(
      globalScope.localStorage.getItem('EXP_unsent_$default_instance'),
    ).toBeNull();
    expect(globalScope.localStorage.getItem(`AMP_MKTG_${SLICE}`)).toBe(
      '"analytics"',
    );
    expect(globalScope.localStorage.getItem('unrelated-key')).toBe('"keep me"');
  });

  it('deletes cookies at the host scope and every root-domain level', () => {
    const deleteRawCookie = jest.spyOn(cookieUtils, 'deleteRawCookie');

    clearAllPersistedData(API_KEY);

    for (const key of getPersistedDataKeys(API_KEY).cookies) {
      expect(deleteRawCookie).toHaveBeenCalledWith(key);
      expect(deleteRawCookie).toHaveBeenCalledWith(key, '.example.com');
      expect(deleteRawCookie).toHaveBeenCalledWith(key, '.app.example.com');
    }
  });

  it('writes no cookie of its own while consent is denied', () => {
    // The write path probes domain writability by setting a throwaway cookie.
    // Cleanup must not, or it would set a cookie during a denial.
    const writeRawCookie = jest.spyOn(cookieUtils, 'writeRawCookie');

    clearAllPersistedData(API_KEY);

    expect(writeRawCookie).not.toHaveBeenCalled();
    expect(document.cookie).not.toContain('AMP_TLD_TEST');
  });

  it('skips cookie domains for single-label hosts', () => {
    globalScope.location = createMockGlobal({
      location: { hostname: 'localhost' },
    }).location;
    const deleteRawCookie = jest.spyOn(cookieUtils, 'deleteRawCookie');

    clearAllPersistedData(API_KEY);

    for (const call of deleteRawCookie.mock.calls) {
      expect(call[1]).toBeUndefined();
    }
  });

  it('does not throw when no global scope is available', () => {
    jest
      .spyOn(experimentCore, 'getGlobalScope')
      .mockReturnValue(undefined as never);

    expect(() => clearAllPersistedData(API_KEY)).not.toThrow();
  });
});

describe('denial cleanup wiring', () => {
  const INIT_CONFIGS: InitConfigs = {
    initialFlags: '[]',
    pageObjects: '{}',
    behavioralTargetingRules: '{}',
  };
  let clearData: jest.SpyInstance;
  let globalScope: ReturnType<typeof createMockGlobal>;

  beforeEach(() => {
    jest.restoreAllMocks();
    consentGate.reset();
    globalScope = createMockGlobal({ experimentConfig: {} });
    jest
      .spyOn(experimentCore, 'getGlobalScope')
      .mockReturnValue(globalScope as never);
    jest.spyOn(DefaultWebExperimentClient, 'getInstance').mockReturnValue({
      start: jest.fn().mockResolvedValue(undefined),
      isRedirecting: false,
    } as unknown as DefaultWebExperimentClient);
    jest
      .spyOn(antiFlickerUtils, 'removeAntiFlickerCss')
      .mockImplementation(jest.fn());
    clearData = jest
      .spyOn(clearDataModule, 'clearAllPersistedData')
      .mockImplementation(jest.fn());
  });

  const init = (config: WebExperimentConfig) =>
    initialize(API_KEY, INIT_CONFIGS, config);

  it('clears data when consent is denied at load', () => {
    init({
      consentOptions: { consentRequired: true, consentStatus: 'denied' },
    });

    expect(clearData).toHaveBeenCalledTimes(1);
    expect(clearData).toHaveBeenCalledWith(API_KEY, {
      instanceName: undefined,
    });
  });

  it('clears data for a denial that arrived before initialize', () => {
    setConsentStatus('denied');
    init({ consentOptions: { consentRequired: true } });

    expect(clearData).toHaveBeenCalledTimes(1);
  });

  it('clears data on mid-session revocation', () => {
    init({
      consentOptions: { consentRequired: true, consentStatus: 'granted' },
    });
    expect(clearData).not.toHaveBeenCalled();

    setConsentStatus('denied');

    expect(clearData).toHaveBeenCalledTimes(1);
  });

  it('passes a custom instance name through to the key builder', () => {
    init({
      instanceName: 'my-instance',
      consentOptions: { consentRequired: true, consentStatus: 'denied' },
    });

    expect(clearData).toHaveBeenCalledWith(API_KEY, {
      instanceName: 'my-instance',
    });
  });

  // The client merges window.experimentConfig over the initialize() argument, so
  // the sweep has to resolve the instance name the same way or it clears the
  // default namespace and leaves the real keys behind.
  it('uses an instance name set only on window.experimentConfig', () => {
    globalScope.experimentConfig = { instanceName: 'window-instance' };

    init({
      consentOptions: { consentRequired: true, consentStatus: 'denied' },
    });

    expect(clearData).toHaveBeenCalledWith(API_KEY, {
      instanceName: 'window-instance',
    });
  });

  it('prefers the window instance name over the initialize argument', () => {
    globalScope.experimentConfig = { instanceName: 'window-instance' };

    init({
      instanceName: 'arg-instance',
      consentOptions: { consentRequired: true, consentStatus: 'denied' },
    });

    expect(clearData).toHaveBeenCalledWith(API_KEY, {
      instanceName: 'window-instance',
    });
  });

  it.each<[string, WebExperimentConfig]>([
    ['consent not required', {}],
    [
      'granted at load',
      { consentOptions: { consentRequired: true, consentStatus: 'granted' } },
    ],
    ['pending', { consentOptions: { consentRequired: true } }],
  ])('does not clear data: %s', (_label, config) => {
    init(config);

    expect(clearData).not.toHaveBeenCalled();
  });

  it('sweeps once per denial, not once per initialize', () => {
    const config: WebExperimentConfig = {
      consentOptions: { consentRequired: true, consentStatus: 'denied' },
    };
    init(config);
    init(config);

    expect(clearData).toHaveBeenCalledTimes(1);
  });

  it('sweeps again when consent is denied a second time', () => {
    init({ consentOptions: { consentRequired: true } });
    setConsentStatus('denied');
    setConsentStatus('granted');
    setConsentStatus('denied');

    expect(clearData).toHaveBeenCalledTimes(2);
  });
});
