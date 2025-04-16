import {
  EvaluationApi,
  EvaluationVariant,
  FetchError,
  GetVariantsOptions,
  StreamEvaluationApi,
  TimeoutError,
} from '@amplitude/experiment-core';

import { ExperimentConfig } from '../config';
import { FetchOptions } from '../types/client';
import { ExperimentUser } from '../types/user';

import { Backoff } from './backoff';

export interface Updater {
  start(
    onUpdate: (data: unknown) => void,
    onError: (err: Error) => void,
    params?: Record<string, unknown>,
  ): Promise<void>;
  stop(): Promise<void>;
}

type VariantUpdateCallback = (data: Record<string, EvaluationVariant>) => void;
type VariantErrorCallback = (err: Error) => void;
type VariantUpdaterParams = {
  user: ExperimentUser;
  config: ExperimentConfig;
  options: GetVariantsOptions;
};
export interface VariantUpdater extends Updater {
  start(
    onUpdate: VariantUpdateCallback,
    onError: VariantErrorCallback,
    params: VariantUpdaterParams,
  ): Promise<void>;
  stop(): Promise<void>;
}

function isErrorRetriable(e: Error | ErrorEvent): boolean {
  if (e instanceof FetchError) {
    const ferr = e as FetchError;
    return (
      ferr.statusCode < 400 || ferr.statusCode >= 500 || ferr.statusCode === 429
    );
  }

  return true;
}

export class VariantsStreamUpdater implements VariantUpdater {
  private evaluationApi: StreamEvaluationApi;
  private hasNonretriableError = false;

  constructor(evaluationApi: StreamEvaluationApi) {
    this.evaluationApi = evaluationApi;
  }

