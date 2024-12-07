import { initializeExperiment } from './experiment';

const API_KEY = '{{DEPLOYMENT_KEY}}';
const initialFlags = '{{INITIAL_FLAGS}}';
initializeExperiment(API_KEY, initialFlags);
// Remove anti-flicker css if it exists
document.getElementById('amp-exp-css')?.remove();
