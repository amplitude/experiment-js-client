import { ExperimentClient, Variants } from '@amplitude/experiment-js-client';

import {
  ApplyVariantsOptions,
  PreviewVariantsOptions,
  RevertVariantsOptions,
  WebExperimentContext,
} from './types';

/**
 * Interface for the Web Experiment client.
 * @category Core Usage
 */

export interface WebExperimentClient {
  start(): Promise<void>;

  getExperimentClient(): ExperimentClient | undefined;

  setContext(webExperimentContext: WebExperimentContext): void;

  setPreviousUrl(url: string): void;

  applyVariants(applyVariantsOptions?: ApplyVariantsOptions): void;

  revertVariants(revertVariantsOptions?: RevertVariantsOptions): void;

  previewVariants(previewVariantsOptions: PreviewVariantsOptions): void;

  getVariants(
    webExperimentContext?: WebExperimentContext,
    flagKeys?: string[],
  ): Variants;

  fetchRemoteFlags(): Promise<void>;

  getActiveExperimentsOnPage(currentUrl?: string): string[];

  setRefreshVariantsListener(eventType: string): void;
}
