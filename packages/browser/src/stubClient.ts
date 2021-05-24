import { Defaults } from './config';
import { Client } from './types/client';
import { ContextProvider } from './types/context';
import { SkylabUser } from './types/user';
import { Variant, Variants } from './types/variant';

/**
 * A stub {@link Client} implementation that does nothing for all methods
 */
export class StubSkylabClient implements Client {
  public async setUser(user: SkylabUser): Promise<StubSkylabClient> {
    return this;
  }

  public async start(user: SkylabUser): Promise<StubSkylabClient> {
    return this;
  }

  public setContextProvider(
    contextProvider: ContextProvider,
  ): StubSkylabClient {
    return this;
  }

  public getVariant(flagKey: string, fallback?: string | Variant): Variant {
    return { value: Defaults.fallbackVariant };
  }

  public getVariants(): Variants {
    return {};
  }
}
