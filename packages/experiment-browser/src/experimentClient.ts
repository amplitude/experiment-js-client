/**
 * @packageDocumentation
 * @module experiment-js-client
 */

import {
  EvaluationApi,
  EvaluationEngine,
  EvaluationFlag,
  EvaluationVariant,
  FlagApi,
  Poller,
  SdkEvaluationApi,
  SdkFlagApi,
  topologicalSort,
} from '@amplitude/experiment-core';

import { version as PACKAGE_VERSION } from '../package.json';

import { ExperimentConfig, Defaults } from './config';
import { ConnectorUserProvider } from './integration/connector';
import { DefaultUserProvider } from './integration/default';
import {
  getFlagStorage,
  getVariantStorage,
  LoadStoreCache,
} from './storage/cache';
import { LocalStorage } from './storage/local-storage';
import { FetchHttpClient, WrapperClient } from './transport/http';
import { exposureEvent } from './types/analytics';
import { Client, FetchOptions } from './types/client';
import { ExposureTrackingProvider } from './types/exposure';
import { ExperimentUserProvider } from './types/provider';
import { isFallback, Source, VariantSource } from './types/source';
import { ExperimentUser } from './types/user';
import { Variant, Variants } from './types/variant';
import { isNullOrUndefined } from './util';
import { Backoff } from './util/backoff';
import { SessionAnalyticsProvider } from './util/sessionAnalyticsProvider';
import { SessionExposureTrackingProvider } from './util/sessionExposureTrackingProvider';

// Configs which have been removed from the public API.
// May be added back in the future.
const fetchBackoffTimeout = 10000;
const fetchBackoffAttempts = 8;
const fetchBackoffMinMillis = 500;
const fetchBackoffMaxMillis = 10000;
const fetchBackoffScalar = 1.5;
const flagPollerIntervalMillis = 60000;

/**
 * The default {@link Client} used to fetch variations from Experiment's
 * servers.
 *
 * @category Core Usage
 */
export class ExperimentClient implements Client {
  private readonly apiKey: string;
  private readonly config: ExperimentConfig;
  private readonly variants: LoadStoreCache<Variant>;
  private readonly flags: LoadStoreCache<EvaluationFlag>;
  private readonly flagApi: FlagApi;
  private readonly evaluationApi: EvaluationApi;
  private readonly engine: EvaluationEngine = new EvaluationEngine();
  private user: ExperimentUser | undefined;
  private userProvider: ExperimentUserProvider | undefined;
  private exposureTrackingProvider: ExposureTrackingProvider | undefined;
  private retriesBackoff: Backoff | undefined;
  private poller: Poller = new Poller(
    () => this.doFlags(),
    flagPollerIntervalMillis,
  );

  // Deprecated
  private analyticsProvider: SessionAnalyticsProvider | undefined;

  /**
   * Creates a new ExperimentClient instance.
   *
   * In most cases you will want to use the `initialize` factory method in
   * {@link Experiment}.
   *
   * @param apiKey The Client key for the Experiment project
   * @param config See {@link ExperimentConfig} for config options
   */
  public constructor(apiKey: string, config: ExperimentConfig) {
    this.apiKey = apiKey;
    // Merge configs with defaults and wrap providers
    this.config = { ...Defaults, ...config };
    if (this.config.userProvider) {
      this.userProvider = this.config.userProvider;
    }
    if (this.config.analyticsProvider) {
      this.analyticsProvider = new SessionAnalyticsProvider(
        this.config.analyticsProvider,
      );
    }
    if (this.config.exposureTrackingProvider) {
      this.exposureTrackingProvider = new SessionExposureTrackingProvider(
        this.config.exposureTrackingProvider,
      );
    }
    // Setup Remote APIs
    const httpClient = new WrapperClient(
      this.config.httpClient || FetchHttpClient,
    );
    this.flagApi = new SdkFlagApi(
      this.apiKey,
      this.config.serverUrl,
      httpClient,
    );
    this.evaluationApi = new SdkEvaluationApi(
      this.apiKey,
      this.config.serverUrl,
      httpClient,
    );
    // Storage & Caching
    const storage = new LocalStorage();
    this.variants = getVariantStorage(
      this.apiKey,
      this.config.instanceName,
      storage,
    );
    this.flags = getFlagStorage(this.apiKey, this.config.instanceName, storage);
    void this.flags.load();
    void this.variants.load();
  }

