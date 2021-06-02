import { ExperimentUser, ExperimentUserProvider } from './user';
import { Variant, Variants } from './variant';

/**
 * Interface for the main client.
 * @category Core Usage
 */
export interface Client {
  getUser(): ExperimentUser;
  setUser(user: ExperimentUser): void;
  fetch(user?: ExperimentUser): Promise<Client>;
  variant(key: string, fallback?: string | Variant): Variant;
  all(): Variants;
  getUserProvider(): ExperimentUserProvider;
  setUserProvider(userProvider: ExperimentUserProvider): Client;
}
