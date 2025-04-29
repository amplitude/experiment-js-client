import { EvaluationVariant, getGlobalScope } from '@amplitude/experiment-core';
import { Variant } from '@amplitude/experiment-js-client';

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
  urlString = urlString.replace(/\/$/, '');

  return urlArray.some((url) => {
    url = url.replace(/\/$/, ''); // remove trailing slash
    url = url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // escape url for regex
    url = url.replace(/\\\*/, '.*'); // replace escaped * with .*
    const regex = new RegExp(`^${url}$`);
    // Check regex match with and without trailing slash. For example,
    // `https://example.com/*` would not match `https://example.com` without
    // this addition.
    return regex.test(urlString) || regex.test(urlString + '/');
  });
};

export const concatenateQueryParamsOf = (
  currentUrl: string,
  redirectUrl: string,
): string => {
  const globalUrlObj = new URL(currentUrl);
  const redirectUrlObj = new URL(redirectUrl);
  const resultUrlObj = new URL(redirectUrl);

  globalUrlObj.searchParams.forEach((value, key) => {
    if (!redirectUrlObj.searchParams.has(key)) {
      resultUrlObj.searchParams.append(key, value);
    }
  });

  return resultUrlObj.toString();
};

export const convertEvaluationVariantToVariant = (
  evaluationVariant: EvaluationVariant,
): Variant => {
  if (!evaluationVariant) {
    return {};
  }
  let experimentKey: string | undefined = undefined;
  if (evaluationVariant.metadata) {
    if (typeof evaluationVariant.metadata['experimentKey'] === 'string') {
      experimentKey = evaluationVariant.metadata['experimentKey'];
    } else {
      experimentKey = undefined;
    }
  }
  const variant: Variant = {};
  if (evaluationVariant.key) variant.key = evaluationVariant.key;
  if (evaluationVariant.value)
    variant.value = evaluationVariant.value as string;
  if (evaluationVariant.payload) variant.payload = evaluationVariant.payload;
  if (experimentKey) variant.expKey = experimentKey;
  if (evaluationVariant.metadata) variant.metadata = evaluationVariant.metadata;
  return variant;
};

export const runAfterHydration = (callback: () => void) => {
  if (typeof window === 'undefined') return; // SSR safety

  if (document.readyState === 'complete') {
    // Already loaded
    requestAnimationFrame(callback);
  } else {
    window.addEventListener('load', () => {
      requestAnimationFrame(callback);
    });
  }
};

export const removeAntiFlickerCss = () => {
  runAfterHydration(() => {
    document.getElementById?.('amp-exp-css')?.remove();
  });
};