  /**
   * Start the SDK by getting flag configurations from the server. The promise
   * returned by this function resolves when the SDK has received updated flag
   * configurations and is ready to locally evaluate flags when the
   * {@link variant} function is called. This function also starts polling
   * for flag configuration updates at an interval.
   *
   * <p />
   *
   * If you also have remote evaluation flags, use {@link fetch} to evaluate
   * those flags remotely and await both the promises.
   *
   * <p />
   *
   * For example, to await both local and remote evaluation readiness:
   *
   * <pre>
   *   const p1 = client.start();
   *   const p2 = client.fetch();
   *   await Promise.all([p1, p2]);
   * </pre>
   * <p />
   * @param user
   * @see {@link variant}, {@link fetch}
   */
  public async start(user?: ExperimentUser): Promise<Client> {
    if (this.poller.isRunning()) {
      return this;
    }
    this.setUser(user);
    const analyticsReadyPromise = this.addContextOrWait(user, 10000);
    const flagsReadyPromise = this.doFlags();
    await Promise.all([analyticsReadyPromise, flagsReadyPromise]);
    this.poller.start();
    return this;
  }

  /**
   * Stop the local flag configuration poller.
   */
  public stop() {
    if (!this.poller.isRunning()) {
      return;
    }
    this.poller.stop();
  }

  /**
   * Assign the given user to the SDK and asynchronously fetch all variants
   * from the server. Subsequent calls may omit the user from the argument to
   * use the user from the previous call.
   *
   * If an {@link ExperimentUserProvider} has been set, the argument user will
   * be merged with the provider user, preferring user fields from the argument
   * user and falling back on the provider for fields which are null or
   * undefined.
   *
   * If configured, fetch retries the request in the background on failure.
   * Variants received from a successful retry are stored in local storage for
   * access.
   *
   * If you are using the `initialVariants` config option to pre-load this SDK
   * from the server, you generally do not need to call `fetch`.
   *
   * @param user The user to fetch variants for.
   * @returns Promise that resolves when the request for variants completes.
   * @see ExperimentUser
   * @see ExperimentUserProvider
   */
  public async fetch(
    user: ExperimentUser = this.user,
    options?: FetchOptions,
  ): Promise<ExperimentClient> {
    this.setUser(user || {});
    try {
      await this.fetchInternal(
        user,
        this.config.fetchTimeoutMillis,
        this.config.retryFetchOnFailure,
        options,
      );
    } catch (e) {
      console.error(e);
    }
    return this;
  }

  /**
   * Returns the variant for the provided key.
   *
   * Access the variant from {@link Source}, falling back  on the given
   * fallback, then the configured fallbackVariant.
   *
   * If an {@link ExperimentAnalyticsProvider} is configured and trackExposure is
   * true, this function will call the provider with an {@link ExposureEvent}.
   * The exposure event does not count towards your event volume within Amplitude.
   *
   * @param key The key to get the variant for.
   * @param fallback The highest priority fallback.
   * @see ExperimentConfig
   * @see ExperimentAnalyticsProvider
   */
  public variant(key: string, fallback?: string | Variant): Variant {
    if (!this.apiKey) {
      return { value: undefined };
    }
    let { source, variant } = this.variantAndSource(key, fallback);
    if (isFallback(source)) {
      const flag = this.flags.get(key);
      if (flag) {
        variant = this.evaluate([flag.key])[key];
        source = VariantSource.LocalEvaluation;
      }
    }
    if (this.config.automaticExposureTracking) {
      this.exposureInternal(key, variant, source);
    }
    this.debug(`[Experiment] variant for ${key} is ${variant.value}`);
    return variant;
  }

