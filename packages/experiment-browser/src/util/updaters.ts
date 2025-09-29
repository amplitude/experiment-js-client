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
import { isEqual } from './equals';

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

/**
 * This updater streams the variants from the server and calls the onUpdate callback with the results.
 * This updater does not retry the stream if it fails, it will call the onError callback with the error.
 * If it encounters a non-retriable error, all future starts are errored.
 */
export class VariantsStreamUpdater implements VariantUpdater {
  private evaluationApi: StreamEvaluationApi;
  private hasNonretriableError = false;
  private streamOk = false;
  private lastParams: {user: ExperimentUser, options: GetVariantsOptions} | undefined;
  private onUpdate: VariantUpdateCallback | undefined;
  private onError: VariantErrorCallback | undefined;

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
    const {user, options} = params;
    
    if (this.streamOk && isEqual(this.lastParams?.user, user) && isEqual(this.lastParams?.options, options)) {
      this.onUpdate = onUpdate;
      this.onError = onError;
      return;
    }
    await this.stop();

    this.onUpdate = onUpdate;
    this.onError = onError;
    try {
      await this.evaluationApi.streamVariants(
        user,
        options,
        (data) => {
          this.onUpdate?.(data);
        },
        async (error) => {
          const onError = this.onError;
          await this.handleError(error);
          onError?.(error);
        },
      );
      this.streamOk = true;
      this.lastParams = {user, options};
    } catch (error) {
      console.error(
        '[Experiment] Stream updater failed to start: ' +
          error +
          error.statusCode,
      );
      await this.handleError(error);
      throw error;
    }
  }

  async handleError(error: Error): Promise<void> {
    await this.stop();
    if (!isErrorRetriable(error)) {
      this.hasNonretriableError = true;
      console.error(
        '[Experiment] Stream updater has non-retriable error: ' + error,
      );
    }
  }

  async stop(): Promise<void> {
    this.streamOk = false;
    await this.evaluationApi.close();
    this.onUpdate = undefined;
    this.onError = undefined;
  }
}

const fetchBackoffTimeout = 10000;
const fetchBackoffAttempts = 8;
const fetchBackoffMinMillis = 500;
const fetchBackoffMaxMillis = 10000;
const fetchBackoffScalar = 1.5;

/**
 * This updater fetches the variants from the server and calls the onUpdate callback with the results.
 * This updater does not continuously poll the server, it only fetches the variants once.
 * It will retry the fetch if it fails, with exponential backoff.
 * The retry will stop if the fetch succeeds or if the max number of retries is reached.
 * The retry will also stop if a non-retriable error is encountered.
 * The retry will also stop if the user calls the stop method.
 */
export class VariantsFetchUpdater implements Updater {
  private evaluationApi: EvaluationApi;
  retriesBackoff: Backoff;

  constructor(evaluationApi: EvaluationApi) {
    this.evaluationApi = evaluationApi;
  }

  /**
   * Perform a fetch to the server and call the onUpdate callback with the results.
   * If the fetch fails, it will retry the fetch with exponential backoff.
   * Always return success, even if the fetch fails.
   * @param onUpdate This callback is called with the results of the fetch.
   * @param onError This callback is ignored.
   * @param params The params object contains the user, config, and options.
   * @returns A promise that resolves when the first fetch finishes. Always resolves, even if the fetch fails.
   */
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
 * If it has falled back to fallback updater, if the fallback updated failed to start, it will retry starting the fallback updater.
 */
export class RetryAndFallbackWrapperUpdater implements Updater {
  private readonly mainUpdater: Updater;
  private readonly fallbackUpdater: Updater;
  private readonly retryIntervalMillisMin: number;
  private readonly retryIntervalMillisRange: number;
  private mainRetryTimer: NodeJS.Timeout | null = null; // To retry main updater after initial start.
  private fallbackRetryTimer: NodeJS.Timeout | null = null; // To make sure fallback start is retried if failed to start when main updater failed.

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

  /**
   * If main start succeeded, return.
   * If main start failed, start fallback updater.
   * If fallback start failed, throw exception.
   */
  async start(
    onUpdate: (data: unknown) => void,
    onError: (err: Error) => void,
    params: Record<string, unknown>,
  ): Promise<void> {
    await this.stop();

    try {
      await this.mainUpdater.start(
        onUpdate,
        async (err) => {
          this.fallbackUpdater
            .start(onUpdate, onError, params)
            .catch((error) => {
              this.startFallbackRetryTimer(onUpdate, onError, params);
            });
          this.startMainRetryTimer(onUpdate, onError, params);
        },
        params,
      );
    } catch (error) {
      await this.fallbackUpdater.start(onUpdate, onError, params);
      this.startMainRetryTimer(onUpdate, onError, params);
    }
  }

  startMainRetryTimer(onUpdate, onError, params) {
    if (this.mainRetryTimer) {
      clearTimeout(this.mainRetryTimer);
      this.mainRetryTimer = null;
    }

    const retryTimer = setTimeout(async () => {
      try {
        await this.mainUpdater.start(
          onUpdate,
          (err) => {
            this.fallbackUpdater
              .start(onUpdate, onError, params)
              .catch((error) => {
                this.startFallbackRetryTimer(onUpdate, onError, params);
              });
            this.startMainRetryTimer(onUpdate, onError, params);
          },
          params,
        );
      } catch {
        this.startMainRetryTimer(onUpdate, onError, params);
        return;
      }
      if (this.fallbackRetryTimer) {
        clearTimeout(this.fallbackRetryTimer);
        this.fallbackRetryTimer = null;
      }
      this.fallbackUpdater.stop();
    }, Math.ceil(this.retryIntervalMillisMin + Math.random() * this.retryIntervalMillisRange));
    this.mainRetryTimer = retryTimer;
  }

  startFallbackRetryTimer(onUpdate, onError, params) {
    if (this.fallbackRetryTimer) {
      clearTimeout(this.fallbackRetryTimer);
      this.fallbackRetryTimer = null;
    }
    const retryTimer = setTimeout(async () => {
      try {
        await this.fallbackUpdater.start(onUpdate, onError, params);
      } catch {
        this.startFallbackRetryTimer(onUpdate, onError, params);
      }
    }, Math.ceil(this.retryIntervalMillisMin + Math.random() * this.retryIntervalMillisRange));
    this.fallbackRetryTimer = retryTimer;
  }

  async stop(): Promise<void> {
    /*
     * No locks needed for await and asyncs.
     * If stop is called, the intervals are cancelled. Callbacks are not called.
     * If the callback has already started, the updater.start in callback is scheduled before the updater.stop in this stop() func.
     * So either no updater.start() is performed, or the updater.start() is scheduled before the updater.stop().
     */
    // Cancelling timers must be done before stopping the updaters.
    if (this.mainRetryTimer) {
      clearTimeout(this.mainRetryTimer);
      this.mainRetryTimer = null;
    }
    if (this.fallbackRetryTimer) {
      clearTimeout(this.fallbackRetryTimer);
      this.fallbackRetryTimer = null;
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
