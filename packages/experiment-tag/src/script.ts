import { Defaults } from './config';
import { DefaultWebExperimentClient } from './experiment';

const API_KEY = '{{DEPLOYMENT_KEY}}';
const initialFlags = '{{INITIAL_FLAGS}}';
const serverZone = '{{SERVER_ZONE}}';

const webExperimentClient = new DefaultWebExperimentClient(
  API_KEY,
  initialFlags,
  {
    reapplyVariantsOnNavigation: Defaults.reapplyVariantsOnNavigation,
    applyRemoteExperimentAntiFlicker: Defaults.applyRemoteExperimentAntiFlicker,
    serverZone: serverZone,
  },
);
webExperimentClient.start().then(() => {
  // Remove anti-flicker css if it exists
  document.getElementById('amp-exp-css')?.remove();
});
