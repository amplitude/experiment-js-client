import { DefaultWebExperimentClient } from './experiment';
import { WebExperimentConfig } from './types';

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

export {
  ApplyVariantsOptions,
  RevertVariantsOptions,
  PreviewVariantsOptions,
  WebExperimentClient,
  WebExperimentConfig,
} from 'types';

export {
  PreviewModeModal,
  showPreviewModeModal,
} from './preview/preview';
