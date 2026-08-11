import { getGlobalScope } from '@amplitude/experiment-core';

import { Defaults, WebExperimentConfig } from '../types';

export const mergeWithWindowConfig = (
  config: WebExperimentConfig,
  globalScope: ReturnType<typeof getGlobalScope>,
): WebExperimentConfig => {
  const merged = {
    ...Defaults,
    ...config,
    ...globalScope?.experimentConfig,
  };
  // Attempt to find CSP nonce from the DOM when the config doesn't set one
  merged.nonce ??= (document?.querySelector('[nonce]') as HTMLElement)?.nonce;

  return merged;
};
