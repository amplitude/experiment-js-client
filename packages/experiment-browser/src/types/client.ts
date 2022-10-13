import { ExperimentUserProvider } from './provider';
import { ExperimentUser } from './user';
import { Variant, Variants } from './variant';

/**
 * Interface for the main client.
 * @category Core Usage
 */
export interface Client {
  fetch(user?: ExperimentUser): Promise<Client>;
  variant(key: string, fallback?: string | Variant): Variant;
  all(): Variants;
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
