import * as experimentCore from '@amplitude/experiment-core';

import { createMockGlobal } from '../util/mocks';

import { consentGate } from 'src/consent-gate';
import { DefaultWebExperimentClient } from 'src/experiment';
import { initialize, setConsentStatus } from 'src/index';
import { SdkPreviewApi } from 'src/preview/preview-api';
import { ConsentStatus, InitConfigs, WebExperimentConfig } from 'src/types';
import * as antiFlickerUtils from 'src/util/anti-flicker';
import * as urlUtils from 'src/util/url';

const API_KEY = 'test-api-key-1234567890';
const INIT_CONFIGS: InitConfigs = {
  initialFlags: '[]',
  pageObjects: '{}',
  behavioralTargetingRules: '{}',
};

describe('index.ts consent gate (v0)', () => {
  let globalScope: Record<string, unknown>;
  let start: jest.Mock;
  let getInstance: jest.SpyInstance;

  beforeEach(() => {
    jest.restoreAllMocks();
    consentGate.reset();
    globalScope = createMockGlobal({ experimentConfig: {} });
    jest
      .spyOn(experimentCore, 'getGlobalScope')
      .mockReturnValue(globalScope as never);

    start = jest.fn().mockResolvedValue(undefined);
    const fakeClient = {
      start,
      isRedirecting: false,
    } as unknown as DefaultWebExperimentClient;
    getInstance = jest
      .spyOn(DefaultWebExperimentClient, 'getInstance')
      .mockReturnValue(fakeClient);
    jest
      .spyOn(antiFlickerUtils, 'removeAntiFlickerCss')
      .mockImplementation(jest.fn());
    jest
      .spyOn(antiFlickerUtils, 'applyAntiFlickerCss')
      .mockImplementation(jest.fn());
  });

  const init = (config: WebExperimentConfig) =>
    initialize(API_KEY, INIT_CONFIGS, config);

  it.each<[string, WebExperimentConfig]>([
    ['consentRequired absent (unchanged path)', {}],
    ['consentRequired false', { consentOptions: { consentRequired: false } }],
    [
      'required + initial granted',
      { consentOptions: { consentRequired: true, consentStatus: 'granted' } },
    ],
  ])('starts immediately: %s', (_label, config) => {
    init(config);
    expect(getInstance).toHaveBeenCalledTimes(1);
  });

  it.each<[string, WebExperimentConfig]>([
    [
      'pending',
      { consentOptions: { consentRequired: true, consentStatus: 'pending' } },
    ],
    [
      'no status (defaults to pending)',
      { consentOptions: { consentRequired: true } },
    ],
    [
      'denied',
      { consentOptions: { consentRequired: true, consentStatus: 'denied' } },
    ],
  ])('does not construct or start: required + %s', (_label, config) => {
    init(config);
    expect(getInstance).not.toHaveBeenCalled();
  });

  test('pending -> granted starts exactly once', () => {
    init({
      consentOptions: { consentRequired: true, consentStatus: 'pending' },
    });
    setConsentStatus('granted');
    expect(getInstance).toHaveBeenCalledTimes(1);
    expect(start).toHaveBeenCalledTimes(1);
  });

  test('double grant starts only once', () => {
    init({
      consentOptions: { consentRequired: true, consentStatus: 'pending' },
    });
    setConsentStatus('granted');
    setConsentStatus('granted');
    expect(getInstance).toHaveBeenCalledTimes(1);
  });

  it.each<[string, ConsentStatus, ConsentStatus[]]>([
    ['pending -> denied -> granted', 'pending', ['denied', 'granted']],
    ['denied at load -> granted', 'denied', ['granted']],
    [
      'pending -> denied -> pending -> granted',
      'pending',
      ['denied', 'pending', 'granted'],
    ],
  ])(
    'denied -> granted re-opt-in starts the client once: %s',
    (_label, initial, sequence) => {
      init({
        consentOptions: { consentRequired: true, consentStatus: initial },
      });
      sequence.forEach((status) => setConsentStatus(status));
      expect(getInstance).toHaveBeenCalledTimes(1);
      expect(start).toHaveBeenCalledTimes(1);
    },
  );

  test('grant BEFORE initialize: starts as soon as initialize runs', () => {
    setConsentStatus('granted'); // CMP resolved before script fully loaded
    init({
      consentOptions: { consentRequired: true, consentStatus: 'pending' },
    });
    expect(getInstance).toHaveBeenCalledTimes(1);
  });

  test('window.experimentConfig.consentOptions wins over the initialize arg', () => {
    globalScope.experimentConfig = {
      consentOptions: { consentRequired: true, consentStatus: 'pending' },
    };
    // initialize arg says granted, but window says pending -> should not start
    init({
      consentOptions: { consentRequired: true, consentStatus: 'granted' },
    });
    expect(getInstance).not.toHaveBeenCalled();
  });

  test('runtime denied wins over a later initialize granted config, until a re-opt-in', () => {
    setConsentStatus('denied'); // CMP declined before the script loaded
    init({
      consentOptions: { consentRequired: true, consentStatus: 'granted' },
    });
    expect(getInstance).not.toHaveBeenCalled();

    // Preference-center re-opt-in starts the client in-session.
    setConsentStatus('granted');
    expect(getInstance).toHaveBeenCalledTimes(1);
  });

  it.each<[string, WebExperimentConfig]>([
    ['consentOptions absent', {}],
    ['consentRequired false', { consentOptions: { consentRequired: false } }],
  ])(
    'a stray pre-init denial does not block start when gating is off: %s',
    (_label, config) => {
      setConsentStatus('denied'); // CMP wired up, but consent gating never enabled
      init(config);
      expect(getInstance).toHaveBeenCalledTimes(1);
      expect(start).toHaveBeenCalledTimes(1);
    },
  );

  test('a second initialize with consentRequired=false cannot bypass a pending deferral', () => {
    // First init defers on consent.
    init({
      consentOptions: { consentRequired: true, consentStatus: 'pending' },
    });
    expect(getInstance).not.toHaveBeenCalled();

    // A later init resolving consentRequired=false must not release the
    // parked start — only a grant may.
    init({ consentOptions: { consentRequired: false } });
    expect(getInstance).not.toHaveBeenCalled();

    setConsentStatus('granted');
    expect(getInstance).toHaveBeenCalledTimes(1);
    expect(start).toHaveBeenCalledTimes(1);
  });

  describe('preview mode', () => {
    const flushAsync = async () => {
      for (let i = 0; i < 5; i++) {
        await Promise.resolve();
      }
    };

    beforeEach(() => {
      jest.spyOn(urlUtils, 'isPreviewMode').mockReturnValue(true);
      jest
        .spyOn(SdkPreviewApi.prototype, 'getPreviewFlagsAndPageViewObjects')
        .mockResolvedValue({
          flags: [],
          pageViewObjects: {},
          behavioralTargetingRules: [],
        } as never);
    });

    test('deferred grant goes through the preview path (anti-flicker + config fetch)', async () => {
      init({
        consentOptions: { consentRequired: true, consentStatus: 'pending' },
      });
      expect(antiFlickerUtils.applyAntiFlickerCss).not.toHaveBeenCalled();

      setConsentStatus('granted');
      await flushAsync();

      expect(antiFlickerUtils.applyAntiFlickerCss).toHaveBeenCalled();
      expect(
        SdkPreviewApi.prototype.getPreviewFlagsAndPageViewObjects,
      ).toHaveBeenCalled();
      expect(getInstance).toHaveBeenCalledTimes(1);
    });

    test('denial during the in-flight config fetch does not abort the start (v0 revocation is reload-to-reset)', async () => {
      init({
        consentOptions: { consentRequired: true, consentStatus: 'granted' },
      });
      // Fetch is in flight; the user denies before it resolves. v0 does not
      // honor mid-session revocation until the next reload, so the start that
      // was already committed still constructs.
      setConsentStatus('denied');
      await flushAsync();

      expect(getInstance).toHaveBeenCalledTimes(1);
    });
  });

  test('stub exposes setConsentStatus before the client exists', () => {
    init({
      consentOptions: { consentRequired: true, consentStatus: 'pending' },
    });
    expect(globalScope.webExperiment).toBeDefined();
    expect(
      typeof (globalScope.webExperiment as { setConsentStatus?: unknown })
        .setConsentStatus,
    ).toBe('function');
  });
});
