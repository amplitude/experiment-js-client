/* eslint-disable no-empty */
import path from 'path';

import {
  EvaluationVariant,
  GetVariantsOptions,
  SdkEvaluationApi,
  SdkStreamEvaluationApi,
  StreamEvaluationApi,
} from '@amplitude/experiment-core';
import * as dotenv from 'dotenv';
import EventSource from 'eventsource';

import { Defaults } from '../src/config';
import { FetchHttpClient, WrapperClient } from '../src/transport/http';

import { sleep } from './util/misc';

dotenv.config({
  path: path.join(
    __dirname,
    '../',
    process.env['ENVIRONMENT'] ? '.env.' + process.env['ENVIRONMENT'] : '.env',
  ),
});

if (!process.env['MANAGEMENT_API_KEY']) {
  throw new Error(
    'No env vars found. If running on local, have you created .env file correct environment variables? Checkout README.md',
  );
}

const SERVER_URL = process.env['SERVER_URL'] || Defaults.serverUrl;
const STREAM_SERVER_URL =
  process.env['STREAM_SERVER_URL'] || Defaults.streamVariantsServerUrl;
const MANAGEMENT_API_SERVER_URL =
  process.env['MANAGEMENT_API_SERVER_URL'] ||
  'https://experiment.amplitude.com';
const DEPLOYMENT_KEY =
  process.env['DEPLOYMENT_KEY'] || 'client-DvWljIjiiuqLbyjqdvBaLFfEBrAvGuA3';
const MANAGEMENT_API_KEY = process.env['MANAGEMENT_API_KEY'];
const FLAG_KEY = 'sdk-ci-stream-vardata-test';

const USER = {};
const OPTIONS: GetVariantsOptions = {};

// Test stream is successfully connected and data is valid.
// The main purpose is to test and ensure the SDK stream interface works with stream server.
// This test may be flaky if multiple edits to the flag happens simultaneously,
// i.e. multiple invocation of this test is run at the same time.
// If two edits are made in a very very very short period (few seconds), the first edit may not be streamed.
jest.retryTimes(2);

describe('SDK stream', () => {

  let api: StreamEvaluationApi;
  beforeEach(() => {
    jest.clearAllMocks();
    api = new SdkStreamEvaluationApi(
      DEPLOYMENT_KEY,
      STREAM_SERVER_URL,
      (url, params) => {
        return new EventSource(url, params);
      },
      5000, // A bit more generous timeout than the default.
    );
  });

  afterEach(() => {
    api.close();
  });

  test('SDK stream is compatible with stream server (flaky possible, see comments)', async () => {
    const streamVariants: Record<string, EvaluationVariant>[] = [];
    let streamError = undefined;
    const connectedPromise = new Promise<void>((resolve, reject) => {
      api
        .streamVariants(
          USER,
          OPTIONS,
          (variants: Record<string, EvaluationVariant>) => {
            streamVariants.push(variants);
            resolve();
          },
          (err) => {
            streamError = err;
            reject(err);
          },
        )
        .catch((err) => {
          reject(err);
        });
    });
    await connectedPromise;

    // Get variant from the fetch api to compare.
    const httpClient = FetchHttpClient;
    const fetchApi = new SdkEvaluationApi(
      DEPLOYMENT_KEY,
      SERVER_URL,
      new WrapperClient(httpClient),
    );
    const fetchVariants = await fetchApi.getVariants(USER, OPTIONS);

    // At least one vardata streamed should be the same as the one fetched.
    // There can be other updates after stream establishment and before fetch.
    await sleep(5000); // Assume there's an update right before fetch but after stream, wait for stream to receive that data.
    expect(
      // Find the one that match using payload of our test flag.
      streamVariants.filter(
        (f) => f[FLAG_KEY]['payload'] === fetchVariants[FLAG_KEY]['payload'],
      )[0],
    ).toStrictEqual(fetchVariants);

    // Test that stream is kept alive.
    await sleep(40000);
    expect(streamError).toBeUndefined();

    // Get flag id using management-api.
    const getFlagIdRequest = await httpClient.request(
      `${MANAGEMENT_API_SERVER_URL}/api/1/flags?key=${FLAG_KEY}`,
      'GET',
      {
        Authorization: 'Bearer ' + MANAGEMENT_API_KEY,
        'Content-Type': 'application/json',
        Accept: '*/*',
      },
      '',
    );
    expect(getFlagIdRequest.status).toBe(200);
    const flagId = JSON.parse(getFlagIdRequest.body)['flags'][0]['id'];

    // Call management api to edit deployment. Then wait for stream to update.
    const randNumber = Math.random();
    const modifyFlagReq = await httpClient.request(
      `${MANAGEMENT_API_SERVER_URL}/api/1/flags/${flagId}/variants/on`,
      'PATCH',
      {
        Authorization: 'Bearer ' + MANAGEMENT_API_KEY,
        'Content-Type': 'application/json',
        Accept: '*/*',
      },
      `{"payload": ${randNumber}}`,
      10000,
    );
    expect(modifyFlagReq.status).toBe(200);
    await sleep(5000); // 5s is generous enough for update to stream.

    // Check that at least one of the updates happened during this time have the random number we generated.
    // This means that the stream is working and we are getting updates.
    expect(
      streamVariants.filter((f) => f[FLAG_KEY]['payload'] === randNumber).length,
    ).toBeGreaterThanOrEqual(1);
  }, 60000);
});