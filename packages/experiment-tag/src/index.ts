import { WebExperimentConfig } from './config';
import { DefaultWebExperimentClient } from './experiment';

export const initialize = (
  apiKey: string,
  initialFlags: string,
  pageObjects: string,
  config: WebExperimentConfig,
): void => {
  DefaultWebExperimentClient.getInstance(
    apiKey,
    initialFlags,
    pageObjects,
    config,
  )
    .start()
    .finally(() => {
      // Remove anti-flicker css if it exists
      document.getElementById('amp-exp-css')?.remove();
    });
};

export { WebExperimentClient } from 'web-experiment';
export { WebExperimentConfig } from 'config';
export {
  ApplyVariantsOptions,
  RevertVariantsOptions,
  PreviewVariantsOptions,
} from 'types';
