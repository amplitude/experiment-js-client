import { ExperimentClient, Variants } from '@amplitude/experiment-js-client';

import {
  ApplyVariantsOptions,
  PreviewVariantsOptions,
  RevertVariantsOptions,
} from './types';

/**
 * Interface for the Web Experiment client.
 */

export interface WebExperimentClient {
  start(): void;

  getExperimentClient(): ExperimentClient;

  applyVariants(options?: ApplyVariantsOptions): void;

  revertVariants(options?: RevertVariantsOptions): void;

  previewVariants(options: PreviewVariantsOptions): void;

  getVariants(): Variants;

  getActiveExperiments(): string[];

  getActivePages(): Record<string, Set<string>>;

  setRedirectHandler(handler: (url: string) => void): void;

  triggerView(name: string): void;
}
