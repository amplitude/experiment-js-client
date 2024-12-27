import { WebExperiment } from './experiment';

const API_KEY = '{{DEPLOYMENT_KEY}}';
const initialFlags = '{{INITIAL_FLAGS}}';
const webExperimentClient = new WebExperiment(API_KEY, initialFlags);
webExperimentClient.initializeExperiment().then(() => {
  // Remove anti-flicker css if it exists
  document.getElementById('amp-exp-css')?.remove();
});
