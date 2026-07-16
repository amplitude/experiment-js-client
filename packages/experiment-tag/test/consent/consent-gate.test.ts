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
      'rejected',
      { consentOptions: { consentRequired: true, consentStatus: 'rejected' } },
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
    ['pending -> rejected -> granted', 'pending', ['rejected', 'granted']],
    ['rejected at load -> granted', 'rejected', ['granted']],
    [
      'pending -> rejected -> pending -> granted',
      'pending',
      ['rejected', 'pending', 'granted'],
    ],
  ])('rejected is terminal: %s does not start', (_label, initial, sequence) => {
    init({
      consentOptions: { consentRequired: true, consentStatus: initial },
    });
    sequence.forEach((status) => setConsentStatus(status));
    expect(getInstance).not.toHaveBeenCalled();
  });

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

  test('rejected latch is honored by a later initialize with granted config', () => {
    setConsentStatus('rejected'); // CMP declined before the script loaded
    init({
      consentOptions: { consentRequired: true, consentStatus: 'granted' },
    });
    expect(getInstance).not.toHaveBeenCalled();
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

    test('rejection during the in-flight config fetch prevents construction', async () => {
      init({
        consentOptions: { consentRequired: true, consentStatus: 'granted' },
      });
      // Fetch is in flight; the user rejects before it resolves.
      setConsentStatus('rejected');
      await flushAsync();

      expect(getInstance).not.toHaveBeenCalled();
      expect(antiFlickerUtils.removeAntiFlickerCss).toHaveBeenCalled();
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
