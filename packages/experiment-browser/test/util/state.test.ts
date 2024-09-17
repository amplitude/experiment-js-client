import { safeGlobal } from '@amplitude/experiment-core';
import {
  AmplitudeState,
  parseAmplitudeCookie,
  parseAmplitudeLocalStorage,
  parseAmplitudeSessionStorage,
} from 'src/util/state';

import { clearAllCookies } from './misc';

const apiKey = '1234567890abcdefabcdefabcdefabcd';

describe('parseAmplitudeCookie', () => {
  beforeEach(() => {
    clearAllCookies();
  });
  describe('new format', () => {
    test('amplitude cookie exists with valid format', () => {
      const state: AmplitudeState = {
        userId: 'user',
        deviceId: 'device',
      };
      const cookieValue = btoa(encodeURIComponent(JSON.stringify(state)));
      safeGlobal.document.cookie = 'k1=v1';
      safeGlobal.document.cookie = `AMP_1234567890=${cookieValue}`;
      safeGlobal.document.cookie = 'k3=v3';
      const result = parseAmplitudeCookie(apiKey, true);
      expect(result).toEqual(state);
    });
    test('amplitude cookie exists with invalid format', () => {
      const state: AmplitudeState = {
        userId: 'user',
        deviceId: 'device',
      };
      const cookieValue = JSON.stringify(state);
      safeGlobal.document.cookie = 'k1=v1';
      safeGlobal.document.cookie = `AMP_1234567890=${cookieValue}`;
      safeGlobal.document.cookie = 'k3=v3';
      const result = parseAmplitudeCookie(apiKey, true);
      expect(result).toBeUndefined();
    });
    test('amplitude cookie exists with different api key', () => {
      const state: AmplitudeState = {
        userId: 'user',
        deviceId: 'device',
      };
      const cookieValue = btoa(encodeURIComponent(JSON.stringify(state)));
      safeGlobal.document.cookie = 'k1=v1';
      safeGlobal.document.cookie = `AMP_abcdefabcd=${cookieValue}`;
      safeGlobal.document.cookie = 'k3=v3';
      const result = parseAmplitudeCookie(apiKey, true);
      expect(result).toBeUndefined();
    });
    test('amplitude cookie does not exist', () => {
      const result = parseAmplitudeCookie(apiKey, true);
      expect(result).toBeUndefined();
    });
  });
  describe('old format', () => {
    test('amplitude cookie exists with valid format', () => {
      const cookieValue = `device.${btoa('user')}........`;
      safeGlobal.document.cookie = 'k1=v1';
      safeGlobal.document.cookie = `amp_123456=${cookieValue}`;
      safeGlobal.document.cookie = 'k3=v3';
      const result = parseAmplitudeCookie(apiKey, false);
      expect(result).toEqual({
        userId: 'user',
        deviceId: 'device',
      });
    });
    test('amplitude cookie exists with different api key', () => {
      const cookieValue = `device.${btoa('user')}........`;
      safeGlobal.document.cookie = 'k1=v1';
      safeGlobal.document.cookie = `amp_abcdef=${cookieValue}`;
      safeGlobal.document.cookie = 'k3=v3';
      const result = parseAmplitudeCookie(apiKey, false);
      expect(result).toBeUndefined();
    });
    test('amplitude cookie exists with empty string', () => {
      safeGlobal.document.cookie = 'k1=v1';
      safeGlobal.document.cookie = `amp_123456=`;
      safeGlobal.document.cookie = 'k3=v3';
      const result = parseAmplitudeCookie(apiKey, false);
      expect(result).toBeUndefined();
    });
    test('amplitude cookie does not exist', () => {
      const result = parseAmplitudeCookie(apiKey, false);
      expect(result).toBeUndefined();
    });
  });
});

describe('parseAmplitudeLocalStorage', () => {
  beforeEach(() => {
    safeGlobal.localStorage.clear();
  });
  test('state exists with valid format', () => {
    const state: AmplitudeState = {
      userId: 'user',
      deviceId: 'device',
    };
    safeGlobal.localStorage.setItem('AMP_1234567890', JSON.stringify(state));
    const result = parseAmplitudeLocalStorage(apiKey);
    expect(result).toEqual(state);
  });
  test('state exists with invalid format', () => {
    safeGlobal.localStorage.setItem('AMP_1234567890', JSON.stringify('asdf'));
    const result = parseAmplitudeLocalStorage(apiKey);
    expect(result).toBeUndefined();
  });
  test('state exists with different api key', () => {
    const state: AmplitudeState = {
      userId: 'user',
      deviceId: 'device',
    };
    safeGlobal.localStorage.setItem('AMP_abcdefabcd', JSON.stringify(state));
    const result = parseAmplitudeLocalStorage(apiKey);
    expect(result).toBeUndefined();
  });
  test('state does not exist', () => {
    const result = parseAmplitudeLocalStorage(apiKey);
    expect(result).toBeUndefined();
  });
});

describe('parseAmplitudeSessionStorage', () => {
  beforeEach(() => {
    safeGlobal.sessionStorage.clear();
  });
  test('state exists with valid format', () => {
    const state: AmplitudeState = {
      userId: 'user',
      deviceId: 'device',
    };
    safeGlobal.sessionStorage.setItem('AMP_1234567890', JSON.stringify(state));
    const result = parseAmplitudeSessionStorage(apiKey);
    expect(result).toEqual(state);
  });
  test('state exists with invalid format', () => {
    safeGlobal.sessionStorage.setItem('AMP_1234567890', JSON.stringify('asdf'));
    const result = parseAmplitudeSessionStorage(apiKey);
    expect(result).toBeUndefined();
  });
  test('state exists with different api key', () => {
    const state: AmplitudeState = {
      userId: 'user',
      deviceId: 'device',
    };
    safeGlobal.sessionStorage.setItem('AMP_abcdefabcd', JSON.stringify(state));
    const result = parseAmplitudeSessionStorage(apiKey);
    expect(result).toBeUndefined();
  });
  test('state does not exist', () => {
    const result = parseAmplitudeSessionStorage(apiKey);
    expect(result).toBeUndefined();
  });
});
