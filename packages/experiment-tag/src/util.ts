export const getGlobalScope = (): typeof globalThis | undefined => {
  if (typeof globalThis !== 'undefined') {
    return globalThis;
  }
  if (typeof window !== 'undefined') {
    return window;
  }
  if (typeof self !== 'undefined') {
    return self;
  }
  if (typeof global !== 'undefined') {
    return global;
  }
  return undefined;
};

// Get URL parameters
export const getUrlParams = (): Record<string, string> => {
  const globalScope = getGlobalScope();
  const searchParams = new URLSearchParams(globalScope?.location.search);
  const params: Record<string, string> = {};
  for (const [key, value] of searchParams) {
    params[key] = value;
  }
  return params;
};

export const urlWithoutParamsAndAnchor = (url: string): string => {
  if (!url) {
    return '';
  }
  const urlObj = new URL(url);
  urlObj.search = '';
  urlObj.hash = '';
  return urlObj.toString();
};

export const removeQueryParams = (
  url: string,
  paramsToRemove: string[],
): string => {
  const urlObj = new URL(url);
  for (const param of paramsToRemove) {
    urlObj.searchParams.delete(param);
  }
  return urlObj.toString();
};

export const UUID = function (a?: any): string {
  return a // if the placeholder was passed, return
    ? // a random number from 0 to 15
      (
        a ^ // unless b is 8,
        ((Math.random() * // in which case
          16) >> // a random number from
          (a / 4))
      ) // 8 to 11
        .toString(16) // in hexadecimal
    : // or otherwise a concatenated string:
      (
        String(1e7) + // 10000000 +
        String(-1e3) + // -1000 +
        String(-4e3) + // -4000 +
        String(-8e3) + // -80000000 +
        String(-1e11)
      ) // -100000000000,
        .replace(
          // replacing
          /[018]/g, // zeroes, ones, and eights with
          UUID, // random hex digits
        );
};

export const matchesUrl = (urlArray: string[], urlString: string): boolean => {
  const cleanUrlString = urlString.replace(/\/$/, '');

  return urlArray.some((url) => {
    const cleanUrl = url.replace(/\/$/, '');
    return cleanUrl === cleanUrlString;
  });
};

export const isLocalStorageAvailable = (): boolean => {
  const globalScope = getGlobalScope();
  if (globalScope) {
    try {
      const testKey = 'EXP_test';
      globalScope.localStorage.setItem(testKey, testKey);
      globalScope.localStorage.removeItem(testKey);
      return true;
    } catch (e) {
      return false;
    }
  }
  return false;
};
