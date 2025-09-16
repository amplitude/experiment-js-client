import { EvaluationFlag } from '@amplitude/experiment-core';

import { version } from '../../package.json';
import { PageObjects } from '../types';

import { HttpClient } from './http';

export interface PreviewApi {
  getPreviewFlagsAndPageViewObjects(): Promise<{
    flags: EvaluationFlag[];
    pageViewObjects: PageObjects;
  }>;
}

export class SdkPreviewApi implements PreviewApi {
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

  public async getPreviewFlagsAndPageViewObjects(): Promise<{
    flags: EvaluationFlag[];
    pageViewObjects: PageObjects;
  }> {
    const headers: Record<string, string> = {
      Authorization: `Api-Key ${this.deploymentKey}`,
    };
    headers['X-Amp-Exp-Library'] = `experiment-tag/${version}`;
    const response = await this.httpClient.request(
      `${this.serverUrl}/web/v1/configs`,
      'GET',
      headers,
      null,
      10000,
    );
    if (response.status != 200) {
      throw Error(`Preview error response: status=${response.status}`);
    }
    const flags: EvaluationFlag[] = JSON.parse(response.body)
      .flags as EvaluationFlag[];
    const pageViewObjects: PageObjects = JSON.parse(response.body)
      .pageObjects as PageObjects;
    return { flags, pageViewObjects };
  }
}
