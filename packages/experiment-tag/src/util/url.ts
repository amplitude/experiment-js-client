import { getGlobalScope } from '@amplitude/experiment-core';

import { PREVIEW_MODE_PARAM, PREVIEW_MODE_SESSION_KEY } from '../experiment';
import { getAndParseStorageItem, getRawStorageItem } from '../storage/storage';
import { PreviewState } from '../types';

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
  const hashIndex = url.indexOf('#');
  const hasHashPath =
    hashIndex !== -1 && url.substring(hashIndex + 1).startsWith('/');

  if (!hasHashPath) {
    const urlObj = new URL(url);
    for (const param of paramsToRemove) {
      urlObj.searchParams.delete(param);
    }
    return urlObj.toString();
  }

  // Hash-based routing handling
  const [urlWithoutHash, hash] = url.split('#');
  const hashObj = new URL(`http://dummy.com/${hash}`);

  for (const param of paramsToRemove) {
    hashObj.searchParams.delete(param);
  }

  const newHash = hashObj.pathname.substring(1) + hashObj.search;
  return `${urlWithoutHash}#${newHash}`;
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

export const isPreviewMode = (): boolean => {
  if (getUrlParams()[PREVIEW_MODE_PARAM] === 'true') {
    return true;
  }
  const previewState = getAndParseStorageItem<PreviewState>(
    'sessionStorage',
    PREVIEW_MODE_SESSION_KEY,
  );
  return !!(
    previewState?.previewFlags &&
    Object.keys(previewState.previewFlags).length > 0
  );
};
