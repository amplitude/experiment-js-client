/**
 * @packageDocumentation
 * @internal
 */

import unfetch from 'unfetch';

import { HttpClient } from '../types/transport';
import { safeGlobal } from '../util/global';

const fetch = safeGlobal.fetch || unfetch;

/*
 * Copied from:
 * https://github.com/github/fetch/issues/175#issuecomment-284787564
 */
const timeout = (
  promise: Promise<Response>,
  timeoutMillis?: number,
): Promise<Response> => {
  // Dont timeout if timeout is null or invalid
  if (timeoutMillis == null || timeoutMillis <= 0) {
    return promise;
  }
  return new Promise(function (resolve, reject) {
    safeGlobal.setTimeout(function () {
      reject(Error('Request timeout after ' + timeoutMillis + ' milliseconds'));
    }, timeoutMillis);
    promise.then(resolve, reject);
  });
};

const request: HttpClient['request'] = (
  requestUrl: string,
  method: string,
  headers: Record<string, string>,
  data?: Record<string, string>,
  timeoutMillis?: number,
): Promise<Response> => {
  return timeout(
    fetch(requestUrl, {
      method,
      headers,
      body: data && JSON.stringify(data),
    }),
    timeoutMillis,
  );
};

export const FetchHttpClient: HttpClient = { request };
