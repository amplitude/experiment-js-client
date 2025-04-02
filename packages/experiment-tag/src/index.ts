import { DefaultWebExperimentClient } from './client';
import { WebExperimentConfig } from './types';

export const initialize = (
  apiKey: string,
  initialFlags: string,
  config: WebExperimentConfig,
): void => {
  DefaultWebExperimentClient.getInstance(apiKey, initialFlags, config)
    .start()
    .finally(() => {
      // Remove anti-flicker css if it exists
      document.getElementById('amp-exp-css')?.remove();
    });
};

export {
  ApplyVariantsOptions,
  RevertVariantsOptions,
  PreviewVariantsOptions,
  WebExperimentClient,
  WebExperimentConfig,
} from 'types';
