import { Defaults } from './config';
import { WebExperiment } from './experiment';

const API_KEY = '{{DEPLOYMENT_KEY}}';
const initialFlags = '{{INITIAL_FLAGS}}';
const serverZone = '{{SERVER_ZONE}}';

const webExperimentClient = new WebExperiment(API_KEY, initialFlags, {
  reapplyVariantsOnNavigation: Defaults.reapplyVariantsOnNavigation,
  applyAntiFlickerForRemoteBlocking: Defaults.applyAntiFlickerForRemoteBlocking,
  serverZone: serverZone,
});
webExperimentClient.start().then(() => {
  // Remove anti-flicker css if it exists
  document.getElementById('amp-exp-css')?.remove();
});
