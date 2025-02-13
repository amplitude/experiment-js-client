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
  getExperimentClient(): ExperimentClient | undefined;

  applyVariants(applyVariantsOptions?: ApplyVariantsOptions): void;

  revertVariants(revertVariantsOptions?: RevertVariantsOptions): void;

  previewVariants(previewVariantsOptions: PreviewVariantsOptions): void;

  getVariants(): Variants;

  getActiveExperiments(): string[];
}
