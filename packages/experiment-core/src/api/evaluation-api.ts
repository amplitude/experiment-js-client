import { Base64 } from 'js-base64';

import { FetchError } from '../evaluation/error';
import { EvaluationVariant } from '../evaluation/flag';
import { HttpClient } from '../transport/http';

export type GetVariantsOptions = {
  flagKeys?: string[];
  trackingOption?: string;
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
    if (options?.trackingOption) {
      headers['X-Amp-Exp-Track'] = options.trackingOption;
    }
    const response = await this.httpClient.request({
      requestUrl: `${this.serverUrl}/sdk/v2/vardata?v=0`,
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
