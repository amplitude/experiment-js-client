import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import * as amplitude from '@amplitude/analytics-browser';
import { Experiment, experimentAnalyticsPlugin, ExperimentClient } from "@amplitude/experiment-js-client";
import { AmplitudeBrowser } from "@amplitude/analytics-browser";

// Module augmentation to add experiment variable at compile time
declare module '@amplitude/analytics-browser' {
  interface AmplitudeBrowser {
    experiment: ExperimentClient;
  }
}

/**
 * Initialize the Amplitude Analytics SDK.
 */
amplitude.init('API_KEY', 'user@company.com');
amplitude.identify(new amplitude.Identify().set('premium', true))

// Add experiment plugin to existing Amplitude analytics SDK
// and call experiment APIs.
// amplitude.init is the result of object destructuring.
// It's part of BrowserClient interface.
// So has to create a real object.
const client: AmplitudeBrowser = new amplitude.AmplitudeBrowser();
client.init('API_KEY', 'user@company.com');
client.add(experimentAnalyticsPlugin());
void client.experiment.fetch();
const variant = client.experiment.variant('FLAG_KEY');

/**
 * Initialize the Amplitude Experiment SDK with the Amplitude Analytics
 * integration and export the initialized client.
 *
 * The user identity and user properties set in the analytics SDK will
 * automatically be used by the Experiment SDK on fetch().
 */
export const experiment = Experiment.initializeWithAmplitudeAnalytics(
  'DEPLOYMENT_KEY',
  { debug: true }
);

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
