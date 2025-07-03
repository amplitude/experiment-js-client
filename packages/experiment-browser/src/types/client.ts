import { ExperimentUserProvider } from './provider';
import { ExperimentUser } from './user';
import { Variant, Variants } from './variant';

export type FetchOptions = {
  /**
   * When set, fetch will only request variants for the given flag keys.
   */
  flagKeys?: string[];
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
