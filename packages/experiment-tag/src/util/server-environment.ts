import { getGlobalScope } from '@amplitude/experiment-core';

/**
 * URL of the experiment-tag script as it was loaded from. Captured at
 * module-evaluation time because `document.currentScript` is only set
 * during the initial synchronous run of the script.
 */
const sdkScriptSrc: string = (() => {
  try {
    const scope = getGlobalScope();
    const current = scope?.document?.currentScript as
      | HTMLScriptElement
      | null
      | undefined;
    return current?.src || '';
  } catch {
    return '';
  }
})();

/**
 * True when the SDK bundle was served from a `*.stag2.amplitude.com`
 * host. Used internally to route preview/config requests to staging
 * instead of prod. Intentionally not exposed via {@link WebExperimentConfig}
 * — only Amplitude's staging CDN serves from this host.
 */
export const isStagingServerEnvironment = (): boolean => {
  if (!sdkScriptSrc) {
    return false;
  }
  try {
    return new URL(sdkScriptSrc).hostname.endsWith('.stag2.amplitude.com');
  } catch {
    return false;
  }
};
