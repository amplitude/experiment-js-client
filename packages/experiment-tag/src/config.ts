import { ExperimentConfig } from '@amplitude/experiment-js-client';

export interface WebExperimentConfig extends ExperimentConfig {
  /**
   * Determines whether variants actions should be reverted and reapplied on navigation events.
   */
  reapplyVariantsOnNavigation?: boolean;
  /**
   * Determines whether anti-flicker CSS should be applied for remote blocking flags.
   */
  applyAntiFlickerForRemoteBlocking?: boolean;
}

export const Defaults: WebExperimentConfig = {
  reapplyVariantsOnNavigation: true,
  applyAntiFlickerForRemoteBlocking: true,
};
