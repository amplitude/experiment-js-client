import { DefaultWebExperimentClient } from './experiment';

const API_KEY = '{{DEPLOYMENT_KEY}}';
const initialFlags = '{{INITIAL_FLAGS}}';
const serverZone = '{{SERVER_ZONE}}';

DefaultWebExperimentClient.getInstance(API_KEY, initialFlags, {
  serverZone: serverZone,
})
  .start()
  .then(() => {
    // Remove anti-flicker css if it exists
    document.getElementById('amp-exp-css')?.remove();
  });

export { WebExperimentClient } from 'web-experiment';
export { WebExperimentConfig } from 'config';
export {
  ApplyVariantsOptions,
  RevertVariantsOptions,
  PreviewVariantsOptions,
} from 'types';
