import { Defaults } from './config';
import { Client } from './types/client';
import { ContextProvider } from './types/context';
import { ExperimentUser } from './types/user';
import { Variant, Variants } from './types/variant';

/**
 * A stub {@link Client} implementation that does nothing for all methods
 */
export class StubExperimentClient implements Client {
  public async setUser(user: ExperimentUser): Promise<StubExperimentClient> {
    return this;
  }

  public async start(user: ExperimentUser): Promise<StubExperimentClient> {
    return this;
  }

  public setContextProvider(
    contextProvider: ContextProvider,
  ): StubExperimentClient {
    return this;
  }

  public getVariant(flagKey: string, fallback?: string | Variant): Variant {
    return { value: Defaults.fallbackVariant };
  }

  public getVariants(): Variants {
    return {};
  }
}
