import { initializeExperiment } from './experiment';

const API_KEY = 'EXPERIMENT_TAG_API_KEY';
const initialFlags = 'EXPERIMENT_TAG_INITIAL_FLAGS';
initializeExperiment(API_KEY, initialFlags);
