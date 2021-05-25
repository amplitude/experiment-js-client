/**
 * @packageDocumentation
 * @module experiment-js-client
 */

import { version as PACKAGE_VERSION } from '../package.json';

import { ExperimentConfig, Defaults } from './config';
import { LocalStorage } from './storage/localStorage';
import { FetchHttpClient } from './transport/http';
import { Client } from './types/client';
import { ContextProvider } from './types/context';
import { Storage } from './types/storage';
import { HttpClient } from './types/transport';
import { ExperimentUser } from './types/user';
import { Variant, Flags } from './types/variant';
import { Backoff } from './util/backoff';
import { urlSafeBase64Encode } from './util/base64';
import { normalizeInstanceName } from './util/normalize';
import { randomString } from './util/randomstring';

// Configs which have been removed from the public API.
// May be added back in the future.
const defaultInstanceName = '$default_instance';
const assignmentBackoffTimeout = 10000;
const assignmentBackoffAttempts = 8;
const assignmentBackoffMinMillis = 500;
const assignmentBackoffMaxMillis = 10000;
const assignmentBackoffScalar = 1.5;

/**
 * The default {@link Client} used to fetch variations from Experiment's servers.
 * @category Core Usage
 */
export class ExperimentClient implements Client {
  protected readonly instanceName: string;
  protected readonly apiKey: string;
  protected readonly storage: Storage;
  protected readonly storageNamespace: string;
  protected readonly httpClient: HttpClient;
  protected readonly debug: boolean;
  protected readonly debugAssignmentRequests: boolean;

  protected config: ExperimentConfig;
  protected user: ExperimentUser;
  protected contextProvider: ContextProvider;

  private retriesEnabled: boolean;
  private retriesBackoff: Backoff;

  /**
   * Creates a new ExperimentClient instance.
   * @param apiKey The Client key for the Experiment project
   * @param config See {@link ExperimentConfig} for config options
   */
  public constructor(apiKey: string, config: ExperimentConfig) {
    this.apiKey = apiKey;
    this.config = { ...Defaults, ...config };
    const normalizedInstanceName = normalizeInstanceName(defaultInstanceName);

    this.instanceName = normalizedInstanceName;
    this.httpClient = FetchHttpClient;

    const shortApiKey = this.apiKey.substring(this.apiKey.length - 6);
    this.storageNamespace = `amp-sl-${shortApiKey}`;
    this.storage = new LocalStorage(this.storageNamespace);

    this.debug = this.config.debug;
    this.debugAssignmentRequests = this.config.debug;

    this.retriesEnabled = this.config.retryFailedAssignment;
  }

  /**
   * Starts the client. This will
   * 1. Load the id from local storage, or generate a new one if one does not exist.
   * 2. Asynchronously fetch all variants with the provided user context.
   * 4. If the fetch fails and the retry flag is set, start the retry interval until success.
   *
   * If you are using the `initialFlags` config option to pre-load this SDK from the
   * server, you do not need to call `start`.
   *
   * @param user The user context for variants. See {@link ExperimentUser} for more details.
   * @returns A promise that resolves when the async request for variants is complete.
   */
  public async start(user: ExperimentUser): Promise<ExperimentClient> {
    this.user = user || {};
    this.storage.load();
    try {
      await this.fetchAll(
        user,
        this.config.assignmentTimeoutMillis,
        this.retriesEnabled,
      );
    } catch (e) {
      console.error(e);
    }
    return this;
  }

