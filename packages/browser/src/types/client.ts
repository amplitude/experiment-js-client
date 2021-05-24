import { ContextProvider } from './context';
import { ExperimentUser } from './user';
import { Variant, Variants } from './variant';

/**
 * Interface for the main client.
 * @category Core Usage
 */
export interface Client {
  start(user: ExperimentUser): Promise<Client>;
  setUser(user: ExperimentUser): Promise<Client>;
  getVariant(flagKey: string, fallback?: string | Variant): Variant;
  getVariants(): Variants;
  setContextProvider(contextProvider: ContextProvider): Client;
}
