/**
 * @packageDocumentation
 * @internal
 */

import unfetch from 'unfetch';

import { HttpClient, SimpleResponse } from '../types/transport';
import { safeGlobal } from '../util/global';

const fetch = safeGlobal.fetch || unfetch;

/*
 * Copied from:
 * https://github.com/github/fetch/issues/175#issuecomment-284787564
 */
const timeout = (
  promise: Promise<SimpleResponse>,
  timeoutMillis?: number,
): Promise<SimpleResponse> => {
  // Don't timeout if timeout is null or invalid
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
  data: string,
  timeoutMillis?: number,
): Promise<SimpleResponse> => {
  const call = async () => {
    const response = await fetch(requestUrl, {
      method: method,
      headers: headers,
      body: data,
    });
    const simpleResponse: SimpleResponse = {
      status: response.status,
      body: await response.text(),
    };
    return simpleResponse;
  };
  return timeout(call(), timeoutMillis);
};

export const FetchHttpClient: HttpClient = { request };
