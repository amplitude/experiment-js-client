import { ExperimentUser, ExperimentUserProvider } from './user';
import { Variant, Flags } from './variant';

/**
 * Interface for the main client.
 * @category Core Usage
 */
export interface Client {
  assign(user?: ExperimentUser): Promise<Client>;
  setUserProvider(userProvider: ExperimentUserProvider): Client;
  getVariant(flagKey: string, fallback?: string | Variant): Variant;
  getFlags(): Flags;
}
