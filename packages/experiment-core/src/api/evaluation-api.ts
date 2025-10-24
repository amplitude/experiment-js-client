import { Base64 } from 'js-base64';

import { FetchError } from '../evaluation/error';
import { EvaluationVariant } from '../evaluation/flag';
import { HttpClient } from '../transport/http';

export type EvaluationMode = 'remote' | 'local';
export type DeliveryMethod = 'feature' | 'web';
export type TrackingOption = 'track' | 'no-track' | 'read-only'; // For tracking assignment events
export type ExposureTrackingOption = 'track' | 'no-track'; // For tracking exposure events

export type GetVariantsOptions = {
  flagKeys?: string[];
  trackingOption?: TrackingOption; // For tracking assignment events
  exposureTrackingOption?: ExposureTrackingOption; // For tracking exposure events
  deliveryMethod?: DeliveryMethod;
  evaluationMode?: EvaluationMode;
  timeoutMillis?: number;
};

export interface EvaluationApi {
  getVariants(
    user: Record<string, unknown>,
    options?: GetVariantsOptions,
  ): Promise<Record<string, EvaluationVariant>>;
}

export class SdkEvaluationApi implements EvaluationApi {
  private readonly deploymentKey: string;
  private readonly serverUrl: string;
  private readonly httpClient: HttpClient;

  constructor(
    deploymentKey: string,
    serverUrl: string,
    httpClient: HttpClient,
  ) {
    this.deploymentKey = deploymentKey;
    this.serverUrl = serverUrl;
    this.httpClient = httpClient;
  }

  async getVariants(
    user: Record<string, unknown>,
    options?: GetVariantsOptions,
  ): Promise<Record<string, EvaluationVariant>> {
    const userJsonBase64 = Base64.encodeURL(JSON.stringify(user));
    const headers: Record<string, string> = {
      Authorization: `Api-Key ${this.deploymentKey}`,
      'X-Amp-Exp-User': userJsonBase64,
    };
    if (options?.flagKeys) {
      headers['X-Amp-Exp-Flag-Keys'] = Base64.encodeURL(
        JSON.stringify(options.flagKeys),
      );
    }
    // For tracking assignment events
    if (options?.trackingOption) {
      headers['X-Amp-Exp-Track'] = options.trackingOption;
    }
    // For tracking exposure events
    if (options?.exposureTrackingOption) {
      headers['X-Amp-Exp-Exposure-Track'] = options.exposureTrackingOption;
    }
    const url = new URL(`${this.serverUrl}/sdk/v2/vardata?v=0`);
    if (options?.evaluationMode) {
      url.searchParams.append('eval_mode', options?.evaluationMode);
    }
    if (options?.deliveryMethod) {
      url.searchParams.append('delivery_method', options?.deliveryMethod);
    }
    const response = await this.httpClient.request({
      requestUrl: url.toString(),
      method: 'GET',
      headers: headers,
      timeoutMillis: options?.timeoutMillis,
    });
    if (response.status != 200) {
      throw new FetchError(
        response.status,
        `Fetch error response: status=${response.status}`,
      );
    }
    return JSON.parse(response.body);
  }
}
