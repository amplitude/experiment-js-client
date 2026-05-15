import { safeGlobal, TimeoutError } from '@amplitude/experiment-core';
import unfetch from 'unfetch';

export interface SimpleResponse {
  status: number;
  body: string;
}

export interface HttpClient {
  request(
    url: string,
    method: string,
    headers: Record<string, string>,
    data: string | null,
    timeout?: number,
  ): Promise<SimpleResponse>;
}

const fetch = safeGlobal?.fetch || unfetch;

const withTimeout = (
  promise: Promise<SimpleResponse>,
  ms?: number,
): Promise<SimpleResponse> => {
  if (!ms || ms <= 0) return promise;

  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new TimeoutError(`Timeout after ${ms}ms`)), ms),
    ),
  ]);
};

const makeRequest = async (
  url: string,
  method: string,
  headers: Record<string, string>,
  data: string,
  timeout?: number,
): Promise<SimpleResponse> => {
  const request = async () => {
    const response = await fetch(url, { method, headers, body: data });
    return {
      status: response.status,
      body: await response.text(),
    };
  };

  return withTimeout(request(), timeout);
};

export const HttpClient: HttpClient = { request: makeRequest };