  /**
   * Track an exposure event for the variant associated with the flag/experiment
   * {@link key}.
   *
   * This method requires that an {@link ExperimentAnalyticsProvider} be
   * configured when this client is initialized, either manually, or through the
   * Amplitude Analytics SDK integration from set up using
   * {@link Experiment.initializeWithAmplitudeAnalytics}.
   *
   * @param key The flag/experiment key to track an exposure for.
   */
  public exposure(key: string): void {
    const { source, variant } = this.variantAndSource(key, null);
    this.exposureInternal(key, variant, source);
  }

  /**
   * Returns all variants for the user.
   *
   * The primary source of variants is based on the
   * {@link Source} configured in the {@link ExperimentConfig}.
   *
   * @see Source
   * @see ExperimentConfig
   */
  public all(): Variants {
    if (!this.apiKey) {
      return {};
    }
    const evaluatedVariants = this.evaluate();
    return {
      ...this.secondaryVariants(),
      ...evaluatedVariants,
      ...this.sourceVariants(),
    };
  }

  /**
   * Clear all variants in the cache and storage.
   *
   */
  public clear(): void {
    this.variants.clear();
    void this.variants.store();
  }

  /**
   * Get a copy of the internal {@link ExperimentUser} object if it is set.
   *
   * @returns a copy of the internal user object if set.
   */
  public getUser(): ExperimentUser {
    if (!this.user) {
      return this.user;
    }
    if (this.user?.user_properties) {
      const userPropertiesCopy = { ...this.user.user_properties };
      return { ...this.user, user_properties: userPropertiesCopy };
    } else {
      return { ...this.user };
    }
  }

  /**
   * Copy in and set the user within the experiment client.
   *
   * @param user the user to set within the experiment client.
   */
  public setUser(user: ExperimentUser): void {
    if (!user) {
      this.user = null;
      return;
    }
    if (this.user?.user_properties) {
      const userPropertiesCopy = { ...user.user_properties };
      this.user = { ...user, user_properties: userPropertiesCopy };
    } else {
      this.user = { ...user };
    }
  }

  /**
   * Get the user provider set by {@link setUserProvider} or null if the user
   * provider has not been set.
   *
   * @returns The user provider set by {@link setUserProvider} or null.
   * @deprecated use ExperimentConfig.userProvider instead
   */
  public getUserProvider(): ExperimentUserProvider {
    return this.userProvider;
  }

  /**
   * Sets a user provider that will inject identity information into the user
   * for {@link fetch()} requests. The user provider will only set user fields
   * in outgoing requests which are null or undefined.
   *
   * See {@link ExperimentUserProvider} for more details
   * @param userProvider
   * @deprecated use ExperimentConfig.userProvider instead
   */
  public setUserProvider(userProvider: ExperimentUserProvider): Client {
    this.userProvider = userProvider;
    return this;
  }

  private evaluate(flagKeys?: string[]): Variants {
    const user = this.addContext(this.user);
    const flags = topologicalSort(this.flags.getAll(), flagKeys);
    const evaluationVariants = this.engine.evaluate({ user: user }, flags);
    const variants: Variants = {};
    for (const flagKey of Object.keys(evaluationVariants)) {
      variants[flagKey] = this.convertEvaluationVariant(
        evaluationVariants[flagKey],
      );
    }
    return variants;
  }

  private convertEvaluationVariant(
    evaluationVariant: EvaluationVariant,
  ): Variant {
    if (!evaluationVariant) {
      return {};
    }
    let experimentKey = undefined;
    if (evaluationVariant.metadata) {
      experimentKey = evaluationVariant.metadata['experimentKey'];
    }
    return {
      value: evaluationVariant.value,
      payload: evaluationVariant.payload,
      expKey: experimentKey,
    };
  }

