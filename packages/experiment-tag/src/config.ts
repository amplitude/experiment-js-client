import { ExperimentConfig } from '@amplitude/experiment-js-client';

export interface WebExperimentConfig extends ExperimentConfig {
  /**
   * Determines whether the default implementation for handling navigation {@link setDefaultUrlChangeListener} will be used
   * If this is set to false, for single-page applications:
   * 1. The variant actions applied will be based on the context (user, page URL) when the web experiment script was loaded
   * 2. Custom handling of navigation should be implemented such that variant actions applied on the site reflect the latest context
   */
  useDefaultNavigationListener?: boolean;
  /**
   * Determines whether anti-flicker CSS should be applied for experiments with remote properties.
   */
  applyRemoteExperimentAntiFlicker?: boolean;
}

export const Defaults: WebExperimentConfig = {
  useDefaultNavigationListener: true,
  applyRemoteExperimentAntiFlicker: true,
};
