import { getGlobalScope } from '@amplitude/experiment-core';

import { ConsentOptions, Defaults, WebExperimentConfig } from './types';

/**
 * Resolves the config the client actually runs on: `window.experimentConfig`
 * wins over the `initialize` argument, which wins over {@link Defaults}.
 *
 * This is the single owner of that precedence. Anything that needs an effective
 * config value must come through here rather than reading the `initialize`
 * argument, which is only half the picture — the denial sweep read
 * `config.instanceName` directly and rebuilt its keys under the default
 * instance while the real data sat under the window-supplied one.
 *
 * `consentOptions` merges field-wise rather than being replaced wholesale, so a
 * consent platform can set `consentStatus` on the window without dropping the
 * `consentRequired` that the install snippet passed in. A top-level spread
 * would swap the whole object out and silently open the gate.
 */
export const mergeWithWindowConfig = (
  config: WebExperimentConfig,
  globalScope: ReturnType<typeof getGlobalScope>,
): WebExperimentConfig & { consentOptions: ConsentOptions } => ({
  ...Defaults,
  ...config,
  ...globalScope?.experimentConfig,
  consentOptions: {
    ...config.consentOptions,
    ...globalScope?.experimentConfig?.consentOptions,
  },
});
