import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { Experiment } from '@amplitude/experiment-js-client';

/**
 * Initialize the Amplitude Experiment SDK and export the initialized client.
 */
export const experiment = Experiment.initialize(
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
