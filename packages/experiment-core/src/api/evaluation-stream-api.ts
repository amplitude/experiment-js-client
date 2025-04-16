import { Base64 } from 'js-base64';
import { DEFAULT_EVENT_TYPE, SSEProvider, SSEStream } from 'transport/stream';

import { EvaluationVariant } from '../evaluation/flag';

import { EvaluationApi, GetVariantsOptions } from './evaluation-api';

const STREAM_CONNECTION_TIMEOUT_MILLIS = 3000;

export interface StreamEvaluationApi {
  streamVariants(
    user: Record<string, unknown>,
    options?: GetVariantsOptions,
    onUpdate?: (variants: Record<string, EvaluationVariant>) => void,
    onError?: (error: Error) => void,
  ): Promise<void>;
  close(): Promise<void>;
}

export class SdkStreamEvaluationApi implements StreamEvaluationApi {
  private readonly deploymentKey: string;
  private readonly serverUrl: string;
  private readonly sseProvider: SSEProvider;
  private readonly fetchEvalApi?: EvaluationApi;
  private readonly connectionTimeoutMillis: number;

  private stream?: SSEStream;

  constructor(
    deploymentKey: string,
    serverUrl: string,
    sseProvider: SSEProvider,
    connectionTimeoutMillis = STREAM_CONNECTION_TIMEOUT_MILLIS,
    fetchEvalApi?: EvaluationApi,
  ) {
    this.deploymentKey = deploymentKey;
    this.serverUrl = serverUrl;
    this.sseProvider = sseProvider;
    this.connectionTimeoutMillis = connectionTimeoutMillis;
    this.fetchEvalApi = fetchEvalApi;
  }

  async streamVariants(
    user: Record<string, unknown>,
    options?: GetVariantsOptions,
    onUpdate?: (variants: Record<string, EvaluationVariant>) => void,
    onError?: (error: Error) => void,
  ): Promise<void> {
    if (this.stream) {
      await this.close();
    }

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

    const url = new URL(`${this.serverUrl}/sdk/stream/v1/vardata`);
    if (options?.evaluationMode) {
      url.searchParams.append('eval_mode', options?.evaluationMode);
    }
    if (options?.deliveryMethod) {
      url.searchParams.append('delivery_method', options?.deliveryMethod);
    }

    return new Promise<void>((resolve, reject) => {
      this.stream = new SSEStream(this.sseProvider, url.toString(), headers);
      let isConnecting = true;

      const connectionTimeout = setTimeout(() => {
        if (isConnecting) {
          this.close();
          reject(new Error('Connection timed out.'));
        }
      }, this.connectionTimeoutMillis);

      const onErrorSseCb = (error: Error) => {
        if (isConnecting) {
          isConnecting = false;
          this.close();
          clearTimeout(connectionTimeout);
          reject(error);
        } else {
          this.close();
          onError?.(error);
        }
      };
      const onDataUpdateSseCb = (data: string) => {
        if (isConnecting) {
          isConnecting = false;
          const variants = JSON.parse(data);
          clearTimeout(connectionTimeout);
          resolve();
          onUpdate?.(variants);
        } else {
          onUpdate?.(JSON.parse(data));
        }
      };
      const onSignalUpdateCb = async () => {
        // Signaled that there's a push.
        if (isConnecting) {
          isConnecting = false;
          clearTimeout(connectionTimeout);
          resolve();
        }
        if (!this.fetchEvalApi) {
          onErrorSseCb(
            new Error(
              'No fetchEvalApi provided for variant data that is too large to push.',
            ),
          );
          return;
        }

        let variants;
        try {
          variants = await this.fetchEvalApi.getVariants(user, options);
        } catch (error) {
          onErrorSseCb(
            new Error('Error fetching variants on signal: ' + error),
          );
        }
        onUpdate?.(variants || {});
      };

      this.stream.connect(
        {
          push_data: onDataUpdateSseCb,
          push_signal: onSignalUpdateCb,
          [DEFAULT_EVENT_TYPE]: onDataUpdateSseCb,
        },
        onErrorSseCb,
      );
    });
  }

  async close(): Promise<void> {
    this.stream?.close();
    this.stream = undefined;
  }
}
