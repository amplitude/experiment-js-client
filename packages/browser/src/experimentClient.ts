/**
 * @packageDocumentation
 * @module experiment-js-client
 */

import { version as PACKAGE_VERSION } from '../package.json';

import { ExperimentConfig, Defaults, Source } from './config';
import { LocalStorage } from './storage/localStorage';
import { FetchHttpClient } from './transport/http';
import { Client } from './types/client';
import { Storage } from './types/storage';
import { HttpClient } from './types/transport';
import { ExperimentUser, ExperimentUserProvider } from './types/user';
import { Variant, Variants } from './types/variant';
import { Backoff } from './util/backoff';
import { urlSafeBase64Encode } from './util/base64';
import { randomString } from './util/randomstring';

// Configs which have been removed from the public API.
// May be added back in the future.
const fetchBackoffTimeout = 10000;
const fetchBackoffAttempts = 8;
const fetchBackoffMinMillis = 500;
const fetchBackoffMaxMillis = 10000;
const fetchBackoffScalar = 1.5;

// TODO this is defined twice, figure something better out.
const defaultInstance = '$default_instance';

/**
 * The default {@link Client} used to fetch variations from Experiment's
 * servers.
 *
 * @category Core Usage
 */
export class ExperimentClient implements Client {
  private readonly apiKey: string;
  private readonly config: ExperimentConfig;
  private readonly httpClient?: HttpClient;
  private readonly storage?: Storage;

  private user: ExperimentUser = null;
  private userProvider: ExperimentUserProvider = null;
  private retriesBackoff: Backoff;

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
    this.httpClient = FetchHttpClient;
    this.storage = new LocalStorage(defaultInstance, apiKey);
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
   * Fetches {@link all} variants, falling back  on the given fallback, then the
   * configured fallbackVariant.
   *
   * @param key The key to get the variant for.
   * @param fallback The highest priority fallback.
   * @see ExperimentConfig
   */
  public variant(key: string, fallback?: string | Variant): Variant {
    if (!this.apiKey) {
      return { value: undefined };
    }
    const variants = this.all();
    const variant = this.convertVariant(
      variants[key] ?? fallback ?? this.config.fallbackVariant,
    );
    this.debug(`[Experiment] variant for ${key} is ${variant.value}`);
    return variant;
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
    const storageVariants = this.storage.getAll();
    if (this.config.source == Source.LocalStorage) {
      return { ...this.config.initialVariants, ...storageVariants };
    } else if (this.config.source == Source.InitialVariants) {
      return { ...storageVariants, ...this.config.initialVariants };
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
    const userPropertiesCopy = { ...this.user.user_properties };
    return { ...this.user, user_properties: userPropertiesCopy };
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
    const userPropertiesCopy = { ...user.user_properties };
    this.user = { ...user, user_properties: userPropertiesCopy };
  }

  /**
   * Get the user provider set by {@link setUserProvider} or null if the user
   * provider has not been set.
   *
   * @returns The user provider set by {@link setUserProvider} or null.
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
   */
  public setUserProvider(userProvider: ExperimentUserProvider): Client {
    this.userProvider = userProvider;
    return this;
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
      const response = await this.doFetch(user, timeoutMillis);
      const variants = await this.parseResponse(response);
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
  ): Promise<Response> {
    const userContext = this.addContext(user);
    const encodedContext = urlSafeBase64Encode(JSON.stringify(userContext));
    let queryString = '';
    if (this.config.debug) {
      queryString = `?d=${randomString(8)}`;
    }
    const endpoint = `${this.config.serverUrl}/sdk/vardata/${encodedContext}${queryString}`;
    const headers = {
      Authorization: `Api-Key ${this.apiKey}`,
    };
    this.debug('[Experiment] Fetch variants for user: ', userContext);
    const response = await this.httpClient.request(
      endpoint,
      'GET',
      headers,
      null,
      timeoutMillis,
    );
    this.debug('[Experiment] Received fetch response: ', response);
    return response;
  }

  private async parseResponse(response: Response): Promise<Variants> {
    const json = await response.json();
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

  private addContext(user: ExperimentUser) {
    return {
      library: `experiment-js-client/${PACKAGE_VERSION}`,
      ...this.userProvider?.getUser(),
      ...user,
    };
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private debug(message?: any, ...optionalParams: any[]): void {
    if (this.config.debug) {
      console.debug(message, ...optionalParams);
    }
  }
}
