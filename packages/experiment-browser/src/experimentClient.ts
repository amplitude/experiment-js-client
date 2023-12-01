/**
 * @packageDocumentation
 * @module experiment-js-client
 */

import {
  EvaluationApi,
  EvaluationEngine,
  EvaluationFlag,
  FlagApi,
  Poller,
  SdkEvaluationApi,
  SdkFlagApi,
  topologicalSort,
} from '@amplitude/experiment-core';

import { version as PACKAGE_VERSION } from '../package.json';

import { Defaults, ExperimentConfig } from './config';
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
import { Exposure, ExposureTrackingProvider } from './types/exposure';
import { ExperimentUserProvider } from './types/provider';
import { isFallback, Source, VariantSource } from './types/source';
import { ExperimentUser } from './types/user';
import { Variant, Variants } from './types/variant';
import {
  isLocalEvaluationMode,
  isNullOrUndefined,
  isNullUndefinedOrEmpty,
} from './util';
import { Backoff } from './util/backoff';
import {
  convertEvaluationVariantToVariant,
  convertUserToContext,
  convertVariant,
} from './util/convert';
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

const euServerUrl = 'https://api.lab.eu.amplitude.com';
const euFlagsServerUrl = 'https://flag.lab.eu.amplitude.com';

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
  private isRunning = false;

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
    this.config = {
      ...Defaults,
      ...config,
      // Set server URLs separately
      serverUrl:
        config?.serverUrl ||
        (config?.serverZone?.toLowerCase() === 'eu'
          ? euServerUrl
          : Defaults.serverUrl),
      flagsServerUrl:
        config?.flagsServerUrl ||
        (config?.serverZone?.toLowerCase() === 'eu'
          ? euFlagsServerUrl
          : Defaults.flagsServerUrl),
    };
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
      this.config.flagsServerUrl,
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
    try {
      this.flags.load();
      this.variants.load();
    } catch (e) {
      console.warn('Failed to load flags and variants from localStorage', e);
    }
    this.mergeInitialFlagsWithStorage();
  }

  /**
   * Start the SDK by getting flag configurations from the server and fetching
   * variants for the user. The promise returned by this function resolves when
   * local flag configurations have been updated, and the {@link fetch()}
   * result has been received (if the request was made).
   *
   * To force this function not to fetch variants, set the {@link fetchOnStart}
   * configuration option to `false` when initializing the SDK.
   *
   * Finally, this function will start polling for flag configurations at a
   * fixed interval. To disable polling, set the {@link pollOnStart}
   * configuration option to `false` on initialization.
   *
   * @param user The user to set in the SDK.
   * @see fetchOnStart
   * @see pollOnStart
   * @see fetch
   * @see variant
   */
  public async start(user?: ExperimentUser): Promise<void> {
    if (this.isRunning) {
      return;
    } else {
      this.isRunning = true;
    }
    this.setUser(user);
    const flagsReadyPromise = this.doFlags();
    const fetchOnStart = this.config.fetchOnStart ?? true;
    if (fetchOnStart) {
      await Promise.all([this.fetch(user), flagsReadyPromise]);
    } else {
      await flagsReadyPromise;
    }
    if (this.config.pollOnStart) {
      this.poller.start();
    }
  }

  /**
   * Stop the local flag configuration poller.
   */
  public stop() {
    if (!this.isRunning) {
      return;
    }
    this.poller.stop();
    this.isRunning = false;
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
   * If you are using the `initialVariants` config option to preload this SDK
   * from the server, you generally do not need to call `fetch`.
   *
   * @param user The user to fetch variants for.
   * @param options Options for this specific fetch call.
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
   * If an {@link ExposureTrackingProvider} is configured and the
   * {@link automaticExposureTracking} configuration option is `true`, this
   * function will call the provider with an {@link Exposure} event. The
   * exposure event does not count towards your event volume within Amplitude.
   *
   * @param key The key to get the variant for.
   * @param fallback The highest priority fallback.
   * @see ExperimentConfig
   * @see ExposureTrackingProvider
   */
  public variant(key: string, fallback?: string | Variant): Variant {
    if (!this.apiKey) {
      return { value: undefined };
    }
    const sourceVariant = this.variantAndSource(key, fallback);
    if (this.config.automaticExposureTracking) {
      this.exposureInternal(key, sourceVariant);
    }
    this.debug(
      `[Experiment] variant for ${key} is ${sourceVariant.variant?.value}`,
    );
    return sourceVariant.variant || {};
  }

  /**
   * Track an exposure event for the variant associated with the flag/experiment
   * {@link key}.
   *
   * This method requires that an {@link ExposureTrackingProvider} be
   * configured when this client is initialized, either manually, or through the
   * Amplitude Analytics SDK integration from set up using
   * {@link Experiment.initializeWithAmplitudeAnalytics}.
   *
   * @param key The flag/experiment key to track an exposure for.
   * @see ExposureTrackingProvider
   */
  public exposure(key: string): void {
    const sourceVariant = this.variantAndSource(key);
    this.exposureInternal(key, sourceVariant);
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
    for (const flagKey in evaluatedVariants) {
      const flag = this.flags.get(flagKey);
      if (!isLocalEvaluationMode(flag)) {
        delete evaluatedVariants[flagKey];
      }
    }
    return {
      ...this.secondaryVariants(),
      ...this.sourceVariants(),
      ...evaluatedVariants,
    };
  }

  /**
   * Clear all variants in the cache and storage.
   */
  public clear(): void {
    this.variants.clear();
    try {
      void this.variants.store();
    } catch (e) {
      console.warn('Failed to store variants in localStorage', e);
    }
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

  private mergeInitialFlagsWithStorage(): void {
    if (this.config.initialFlags) {
      const initialFlags = JSON.parse(this.config.initialFlags);
      initialFlags.forEach((flag: EvaluationFlag) => {
        if (!this.flags.get(flag.key)) {
          this.flags.put(flag.key, flag);
        }
      });
    }
  }

  private evaluate(flagKeys?: string[]): Variants {
    const user = this.addContext(this.user);
    const flags = topologicalSort(this.flags.getAll(), flagKeys);
    const context = convertUserToContext(user);
    const evaluationVariants = this.engine.evaluate(context, flags);
    const variants: Variants = {};
    for (const flagKey of Object.keys(evaluationVariants)) {
      variants[flagKey] = convertEvaluationVariantToVariant(
        evaluationVariants[flagKey],
      );
    }
    return variants;
  }

  private variantAndSource(
    key: string,
    fallback?: string | Variant,
  ): SourceVariant {
    let sourceVariant: SourceVariant = {};
    if (this.config.source === Source.LocalStorage) {
      sourceVariant = this.localStorageVariantAndSource(key, fallback);
    } else if (this.config.source === Source.InitialVariants) {
      sourceVariant = this.initialVariantsVariantAndSource(key, fallback);
    }
    const flag = this.flags.get(key);
    if (isLocalEvaluationMode(flag) || (!sourceVariant.variant && flag)) {
      sourceVariant = this.localEvaluationVariantAndSource(key, flag, fallback);
    }
    return sourceVariant;
  }

  // TODO variant and source for both local and remote needs to be cleaned up.

  /**
   * This function assumes the flag exists and is local evaluation mode. For
   * local evaluation, fallback order goes:
   *
   *  1. Local evaluation
   *  2. Inline function fallback
   *  3. Initial variants
   *  4. Config fallback
   *
   * If there is a default variant and no fallback, return the default variant.
   */
  private localEvaluationVariantAndSource(
    key: string,
    flag: EvaluationFlag,
    fallback?: string | Variant,
  ): SourceVariant {
    let defaultSourceVariant: SourceVariant = {};
    // Local evaluation
    const variant = this.evaluate([flag.key])[key];
    const source = VariantSource.LocalEvaluation;
    const isLocalEvaluationDefault = variant?.metadata?.default as boolean;
    if (!isNullOrUndefined(variant) && !isLocalEvaluationDefault) {
      return {
        variant: convertVariant(variant),
        source: source,
        hasDefaultVariant: false,
      };
    } else if (isLocalEvaluationDefault) {
      defaultSourceVariant = {
        variant: convertVariant(variant),
        source: source,
        hasDefaultVariant: true,
      };
    }
    // Inline fallback
    if (!isNullOrUndefined(fallback)) {
      return {
        variant: convertVariant(fallback),
        source: VariantSource.FallbackInline,
        hasDefaultVariant: defaultSourceVariant.hasDefaultVariant,
      };
    }
    // Initial variants
    const initialVariant = this.config.initialVariants[key];
    if (!isNullOrUndefined(initialVariant)) {
      return {
        variant: convertVariant(initialVariant),
        source: VariantSource.SecondaryInitialVariants,
        hasDefaultVariant: defaultSourceVariant.hasDefaultVariant,
      };
    }
    // Configured fallback, or default variant
    const fallbackVariant = convertVariant(this.config.fallbackVariant);
    const fallbackSourceVariant = {
      variant: fallbackVariant,
      source: VariantSource.FallbackConfig,
      hasDefaultVariant: defaultSourceVariant.hasDefaultVariant,
    };
    if (!isNullUndefinedOrEmpty(fallbackVariant)) {
      return fallbackSourceVariant;
    }
    return defaultSourceVariant;
  }

  /**
   * For Source.LocalStorage, fallback order goes:
   *
   *  1. Local Storage
   *  2. Inline function fallback
   *  3. InitialFlags
   *  4. Config fallback
   *
   * If there is a default variant and no fallback, return the default variant.
   */
  private localStorageVariantAndSource(
    key: string,
    fallback?: string | Variant,
  ): SourceVariant {
    let defaultSourceVariant: SourceVariant = {};
    // Local storage
    const localStorageVariant = this.variants.get(key);
    const isLocalStorageDefault = localStorageVariant?.metadata
      ?.default as boolean;
    if (!isNullOrUndefined(localStorageVariant) && !isLocalStorageDefault) {
      return {
        variant: convertVariant(localStorageVariant),
        source: VariantSource.LocalStorage,
        hasDefaultVariant: false,
      };
    } else if (isLocalStorageDefault) {
      defaultSourceVariant = {
        variant: convertVariant(localStorageVariant),
        source: VariantSource.LocalStorage,
        hasDefaultVariant: true,
      };
    }
    // Inline fallback
    if (!isNullOrUndefined(fallback)) {
      return {
        variant: convertVariant(fallback),
        source: VariantSource.FallbackInline,
        hasDefaultVariant: defaultSourceVariant.hasDefaultVariant,
      };
    }
    // Initial variants
    const initialVariant = this.config.initialVariants[key];
    if (!isNullOrUndefined(initialVariant)) {
      return {
        variant: convertVariant(initialVariant),
        source: VariantSource.SecondaryInitialVariants,
        hasDefaultVariant: defaultSourceVariant.hasDefaultVariant,
      };
    }
    // Configured fallback, or default variant
    const fallbackVariant = convertVariant(this.config.fallbackVariant);
    const fallbackSourceVariant = {
      variant: fallbackVariant,
      source: VariantSource.FallbackConfig,
      hasDefaultVariant: defaultSourceVariant.hasDefaultVariant,
    };
    if (!isNullUndefinedOrEmpty(fallbackVariant)) {
      return fallbackSourceVariant;
    }
    return defaultSourceVariant;
  }

  /**
   * For Source.InitialVariants, fallback order goes:
   *
   *  1. Initial variants
   *  2. Local storage
   *  3. Inline function fallback
   *  4. Config fallback
   *
   * If there is a default variant and no fallback, return the default variant.
   */
  private initialVariantsVariantAndSource(
    key: string,
    fallback?: string | Variant,
  ): SourceVariant {
    let defaultSourceVariant: SourceVariant = {};
    // Initial variants
    const initialVariantsVariant = this.config.initialVariants[key];
    if (!isNullOrUndefined(initialVariantsVariant)) {
      return {
        variant: convertVariant(initialVariantsVariant),
        source: VariantSource.InitialVariants,
        hasDefaultVariant: false,
      };
    }
    // Local storage
    const localStorageVariant = this.variants.get(key);
    const isLocalStorageDefault = localStorageVariant?.metadata
      ?.default as boolean;
    if (!isNullOrUndefined(localStorageVariant) && !isLocalStorageDefault) {
      return {
        variant: convertVariant(localStorageVariant),
        source: VariantSource.LocalStorage,
        hasDefaultVariant: false,
      };
    } else if (isLocalStorageDefault) {
      defaultSourceVariant = {
        variant: convertVariant(localStorageVariant),
        source: VariantSource.LocalStorage,
        hasDefaultVariant: true,
      };
    }
    // Inline fallback
    if (!isNullOrUndefined(fallback)) {
      return {
        variant: convertVariant(fallback),
        source: VariantSource.FallbackInline,
        hasDefaultVariant: defaultSourceVariant.hasDefaultVariant,
      };
    }
    // Configured fallback, or default variant
    const fallbackVariant = convertVariant(this.config.fallbackVariant);
    const fallbackSourceVariant = {
      variant: fallbackVariant,
      source: VariantSource.FallbackConfig,
      hasDefaultVariant: defaultSourceVariant.hasDefaultVariant,
    };
    if (!isNullUndefinedOrEmpty(fallbackVariant)) {
      return fallbackSourceVariant;
    }
    return defaultSourceVariant;
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
      variants[key] = convertEvaluationVariantToVariant(results[key]);
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
    try {
      this.flags.store();
    } catch (e) {
      console.warn('Failed to store flags in localStorage', e);
    }
    this.mergeInitialFlagsWithStorage();
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
    try {
      this.variants.store();
    } catch (e) {
      console.warn('Failed to store variants in localStorage', e);
    }
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

  private sourceVariants(): Variants | undefined {
    if (this.config.source == Source.LocalStorage) {
      return this.variants.getAll();
    } else if (this.config.source == Source.InitialVariants) {
      return this.config.initialVariants;
    }
  }

  private secondaryVariants(): Variants | undefined {
    if (this.config.source == Source.LocalStorage) {
      return this.config.initialVariants;
    } else if (this.config.source == Source.InitialVariants) {
      return this.variants.getAll();
    }
  }

  private exposureInternal(key: string, sourceVariant: SourceVariant): void {
    this.legacyExposureInternal(
      key,
      sourceVariant.variant,
      sourceVariant.source,
    );
    const exposure: Exposure = { flag_key: key };
    // Do not track exposure for fallback variants that are not associated with
    // a default variant.
    const fallback = isFallback(sourceVariant.source);
    if (fallback && !sourceVariant.hasDefaultVariant) {
      return;
    }
    if (sourceVariant.variant?.expKey) {
      exposure.experiment_key = sourceVariant.variant?.expKey;
    }
    const metadata = sourceVariant.variant?.metadata;
    if (!fallback && !metadata?.default) {
      if (sourceVariant.variant?.key) {
        exposure.variant = sourceVariant.variant.key;
      } else if (sourceVariant.variant?.value) {
        exposure.variant = sourceVariant.variant.value;
      }
    }
    if (metadata) exposure.metadata = metadata;
    this.exposureTrackingProvider?.track(exposure);
  }

  private legacyExposureInternal(
    key: string,
    variant: Variant | undefined,
    source: VariantSource | undefined,
  ): void {
    if (this.analyticsProvider) {
      const user = this.addContext(this.getUser());
      const event = exposureEvent(user, key, variant, source);
      if (isFallback(source) || !variant?.value) {
        this.analyticsProvider?.unsetUserProperty?.(event);
      } else if (variant?.value) {
        this.analyticsProvider?.setUserProperty?.(event);
        this.analyticsProvider?.track(event);
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private debug(message?: any, ...optionalParams: any[]): void {
    if (this.config.debug) {
      console.debug(message, ...optionalParams);
    }
  }
}

type SourceVariant = {
  variant?: Variant | undefined;
  source?: VariantSource | undefined;
  hasDefaultVariant?: boolean | undefined;
};
