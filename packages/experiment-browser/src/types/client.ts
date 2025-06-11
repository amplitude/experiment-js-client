import { ExperimentUserProvider } from './provider';
import { ExperimentUser } from './user';
import { Variant, Variants } from './variant';

export type FetchOptions = {
  /**
   * When set, fetch will only request variants for the given flag keys.
   */
  flagKeys?: string[];
  /**
   * When set to true, the fetch() method will throw an error if the initial
   * request fails for any reason (including timeouts, network errors, or server
   * errors), rather than silently handling the error. Background retries will
   * still be started if configured via retryFetchOnFailure.
   *
   * When false or undefined (default), errors are handled silently and retries
   * may occur in the background based on the retryFetchOnFailure configuration.
   */
  throwOnError?: boolean;
};

/**
 * Interface for the main client.
 * @category Core Usage
 */
export interface Client {
  start(user?: ExperimentUser): Promise<void>;
  stop(): void;
  fetch(user?: ExperimentUser, options?: FetchOptions): Promise<Client>;
  variant(key: string, fallback?: string | Variant): Variant;
  all(): Variants;
  clear(): void;
  exposure(key: string): void;
  getUser(): ExperimentUser;
  setUser(user: ExperimentUser): void;

  /**
   * @deprecated use ExperimentConfig.userProvider instead
   */
  getUserProvider(): ExperimentUserProvider;
  /**
   * @deprecated use ExperimentConfig.userProvider instead
   */
  setUserProvider(userProvider: ExperimentUserProvider): Client;
}
