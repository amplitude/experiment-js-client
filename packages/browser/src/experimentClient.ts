/**
 * @packageDocumentation
 * @module experiment-js-client
 */

import { version as PACKAGE_VERSION } from '../package.json';

import { ExperimentConfig, Defaults, Source } from './config';
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

/**
 * The default {@link Client} used to fetch variations from Experiment's
 * servers.
 *
 * @category Core Usage
 */
export class ExperimentClient implements Client {
  private readonly apiKey: string;
  private readonly storage: Storage;
  private readonly httpClient: HttpClient;
  private readonly config: ExperimentConfig;

  private user: ExperimentUser;
  private userProvider: ExperimentUserProvider;
  private retriesBackoff: Backoff;

  /**
   * Creates a new ExperimentClient instance.
   *
   * @param apiKey The Client key for the Experiment project
   * @param config See {@link ExperimentConfig} for config options
   * @param httpClient The {@link HttpClient} to make fetch requests with
   * @param storage The storage implementation
   */
  constructor(
    apiKey: string,
    config: ExperimentConfig,
    httpClient: HttpClient,
    storage: Storage,
  ) {
    this.apiKey = apiKey;
    this.config = { ...Defaults, ...config };
    this.httpClient = httpClient;
    this.storage = storage;
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
    this.user = user || {};
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
   * Fetches {@link all} variants from falling back given fallback then the
   * configured fallbackVariant.
   *
   * @param key
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
   * Sets an context provider that will inject identity information into the user
   * context. The context provider will override any device ID or user ID set on
   * the ExperimentUser object.
   *
   * See {@link ExperimentUserProvider} for more details
   * @param userProvider
   */
  public setUserProvider(userProvider: ExperimentUserProvider): Client {
    this.userProvider = userProvider;
    return this;
  }

  protected async fetchInternal(
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

  protected async doFetch(
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

  protected async parseResponse(response: Response): Promise<Variants> {
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

  protected storeVariants(variants: Variants): void {
    this.storage.clear();
    for (const key in variants) {
      this.storage.put(key, variants[key]);
    }
    this.storage.save();
    this.debug('[Experiment] Stored variants: ', variants);
  }

  protected async startRetries(user: ExperimentUser): Promise<void> {
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

  protected stopRetries(): void {
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

  private convertVariant(value: string | Variant): Variant | null {
    if (value === null || value === undefined) {
      return null;
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