  /**
   * Sets the user context. Experiment will continue to serve variation assignments
   * from the old user context until new variants are fetched.
   *
   * If the fetch triggered by this function fails, the retry interval will be started
   * if the flag is set and continue until the fetch succeeds.
   * @param user The user context for variants. See {@link ExperimentUser} for more details.
   * @returns A promise that resolves when the async request for variants is complete.
   */
  public async setUser(user: ExperimentUser): Promise<ExperimentClient> {
    if (this.debug) {
      console.debug('[Experiment] Set user: ', user);
    }
    this.user = user;
    try {
      await this.fetchAll(
        user,
        this.config.assignmentTimeoutMillis,
        this.retriesEnabled,
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
   * See {@link ContextProvider} for more details
   * @param contextProvider
   */
  public setContextProvider(
    contextProvider: ContextProvider,
  ): ExperimentClient {
    this.contextProvider = contextProvider;
    return this;
  }

  protected async fetchAll(
    user: ExperimentUser,
    timeoutMillis: number,
    retry: boolean,
  ): Promise<Flags> {
    // Don't even try to fetch variants if API key is not set
    if (!this.apiKey) {
      throw Error('Experiment API key is empty');
    }

    if (this.debug) {
      console.debug('[Experiment] Fetch all: retry=' + retry);
    }

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
    let debugAssignmentRequestsParam: string;
    if (this.debugAssignmentRequests) {
      debugAssignmentRequestsParam = `d=${randomString(8)}`;
    }
    if (debugAssignmentRequestsParam) {
      queryString = '?' + debugAssignmentRequestsParam;
    }
    const endpoint = `${this.config.serverUrl}/sdk/vardata/${encodedContext}${queryString}`;
    const headers = {
      Authorization: `Api-Key ${this.apiKey}`,
    };
    if (this.debug) {
      console.debug('[Experiment] Fetch variants for user: ', userContext);
    }
    const response = await this.httpClient.request(
      endpoint,
      'GET',
      headers,
      null,
      timeoutMillis,
    );
    if (this.debug) {
      console.debug('[Experiment] Received fetch response:', response);
    }
    return response;
  }

  protected async parseResponse(response: Response): Promise<Flags> {
    const json = await response.json();
    const variants: Flags = {};
    for (const flag of Object.keys(json)) {
      variants[flag] = {
        value: json[flag].key,
        payload: json[flag].payload,
      };
    }
    if (this.debug) {
      console.debug('[Experiment] Received variants:', variants);
    }
    return variants;
  }

  protected storeVariants(variants: Flags): void {
    this.storage.clear();
    for (const key in variants) {
      this.storage.put(key, variants[key]);
    }
    this.storage.save();
    if (this.debug) {
      console.debug('[Experiment] Stored flags:', variants);
    }
  }

  protected async startRetries(user: ExperimentUser): Promise<void> {
    if (this.debug) {
      console.debug('[Experiment] Retry fetch all');
    }
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
      device_id: this.contextProvider?.getDeviceId() || undefined,
      user_id: this.contextProvider?.getUserId() || undefined,
      version: this.contextProvider?.getVersion() || undefined,
      language: this.contextProvider?.getLanguage() || undefined,
      platform: this.contextProvider?.getPlatform() || undefined,
      os: this.contextProvider?.getOs() || undefined,
      device_model: this.contextProvider?.getDeviceModel() || undefined,
      library: `experiment-js-client/${PACKAGE_VERSION}`,
      ...user,
    };
  }

  /**
   * Returns the variant for the provided flagKey.
   * Fallback order:
   * - Provided fallback
   * - Initial flags
   * - fallbackVariant in config
   * - Defaults.fallbackVariant (empty string)
   * Fallbacks happen if a value is null or undefined
   * @param flagKey
   * @param fallback A fallback value that takes precedence over any other fallback value.
   */
  public getVariant(flagKey: string, fallback?: string | Variant): Variant {
    if (!this.apiKey) {
      return { value: undefined };
    }
    const variant = this._convertVariant(
      this.storage.get(flagKey) ??
        fallback ??
        this.config.initialFlags?.[flagKey] ??
        this.config.fallbackVariant,
    );

    if (this.debug) {
      console.debug(
        `[Experiment] variant for flag ${flagKey} is ${variant.value}`,
      );
    }

    return variant;
  }

  /**
   * Returns all variants for the user
   */
  public getVariants(): Flags {
    if (!this.apiKey) {
      return {};
    }
    // Fallback to initial flags if storage is empty.
    const variants = this.storage.getAll();
    if (Object.keys(variants).length === 0) {
      return this.config.initialFlags ?? {};
    } else {
      return variants;
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
}
