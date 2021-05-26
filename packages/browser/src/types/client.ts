import { ContextProvider } from './context';
import { ExperimentUser } from './user';
import { Variant, Flags } from './variant';

/**
 * Interface for the main client.
 * @category Core Usage
 */
export interface Client {
  assign(user?: ExperimentUser): Promise<Client>;
  setContextProvider(contextProvider: ContextProvider): Client;
  getVariant(flagKey: string, fallback?: string | Variant): Variant;
  getFlags(): Flags;
}
