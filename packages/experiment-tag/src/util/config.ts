import { getGlobalScope } from '@amplitude/experiment-core';

import { ConsentOptions, Defaults, WebExperimentConfig } from '../types';

/**
 * Resolves the config the client actually runs on: `window.experimentConfig`
 * wins over the `initialize` argument, which wins over {@link Defaults}. The
 * single owner of that precedence — anything needing an effective config value
 * comes through here rather than reading the `initialize` argument.
 *
 * `consentOptions` merges field-wise rather than wholesale, so a consent platform
 * can set `consentStatus` on the window without dropping the `consentRequired`
 * the install snippet passed in — a top-level spread would swap the whole object
 * out and silently open the gate.
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
