import * as experimentCore from '@amplitude/experiment-core';

import { createMockGlobal } from '../util/mocks';

import { consentGate } from 'src/consent-gate';
import { DefaultWebExperimentClient } from 'src/experiment';
import { initialize, setConsentStatus } from 'src/index';
import { InitConfigs, WebExperimentConfig } from 'src/types';
import * as antiFlickerUtils from 'src/util/anti-flicker';

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

  test('consentRequired absent: starts immediately (unchanged path)', () => {
    init({});
    expect(getInstance).toHaveBeenCalledTimes(1);
  });

  test('consentRequired false: starts immediately', () => {
    init({ consentOptions: { consentRequired: false } });
    expect(getInstance).toHaveBeenCalledTimes(1);
  });

  test('required + initial granted: starts immediately', () => {
    init({
      consentOptions: { consentRequired: true, consentStatus: 'granted' },
    });
    expect(getInstance).toHaveBeenCalledTimes(1);
  });

  test('required + pending: does not construct or start', () => {
    init({
      consentOptions: { consentRequired: true, consentStatus: 'pending' },
    });
    expect(getInstance).not.toHaveBeenCalled();
  });

  test('required + no status: defaults to pending, does not start', () => {
    init({ consentOptions: { consentRequired: true } });
    expect(getInstance).not.toHaveBeenCalled();
  });

  test('required + rejected: does not start', () => {
    init({
      consentOptions: { consentRequired: true, consentStatus: 'rejected' },
    });
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

  test('rejected is terminal: pending -> rejected -> granted does not start', () => {
    init({
      consentOptions: { consentRequired: true, consentStatus: 'pending' },
    });
    setConsentStatus('rejected');
    expect(getInstance).not.toHaveBeenCalled();
    setConsentStatus('granted');
    expect(getInstance).not.toHaveBeenCalled();
  });

  test('rejected at load is terminal: a later grant does not start', () => {
    init({
      consentOptions: { consentRequired: true, consentStatus: 'rejected' },
    });
    setConsentStatus('granted');
    expect(getInstance).not.toHaveBeenCalled();
  });

  test('rejected is terminal even after pending again: no start on grant', () => {
    init({
      consentOptions: { consentRequired: true, consentStatus: 'pending' },
    });
    setConsentStatus('rejected');
    setConsentStatus('pending');
    setConsentStatus('granted');
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
