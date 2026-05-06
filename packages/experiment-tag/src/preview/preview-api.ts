import { EvaluationFlag } from '@amplitude/experiment-core';

import { version } from '../../package.json';
import { BehavioralTargetingRules, PageObjects } from '../types';

import { HttpClient } from './http';

export interface PreviewApi {
  getPreviewFlagsAndPageViewObjects(): Promise<{
    flags: EvaluationFlag[];
    pageViewObjects: PageObjects;
    behavioralTargetingRules?: BehavioralTargetingRules;
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
    behavioralTargetingRules?: BehavioralTargetingRules;
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
    const responseBody = JSON.parse(response.body);
    const flags: EvaluationFlag[] = responseBody.flags as EvaluationFlag[];
    const pageViewObjects: PageObjects =
      responseBody.pageObjects as PageObjects;
    const behavioralTargetingRules: BehavioralTargetingRules | undefined =
      responseBody.behavioralTargetingRules;
    return { flags, pageViewObjects, behavioralTargetingRules };
  }
}
