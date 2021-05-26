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
const assignmentBackoffTimeout = 10000;
const assignmentBackoffAttempts = 8;
const assignmentBackoffMinMillis = 500;
const assignmentBackoffMaxMillis = 10000;
const assignmentBackoffScalar = 1.5;

/**
 * The default {@link Client} used to fetch variations from Experiment's
 * servers.
 * @category Core Usage
 */
export class ExperimentClient implements Client {
  protected readonly storage: Storage;
  protected readonly httpClient: HttpClient;
  protected readonly config: ExperimentConfig;

  protected user: ExperimentUser;
  protected userProvider: ExperimentUserProvider;
  private retriesBackoff: Backoff;

  /**
   * Creates a new ExperimentClient instance.
   * @param apiKey The Client key for the Experiment project
   * @param config See {@link ExperimentConfig} for config options
   */
  constructor(config: ExperimentConfig) {
    this.config = { ...Defaults, ...config };

    this.httpClient = FetchHttpClient;

    const shortApiKey = this.config.apiKey.substring(
      this.config.apiKey.length - 6,
    );
    this.storage = new LocalStorage(`amp-sl-${shortApiKey}`);
    this.storage.load();
  }

  /**
   * Starts the client. This will
   * 1. Load the id from local storage, or generate a new one if one does not exist.
   * 2. Asynchronously fetch all variants with the provided user context.
   * 4. If the fetch fails and the retry flag is set, start the retry interval until success.
   *
   * If you are using the `initialVariants` config option to pre-load this SDK from the
   * server, you do not need to call `start`.
   *
   * @param user The user context for variants. See {@link ExperimentUser} for more details.
   * @returns A promise that resolves when the async request for variants is complete.
   */
  public async fetch(
    user: ExperimentUser = this.user,
  ): Promise<ExperimentClient> {
    this.user = user || {};
    try {
      await this.fetchAll(
        user,
        this.config.assignmentTimeoutMillis,
        this.config.retryAssignmentOnFailure,
      );
    } catch (e) {
      console.error(e);
    }
    return this;
  }

  /**
   * Sets an context provider that will inject identity information into the user
   * context. The context provider will override any device ID or user ID set on
   * the ExperimentUser object.
   * See {@link ExperimentUserProvider} for more details
   * @param userProvider
   */
  public setUserProvider(userProvider: ExperimentUserProvider): Client {
    this.userProvider = userProvider;
    return this;
  }

  protected async fetchAll(
    user: ExperimentUser,
    timeoutMillis: number,
    retry: boolean,
  ): Promise<Variants> {
    // Don't even try to fetch variants if API key is not set
    if (!this.config.apiKey) {
      throw Error('Experiment API key is empty');
    }

    this.debug('[Experiment] Fetch all: retry=' + retry);

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
      Authorization: `Api-Key ${this.config.apiKey}`,
    };
    this.debug('[Experiment] Fetch variants for user: ', userContext);
    const response = await this.httpClient.request(
      endpoint,
      'GET',
      headers,
      null,
      timeoutMillis,
    );
    this.debug('[Experiment] Received fetch response:', response);
    return response;
  }

  protected async parseResponse(response: Response): Promise<Variants> {
    const json = await response.json();
    const variants: Variants = {};
    for (const flag of Object.keys(json)) {
      variants[flag] = {
        value: json[flag].key,
        payload: json[flag].payload,
      };
    }
    this.debug('[Experiment] Received variants:', variants);
    return variants;
  }

  protected storeVariants(variants: Variants): void {
    this.storage.clear();
    for (const key in variants) {
      this.storage.put(key, variants[key]);
    }
    this.storage.save();
    this.debug('[Experiment] Stored flags:', variants);
  }

  protected async startRetries(user: ExperimentUser): Promise<void> {
    this.debug('[Experiment] Retry fetch all');
    this.retriesBackoff = new Backoff(
      assignmentBackoffAttempts,
      assignmentBackoffMinMillis,
      assignmentBackoffMaxMillis,
      assignmentBackoffScalar,
    );
    this.retriesBackoff.start(async () => {
      await this.fetchAll(user, assignmentBackoffTimeout, false);
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

  /**
   * Returns the variant for the provided key.
   * Fallback order:
   * - Provided fallback
   * - Initial flags
   * - fallbackVariant in config
   * - Defaults.fallbackVariant (empty string)
   * Fallbacks happen if a value is null or undefined
   * @param key
   * @param fallback A fallback value that takes precedence over any other fallback value.
   */
  public variant(key: string, fallback?: string | Variant): Variant {
    if (!this.config.apiKey) {
      return { value: undefined };
    }
    const flags = this.all();
    const variant = this._convertVariant(
      flags[key] ?? fallback ?? this.config.fallbackVariant,
    );
    this.debug(`[Experiment] variant for flag ${key} is ${variant.value}`);
    return variant;
  }

  /**
   * Returns all variants for the user.
   */
  public all(): Variants {
    if (!this.config.apiKey) {
      return {};
    }
    const storageFlags = this.storage.getAll();
    if (this.config.source == Source.LocalStorage) {
      return { ...this.config.initialVariants, ...storageFlags };
    } else if (this.config.source == Source.InitialVariants) {
      return { ...storageFlags, ...this.config.initialVariants };
    }
  }

  /**
   * Converts a string value or Variant to a Variant object
   * @param value
   * @returns
   */
  private _convertVariant(value: string | Variant): Variant | null {
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
      console.debug(message, optionalParams);
    }
  }
}
