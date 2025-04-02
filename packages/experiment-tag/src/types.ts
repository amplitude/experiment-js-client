import {
  ExperimentClient,
  ExperimentConfig,
  Variants,
} from '@amplitude/experiment-js-client';

export type ApplyVariantsOptions = {
  /**
   * A list of flag keys to apply.
   */
  flagKeys?: string[];
};

export type RevertVariantsOptions = {
  /**
   * A list of flag keys to revert.
   */
  flagKeys?: string[];
};

export type PreviewVariantsOptions = {
  /**
   * A map of flag keys to variant keys to be previewed.
   */
  keyToVariant?: Record<string, string>;
};

export interface WebExperimentConfig extends ExperimentConfig {
  /**
   * Determines whether the default implementation for handling navigation {@link setDefaultUrlChangeHandler} will be used
   * If this is set to false, for single-page applications:
   * 1. The variant actions applied will be based on the context (user, page URL) when the web experiment script was loaded
   * 2. Custom handling of navigation should be implemented such that variant actions applied on the site reflect the latest context
   */
  useDefaultNavigationHandler?: boolean;
}

export const Defaults: WebExperimentConfig = {
  useDefaultNavigationHandler: true,
};

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
  setRedirectHandler(handler: (url: string) => void): void;
}
