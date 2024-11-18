import { EvaluationFlag } from '../evaluation/flag';
import { HttpClient } from '../transport/http';
import { Base64 } from 'js-base64';

export type GetFlagsOptions = {
  libraryName: string;
  libraryVersion: string;
  evaluationMode?: string;
  timeoutMillis?: number;
};

export interface FlagApi {
  getFlags(
    options?: GetFlagsOptions,
    user?: Record<string, unknown>,
    deliveryMethod?: string | undefined,
  ): Promise<Record<string, EvaluationFlag>>;
}

export class SdkFlagApi implements FlagApi {
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

  public async getFlags(
    options?: GetFlagsOptions,
    user?: Record<string, unknown>,
    deliveryMethod?: string | undefined,
  ): Promise<Record<string, EvaluationFlag>> {
    const headers: Record<string, string> = {
      Authorization: `Api-Key ${this.deploymentKey}`,
    };
    if (options?.libraryName && options?.libraryVersion) {
      headers[
        'X-Amp-Exp-Library'
      ] = `${options.libraryName}/${options.libraryVersion}`;
    }
    if (user) {
      headers['X-Amp-Exp-User'] = Base64.encodeURL(JSON.stringify(user));
    }
    const response = await this.httpClient.request({
      requestUrl:
        `${this.serverUrl}/sdk/v2/flags` +
        (deliveryMethod ? `?delivery_method=${deliveryMethod}` : ''),
      method: 'GET',
      headers: headers,
      timeoutMillis: options?.timeoutMillis,
    });
    if (response.status != 200) {
      throw Error(`Flags error response: status=${response.status}`);
    }
    const flagsArray: EvaluationFlag[] = JSON.parse(
      response.body,
    ) as EvaluationFlag[];
    return flagsArray.reduce(
      (map: Record<string, EvaluationFlag>, flag: EvaluationFlag) => {
        map[flag.key] = flag;
        return map;
      },
      {},
    );
  }
}
