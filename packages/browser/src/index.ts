/**
 * This is the API Reference for the Experiment JS Client SDK.
 * For more details on implementing this SDK, view the documentation
 * [here](https://amplitude-lab.readme.io/docs/javascript-client-sdk).
 * @module experiment-js-client
 */

export { ExperimentConfig } from './config';
export { AmplitudeContextProvider } from './context/amplitudeContextProvider';
export { Experiment } from './factory';
export { StubExperimentClient } from './stubClient';
export { ExperimentClient } from './experimentClient';
export { Client } from './types/client';
export { ContextProvider } from './types/context';
export { ExperimentUser } from './types/user';
export { Variant, Variants } from './types/variant';
