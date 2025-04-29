import { DefaultWebExperimentClient } from './experiment';
import { removeAntiFlickerCss } from './util';

const API_KEY = '{{DEPLOYMENT_KEY}}';
const initialFlags = '{{INITIAL_FLAGS}}';
const serverZone = '{{SERVER_ZONE}}';

DefaultWebExperimentClient.getInstance(API_KEY, initialFlags, {
  serverZone: serverZone,
})
  .start()
  .then(() => {
    // Remove anti-flicker css if it exists
    removeAntiFlickerCss();
  });

export { WebExperimentClient } from 'web-experiment';
export { WebExperimentConfig } from 'config';
export {
  ApplyVariantsOptions,
  RevertVariantsOptions,
  PreviewVariantsOptions,
} from 'types';
