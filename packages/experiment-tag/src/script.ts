import { initializeExperiment } from './experiment';

const API_KEY = '{{DEPLOYMENT_KEY}}';
const initialFlags = '{{INITIAL_FLAGS}}';
const serverZone = '{{SERVER_ZONE}}';

initializeExperiment(API_KEY, initialFlags, { serverZone: serverZone }).then(
  () => {
    // Remove anti-flicker css if it exists
    document.getElementById('amp-exp-css')?.remove();
  },
);