  private variantAndSource(
    key: string,
    fallback: string | Variant,
  ): {
    variant: Variant;
    source: VariantSource;
  } {
    if (this.config.source === Source.InitialVariants) {
      // for source = InitialVariants, fallback order goes:
      // 1. InitialFlags
      // 2. Local Storage
      // 3. Function fallback
      // 4. Config fallback

      const sourceVariant = this.sourceVariants()[key];
      if (!isNullOrUndefined(sourceVariant)) {
        return {
          variant: this.convertVariant(sourceVariant),
          source: VariantSource.InitialVariants,
        };
      }
      const secondaryVariant = this.secondaryVariants()[key];
      if (!isNullOrUndefined(secondaryVariant)) {
        return {
          variant: this.convertVariant(secondaryVariant),
          source: VariantSource.SecondaryLocalStorage,
        };
      }
      if (!isNullOrUndefined(fallback)) {
        return {
          variant: this.convertVariant(fallback),
          source: VariantSource.FallbackInline,
        };
      }
      return {
        variant: this.convertVariant(this.config.fallbackVariant),
        source: VariantSource.FallbackConfig,
      };
    } else {
      // for source = LocalStorage, fallback order goes:
      // 1. Local Storage
      // 2. Function fallback
      // 3. InitialFlags
      // 4. Config fallback

      const sourceVariant = this.sourceVariants()[key];
      if (!isNullOrUndefined(sourceVariant)) {
        return {
          variant: this.convertVariant(sourceVariant),
          source: VariantSource.LocalStorage,
        };
      }
      if (!isNullOrUndefined(fallback)) {
        return {
          variant: this.convertVariant(fallback),
          source: VariantSource.FallbackInline,
        };
      }
      const secondaryVariant = this.secondaryVariants()[key];
      if (!isNullOrUndefined(secondaryVariant)) {
        return {
          variant: this.convertVariant(secondaryVariant),
          source: VariantSource.SecondaryInitialVariants,
        };
      }
      return {
        variant: this.convertVariant(this.config.fallbackVariant),
        source: VariantSource.FallbackConfig,
      };
    }
  }

  private async fetchInternal(
    user: ExperimentUser,
    timeoutMillis: number,
    retry: boolean,
    options?: FetchOptions,
  ): Promise<Variants> {
    // Don't even try to fetch variants if API key is not set
    if (!this.apiKey) {
      throw Error('Experiment API key is empty');
    }

    this.debug(`[Experiment] Fetch all: retry=${retry}`);

    // Proactively cancel retries if active in order to avoid unecessary API
    // requests. A new failure will restart the retries.
    if (retry) {
      this.stopRetries();
    }

    try {
      const variants = await this.doFetch(user, timeoutMillis, options);
      await this.storeVariants(variants, options);
      return variants;
    } catch (e) {
      if (retry) {
        void this.startRetries(user, options);
      }
      throw e;
    }
  }

  private async doFetch(
    user: ExperimentUser,
    timeoutMillis: number,
    options?: FetchOptions,
  ): Promise<Variants> {
    user = await this.addContextOrWait(user, 10000);
    this.debug('[Experiment] Fetch variants for user: ', user);
    const results = await this.evaluationApi.getVariants(user, {
      timeoutMillis: timeoutMillis,
      flagKeys: options?.flagKeys,
    });
    const variants: Variants = {};
    for (const key of Object.keys(results)) {
      const variant = results[key];
      variants[key] = {
        value: variant.key,
        payload: variant.payload,
        expKey: variant.expKey,
      };
    }
    this.debug('[Experiment] Received variants: ', variants);
    return variants;
  }

