import * as experimentCore from '@amplitude/experiment-core';

import { activateConsent } from '../consent/consent-test-util';
import { createMockGlobal } from '../util/mocks';

import { consentGate } from 'src/consent/consent-gate';
import { readPreviewState, writePreviewState } from 'src/preview/preview-state';
import * as cookie from 'src/util/cookie';
import { PREVIEW_MODE_SESSION_KEY } from 'src/util/storage-keys';

describe('preview-state', () => {
  let globalScope: ReturnType<typeof createMockGlobal>;

  beforeEach(() => {
    jest.restoreAllMocks();
    consentGate.reset();
    globalScope = createMockGlobal();
    jest
      .spyOn(experimentCore, 'getGlobalScope')
      .mockReturnValue(globalScope as never);
  });

  it('writes sessionStorage and a root-domain cookie', () => {
    jest.spyOn(cookie, 'getTopLevelDomainSync').mockReturnValue('.test.com');
    const writeSpy = jest.spyOn(cookie, 'writeRawCookie');
    const state = { previewFlags: { flag: 'treatment' } };

    writePreviewState(state);

    expect(
      globalScope.sessionStorage.getItem(PREVIEW_MODE_SESSION_KEY),
    ).toEqual(JSON.stringify(state));
    expect(writeSpy).toHaveBeenCalledWith(
      PREVIEW_MODE_SESSION_KEY,
      JSON.stringify(state),
      { domain: '.test.com' },
    );
  });

  it('writes the cookie while consent is pending', () => {
    activateConsent('pending');
    jest.spyOn(cookie, 'getTopLevelDomainSync').mockReturnValue('.test.com');
    const writeSpy = jest.spyOn(cookie, 'writeRawCookie');

    writePreviewState({ previewFlags: { flag: 'treatment' } });

    expect(writeSpy).toHaveBeenCalled();
    expect(
      globalScope.sessionStorage.getItem(PREVIEW_MODE_SESSION_KEY),
    ).toEqual(JSON.stringify({ previewFlags: { flag: 'treatment' } }));
  });

  it('restores from the cookie when sessionStorage is empty', () => {
    const state = { previewFlags: { flag: 'treatment' } };
    jest.spyOn(cookie, 'readRawCookie').mockReturnValue(JSON.stringify(state));

    expect(readPreviewState()).toEqual(state);
    expect(
      globalScope.sessionStorage.getItem(PREVIEW_MODE_SESSION_KEY),
    ).toEqual(JSON.stringify(state));
  });

  it('prefers sessionStorage over the cookie', () => {
    globalScope.sessionStorage.setItem(
      PREVIEW_MODE_SESSION_KEY,
      JSON.stringify({ previewFlags: { flag: 'control' } }),
    );
    jest
      .spyOn(cookie, 'readRawCookie')
      .mockReturnValue(JSON.stringify({ previewFlags: { flag: 'treatment' } }));

    expect(readPreviewState()).toEqual({ previewFlags: { flag: 'control' } });
  });

  it('returns null for an empty or malformed cookie', () => {
    jest.spyOn(cookie, 'readRawCookie').mockReturnValue('{');
    expect(readPreviewState()).toBeNull();

    jest
      .spyOn(cookie, 'readRawCookie')
      .mockReturnValue(JSON.stringify({ previewFlags: {} }));
    expect(readPreviewState()).toBeNull();
  });
});
