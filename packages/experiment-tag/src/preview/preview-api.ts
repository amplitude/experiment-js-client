import { EvaluationFlag, HttpClient } from '@amplitude/experiment-core';

import { PageObjects } from '../types';

export type GetFlagsOptions = {
  libraryName: string;
  libraryVersion: string;
  timeoutMillis?: number;
};

export interface PreviewApi {
  getPreviewFlagsAndPageViewObjects(options?: GetFlagsOptions): Promise<{
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

  public async getPreviewFlagsAndPageViewObjects(
    options?: GetFlagsOptions,
  ): Promise<{
    flags: EvaluationFlag[];
    pageViewObjects: PageObjects;
  }> {
    const headers: Record<string, string> = {
      Authorization: `Api-Key ${this.deploymentKey}`,
    };
    if (options?.libraryName && options?.libraryVersion) {
      headers[
        'X-Amp-Exp-Library'
      ] = `${options.libraryName}/${options.libraryVersion}`;
    }
    const response = await this.httpClient.request({
      requestUrl: `${this.serverUrl}/web/v1/configs`,
      method: 'GET',
      headers: headers,
      timeoutMillis: options?.timeoutMillis,
    });
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
