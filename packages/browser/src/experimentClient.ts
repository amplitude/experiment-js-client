/**
 * @packageDocumentation
 * @module experiment-js-client
 */

import { version as PACKAGE_VERSION } from '../package.json';

import { ExperimentConfig, Defaults } from './config';
import { ConnectorUserProvider } from './integration/connector';
import { LocalStorage } from './storage/localStorage';
import { exposureEvent } from './types/analytics';
import { Client } from './types/client';
import { ExposureTrackingProvider } from './types/exposure';
import { ExperimentUserProvider } from './types/provider';
import { isFallback, Source, VariantSource } from './types/source';
import { Storage } from './types/storage';
import { HttpClient, SimpleResponse } from './types/transport';
import { ExperimentUser } from './types/user';
import { Variant, Variants } from './types/variant';
import { isNullOrUndefined } from './util';
import { Backoff } from './util/backoff';
import { urlSafeBase64Encode } from './util/base64';
import { randomString } from './util/randomstring';
import { SessionAnalyticsProvider } from './util/sessionAnalyticsProvider';
import { SessionExposureTrackingProvider } from './util/sessionExposureTrackingProvider';

// Configs which have been removed from the public API.
// May be added back in the future.
const fetchBackoffTimeout = 10000;
const fetchBackoffAttempts = 8;
const fetchBackoffMinMillis = 500;
const fetchBackoffMaxMillis = 10000;
const fetchBackoffScalar = 1.5;

/**
 * The default {@link Client} used to fetch variations from Experiment's
 * servers.
 *
 * @category Core Usage
 */
export class ExperimentClient implements Client {
  private readonly apiKey: string;
  private readonly config: ExperimentConfig;
  private readonly httpClient: HttpClient;
  private readonly storage: Storage;

  private user: ExperimentUser = null;
  private retriesBackoff: Backoff;

  /**
   * @deprecated
   */
  private userProvider: ExperimentUserProvider = null;

  private analyticsProvider: SessionAnalyticsProvider;
  private exposureTrackingProvider: ExposureTrackingProvider;

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
    this.httpClient = this.config.httpClient;
    this.storage = new LocalStorage(this.config.instanceName, apiKey);
    this.storage.load();
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
  ): Promise<ExperimentClient> {
    this.setUser(user || {});
    try {
      await this.fetchInternal(
        user,
        this.config.fetchTimeoutMillis,
        this.config.retryFetchOnFailure,
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
    const { source, variant } = this.variantAndSource(key, fallback);
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
    return { ...this.secondaryVariants(), ...this.sourceVariants() };
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
      const variants = await this.doFetch(user, timeoutMillis);
      this.storeVariants(variants);
      return variants;
    } catch (e) {
      if (retry) {
        this.startRetries(user);
      }
      throw e;
    }
  }

  private async doFetch(
    user: ExperimentUser,
    timeoutMillis: number,
  ): Promise<Variants> {
    const userContext = await this.addContextOrWait(user, 1000);
    const encodedContext = urlSafeBase64Encode(JSON.stringify(userContext));
    let queryString = '';
    if (this.config.debug) {
      queryString = `?d=${randomString(8)}`;
    }
    const endpoint = `${this.config.serverUrl}/sdk/vardata${queryString}`;
    const headers = {
      Authorization: `Api-Key ${this.apiKey}`,
      'X-Amp-Exp-User': encodedContext,
    };
    this.debug('[Experiment] Fetch variants for user: ', userContext);
    const response = await this.httpClient.request(
      endpoint,
      'GET',
      headers,
      null,
      timeoutMillis,
    );
    if (response.status != 200) {
      throw Error(`Fetch error response: status=${response.status}`);
    }
    this.debug('[Experiment] Received fetch response: ', response);
    return this.parseResponse(response);
  }

  private parseResponse(response: SimpleResponse): Variants {
    const json = JSON.parse(response.body);
    const variants: Variants = {};
    for (const key of Object.keys(json)) {
      variants[key] = {
        value: json[key].key,
        payload: json[key].payload,
      };
    }
    this.debug('[Experiment] Received variants: ', variants);
    return variants;
  }

  private storeVariants(variants: Variants): void {
    this.storage.clear();
    for (const key in variants) {
      this.storage.put(key, variants[key]);
    }
    this.storage.save();
    this.debug('[Experiment] Stored variants: ', variants);
  }

  private async startRetries(user: ExperimentUser): Promise<void> {
    this.debug('[Experiment] Retry fetch');
    this.retriesBackoff = new Backoff(
      fetchBackoffAttempts,
      fetchBackoffMinMillis,
      fetchBackoffMaxMillis,
      fetchBackoffScalar,
    );
    this.retriesBackoff.start(async () => {
      await this.fetchInternal(user, fetchBackoffTimeout, false);
    });
  }

  private stopRetries(): void {
    if (this.retriesBackoff != null) {
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
    if (this.userProvider instanceof ConnectorUserProvider) {
      await this.userProvider.identityReady(ms);
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
      return this.storage.getAll();
    } else if (this.config.source == Source.InitialVariants) {
      return this.config.initialVariants;
    }
  }

  private secondaryVariants(): Variants {
    if (this.config.source == Source.LocalStorage) {
      return this.config.initialVariants;
    } else if (this.config.source == Source.InitialVariants) {
      return this.storage.getAll();
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
