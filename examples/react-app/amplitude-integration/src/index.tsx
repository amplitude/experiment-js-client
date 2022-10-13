import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import * as amplitude from '@amplitude/analytics-browser';
import { Experiment } from '@amplitude/experiment-js-client';

/**
 * Initialize the Amplitude Analytics SDK.
 */
amplitude.init('a6dd847b9d2f03c816d4f3f8458cdc1d', 'user@company.com');
amplitude.identify(new amplitude.Identify().set('premium', true))

/**
 * Initialize the Amplitude Experiment SDK with the Amplitude Analytics
 * integration and export the initialized client.
 *
 * The user identity and user properties set in the analytics SDK will
 * automatically be used by the Experiment SDK on fetch().
 */
export const experiment = Experiment.initializeWithAmplitudeAnalytics(
  'client-QQEu7NCkqMmhdGdWl3Y4post5mZaVkCL',
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
