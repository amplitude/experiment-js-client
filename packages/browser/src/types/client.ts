import { ContextProvider } from './context';
import { ExperimentUser } from './user';
import { Variant, Flags } from './variant';

/**
 * Interface for the main client.
 * @category Core Usage
 */
export interface Client {
  start(user: ExperimentUser): Promise<Client>;
  setUser(user: ExperimentUser): Promise<Client>;
  getVariant(flagKey: string, fallback?: string | Variant): Variant;
  getVariants(): Flags;
  setContextProvider(contextProvider: ContextProvider): Client;
}
