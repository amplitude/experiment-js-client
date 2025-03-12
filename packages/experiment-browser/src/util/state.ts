import { safeGlobal } from '@amplitude/experiment-core';

export type AmplitudeState = {
  deviceId?: string;
  userId?: string;
};

export const parseAmplitudeCookie = (
  apiKey: string,
  newFormat = false,
): AmplitudeState | undefined => {
  // Get the cookie value
  const key = generateKey(apiKey, newFormat);
  let value: string | undefined = undefined;
  const cookies = safeGlobal.document.cookie.split('; ');
  for (const cookie of cookies) {
    const [cookieKey, cookieValue] = cookie.split('=', 2);
    if (cookieKey === key) {
      value = decodeURIComponent(cookieValue);
    }
  }
  if (!value) {
    return;
  }
  // Parse cookie value depending on format
  try {
    // New format
    if (newFormat) {
      const decoding = Buffer.from(value, 'base64').toString('utf-8');
      return JSON.parse(decodeURIComponent(decoding)) as AmplitudeState;
    }
    // Old format
    const values = value.split('.');
    let userId = undefined;
    if (values.length >= 2 && values[1]) {
      userId = Buffer.from(values[1], 'base64').toString('utf-8');
    }
    return {
      deviceId: values[0],
      userId,
    };
  } catch (e) {
    return;
  }
};

export const parseAmplitudeLocalStorage = (
  apiKey: string,
): AmplitudeState | undefined => {
  const key = generateKey(apiKey, true);
  try {
    const value = safeGlobal.localStorage.getItem(key);
    if (!value) return;
    const state = JSON.parse(value);
    if (typeof state !== 'object') return;
    return state as AmplitudeState;
  } catch {
    return;
  }
};

export const parseAmplitudeSessionStorage = (
  apiKey: string,
): AmplitudeState | undefined => {
  const key = generateKey(apiKey, true);
  try {
    const value = safeGlobal.sessionStorage.getItem(key);
    if (!value) return;
    const state = JSON.parse(value);
    if (typeof state !== 'object') return;
    return state as AmplitudeState;
  } catch {
    return;
  }
};

const generateKey = (
  apiKey: string,
  newFormat: boolean,
): string | undefined => {
  if (newFormat) {
    if (apiKey?.length < 10) {
      return;
    }
    return `AMP_${apiKey.substring(0, 10)}`;
  }
  if (apiKey?.length < 6) {
    return;
  }
  return `amp_${apiKey.substring(0, 6)}`;
};
