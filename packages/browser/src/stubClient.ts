/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { Defaults } from './config';
import { Client } from './types/client';
import { ExperimentUser, ExperimentUserProvider } from './types/user';
import { Variant, Variants } from './types/variant';

/**
 * A stub {@link Client} implementation that does nothing for all methods
 */
export class StubExperimentClient implements Client {
  public getUser(): ExperimentUser {
    return {};
  }

  public setUser(user: ExperimentUser): void {}

  public async fetch(user: ExperimentUser): Promise<StubExperimentClient> {
    return this;
  }

  public getUserProvider(): ExperimentUserProvider {
    return null;
  }

  public setUserProvider(
    uerProvider: ExperimentUserProvider,
  ): StubExperimentClient {
    return this;
  }

  public variant(key: string, fallback?: string | Variant): Variant {
    return Defaults.fallbackVariant;
  }

  public all(): Variants {
    return {};
  }
}