  async start(
    onUpdate: VariantUpdateCallback,
    onError: VariantErrorCallback,
    params: VariantUpdaterParams,
  ): Promise<void> {
    if (this.hasNonretriableError) {
      throw new Error('Stream updater has non-retriable error, not starting');
    }
    try {
      await this.evaluationApi.streamVariants(
        params.user,
        params.options,
        onUpdate,
        (error) => {
          this.handleError(error);
          onError(error);
        },
      );
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  handleError(error: Error) {
    if (!isErrorRetriable(error)) {
      this.hasNonretriableError = true;
      console.error(
        '[Experiment] Stream updater has non-retriable error: ' + error,
      );
    }
  }

  async stop(): Promise<void> {
    await this.evaluationApi.close();
  }
}

const fetchBackoffTimeout = 10000;
const fetchBackoffAttempts = 8;
const fetchBackoffMinMillis = 500;
const fetchBackoffMaxMillis = 10000;
const fetchBackoffScalar = 1.5;

export class VariantsFetchUpdater implements Updater {
  private evaluationApi: EvaluationApi;
  retriesBackoff: Backoff;
  constructor(evaluationApi: EvaluationApi) {
    this.evaluationApi = evaluationApi;
  }

  async start(
    onUpdate: VariantUpdateCallback,
    onError: VariantErrorCallback,
    params: VariantUpdaterParams,
  ): Promise<void> {
    const { user, config, options } = params;

    try {
      if (config.retryFetchOnFailure) {
        this.stopRetries();
      }

      try {
        await this.fetchInternal(
          user,
          options,
          config.fetchTimeoutMillis,
          onUpdate,
        );
      } catch (e) {
        if (config.retryFetchOnFailure && isErrorRetriable(e)) {
          void this.startRetries(user, options, onUpdate);
        }
        throw e;
      }
    } catch (e) {
      if (config.debug) {
        if (e instanceof TimeoutError) {
          console.debug(e);
        } else {
          console.error(e);
        }
      }
    }
  }

  private async fetchInternal(
    user: ExperimentUser,
    options: FetchOptions,
    timeoutMillis: number,
    onUpdate: (data: Record<string, EvaluationVariant>) => void,
  ): Promise<void> {
    const results = await this.evaluationApi.getVariants(user, {
      timeoutMillis: timeoutMillis,
      ...options,
    });
    onUpdate(results);
  }

  private async startRetries(
    user: ExperimentUser,
    options: FetchOptions,
    onUpdate: (data: Record<string, EvaluationVariant>) => void,
  ): Promise<void> {
    // this.debug('[Experiment] Retry fetch');
    this.retriesBackoff = new Backoff(
      fetchBackoffAttempts,
      fetchBackoffMinMillis,
      fetchBackoffMaxMillis,
      fetchBackoffScalar,
    );
    void this.retriesBackoff.start(async () => {
      await this.fetchInternal(user, options, fetchBackoffTimeout, onUpdate);
    });
  }

  private stopRetries(): void {
    if (this.retriesBackoff) {
      this.retriesBackoff.cancel();
    }
  }
  async stop(): Promise<void> {
    this.stopRetries();
  }
}

/**
 * This class retries the main updater and, if it fails, falls back to the fallback updater.
 * The main updater will keep retrying every set interval and, if succeeded, the fallback updater will be stopped.
 */

export class RetryAndFallbackWrapperUpdater implements Updater {
  private readonly mainUpdater: Updater;
  private readonly fallbackUpdater: Updater;
  private readonly retryIntervalMillisMin: number;
  private readonly retryIntervalMillisRange: number;
  private retryTimer: NodeJS.Timeout | null = null;

  constructor(
    mainUpdater: Updater,
    fallbackUpdater: Updater,
    retryIntervalMillis: number,
  ) {
    this.mainUpdater = mainUpdater;
    this.fallbackUpdater = fallbackUpdater;
    this.retryIntervalMillisMin = retryIntervalMillis * 0.8;
    this.retryIntervalMillisRange =
      retryIntervalMillis * 1.2 - this.retryIntervalMillisMin;
  }

  async start(
    onUpdate: VariantUpdateCallback,
    onError: VariantErrorCallback,
    params: VariantUpdaterParams,
  ): Promise<void> {
    await this.stop();

    try {
      await this.mainUpdater.start(
        onUpdate,
        (err) => {
          this.fallbackUpdater.start(onUpdate, onError, params);
          this.startRetryTimer(onUpdate, onError, params);
        },
        params,
      );
    } catch (error) {
      await this.fallbackUpdater.start(onUpdate, onError, params);
      this.startRetryTimer(onUpdate, onError, params);
    }
  }

  async startRetryTimer(onUpdate, onError, params) {
    if (this.retryTimer) {
      clearInterval(this.retryTimer);
      this.retryTimer = null;
    }

    const retryTimer = setInterval(async () => {
      try {
        await this.mainUpdater.start(
          onUpdate,
          (err) => {
            this.fallbackUpdater.start(onUpdate, onError, params);
            this.startRetryTimer(onUpdate, onError, params);
          },
          params,
        );
        this.fallbackUpdater.stop();
        clearInterval(retryTimer);
        if (this.retryTimer) {
          clearInterval(this.retryTimer);
          this.retryTimer = null;
        }
      } catch (error) {
        console.error('Retry failed', error);
      }
    }, Math.ceil(this.retryIntervalMillisMin + Math.random() * this.retryIntervalMillisRange));
    this.retryTimer = retryTimer;
  }

  async stop(): Promise<void> {
    if (this.retryTimer) {
      clearInterval(this.retryTimer);
      this.retryTimer = null;
    }
    await this.mainUpdater.stop();
    await this.fallbackUpdater.stop();
  }
}

export class VariantsRetryAndFallbackWrapperUpdater
  extends RetryAndFallbackWrapperUpdater
  implements VariantUpdater
{
  constructor(
    mainUpdater: VariantUpdater,
    fallbackUpdater: VariantUpdater,
    retryIntervalMillis: number,
  ) {
    super(mainUpdater, fallbackUpdater, retryIntervalMillis);
  }

  async start(
    onUpdate: VariantUpdateCallback,
    onError: VariantErrorCallback,
    params: VariantUpdaterParams,
  ): Promise<void> {
    return super.start(onUpdate, onError, params);
  }
}
