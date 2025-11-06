import { getGlobalScope } from '@amplitude/experiment-core';

import { PREVIEW_MODE_PARAM, PREVIEW_MODE_SESSION_KEY } from '../experiment';
import { PreviewState } from '../types';

import { getStorageItem } from './storage';

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
  const previewState = getStorageItem(
    'sessionStorage',
    PREVIEW_MODE_SESSION_KEY,
  ) as PreviewState;
  if (
    previewState?.previewFlags &&
    Object.keys(previewState.previewFlags).length > 0
  ) {
    return true;
  }
  return false;
};

/**
 * Extracts the root domain from a URL and returns it with a leading dot for cookie sharing.
 */
export const getCookieDomain = (url: string): string | undefined => {
  try {
    const hostname = new URL(url).hostname;

    if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
      return '.localhost';
    }
    // Special handling for Vercel and other platform domains
    // These are on the public suffix list and cannot have cookies set at the root
    const publicSuffixes = ['vercel.app', 'netlify.app', 'pages.dev'];

    for (const suffix of publicSuffixes) {
      if (hostname.endsWith(`.${suffix}`)) {
        // Return the full hostname without a leading dot
        // This sets the cookie for ONLY this specific subdomain
        return '.' + hostname;
      }
    }

    const parts = hostname.split('.');
    const rootDomain = parts.length <= 2 ? hostname : parts.slice(-2).join('.');

    return `.${rootDomain}`;
  } catch (error) {
    return undefined;
  }
};