  private async doFlags(): Promise<void> {
    const flags = await this.flagApi.getFlags({
      libraryName: 'experiment-js-client',
      libraryVersion: PACKAGE_VERSION,
      timeoutMillis: this.config.fetchTimeoutMillis,
    });
    this.flags.clear();
    this.flags.putAll(flags);
    await this.flags.store();
  }

  private async storeVariants(
    variants: Variants,
    options?: FetchOptions,
  ): Promise<void> {
    let failedFlagKeys = options && options.flagKeys ? options.flagKeys : [];
    if (failedFlagKeys.length === 0) {
      this.variants.clear();
    }
    for (const key in variants) {
      failedFlagKeys = failedFlagKeys.filter((flagKey) => flagKey !== key);
      this.variants.put(key, variants[key]);
    }

    for (const key in failedFlagKeys) {
      this.variants.remove(key);
    }
    await this.variants.store();
    this.debug('[Experiment] Stored variants: ', variants);
  }

  private async startRetries(
    user: ExperimentUser,
    options: FetchOptions,
  ): Promise<void> {
    this.debug('[Experiment] Retry fetch');
    this.retriesBackoff = new Backoff(
      fetchBackoffAttempts,
      fetchBackoffMinMillis,
      fetchBackoffMaxMillis,
      fetchBackoffScalar,
    );
    void this.retriesBackoff.start(async () => {
      await this.fetchInternal(user, fetchBackoffTimeout, false, options);
    });
  }

  private stopRetries(): void {
    if (this.retriesBackoff) {
      this.retriesBackoff.cancel();
    }
  }

  private addContext(user: ExperimentUser): ExperimentUser {
    const providedUser = this.userProvider?.getUser();
    const mergedUserProperties = {
      ...user?.user_properties,
      ...providedUser?.user_properties,
    };
    return {
      library: `experiment-js-client/${PACKAGE_VERSION}`,
      ...this.userProvider?.getUser(),
      ...user,
      user_properties: mergedUserProperties,
    };
  }

  private async addContextOrWait(
    user: ExperimentUser,
    ms: number,
  ): Promise<ExperimentUser> {
    if (this.userProvider instanceof DefaultUserProvider) {
      if (this.userProvider.userProvider instanceof ConnectorUserProvider) {
        await this.userProvider.userProvider.identityReady(ms);
      }
    }

    return this.addContext(user);
  }

  private convertVariant(value: string | Variant): Variant {
    if (value === null || value === undefined) {
      return {};
    }
    if (typeof value == 'string') {
      return {
        value: value,
      };
    } else {
      return value;
    }
  }

  private sourceVariants(): Variants {
    if (this.config.source == Source.LocalStorage) {
      return this.variants.getAll();
    } else if (this.config.source == Source.InitialVariants) {
      return this.config.initialVariants;
    }
  }

  private secondaryVariants(): Variants {
    if (this.config.source == Source.LocalStorage) {
      return this.config.initialVariants;
    } else if (this.config.source == Source.InitialVariants) {
      return this.variants.getAll();
    }
  }

  private exposureInternal(
    key: string,
    variant: Variant,
    source: VariantSource,
  ): void {
    const user = this.addContext(this.getUser());
    const event = exposureEvent(user, key, variant, source);
    if (isFallback(source) || !variant?.value) {
      // fallbacks indicate not being allocated into an experiment, so
      // we can unset the property
      this.exposureTrackingProvider?.track({ flag_key: key });
      this.analyticsProvider?.unsetUserProperty?.(event);
    } else if (variant?.value) {
      // only track when there's a value for a non fallback variant
      this.exposureTrackingProvider?.track({
        flag_key: key,
        variant: variant.value,
        experiment_key: variant.expKey,
      });
      this.analyticsProvider?.setUserProperty?.(event);
      this.analyticsProvider?.track(event);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private debug(message?: any, ...optionalParams: any[]): void {
    if (this.config.debug) {
      console.debug(message, ...optionalParams);
    }
  }
}
