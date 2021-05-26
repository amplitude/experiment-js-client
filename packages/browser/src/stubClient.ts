/* eslint-disable @typescript-eslint/no-unused-vars */
import { Defaults } from './config';
import { Client } from './types/client';
import { ExperimentUser, ExperimentUserProvider } from './types/user';
import { Variant, Flags } from './types/variant';

/**
 * A stub {@link Client} implementation that does nothing for all methods
 */
export class StubExperimentClient implements Client {
  public async assign(user: ExperimentUser): Promise<StubExperimentClient> {
    return this;
  }

  public setUserProvider(
    uerProvider: ExperimentUserProvider,
  ): StubExperimentClient {
    return this;
  }

  public getVariant(flagKey: string, fallback?: string | Variant): Variant {
    return Defaults.fallbackVariant;
  }

  public getFlags(): Flags {
    return {};
  }
}
