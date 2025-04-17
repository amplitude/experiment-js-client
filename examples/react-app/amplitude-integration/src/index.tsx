import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import * as amplitude from '@amplitude/analytics-browser';
import { ExperimentClient, ExperimentAnalyticsPlugin } from "@amplitude/experiment-js-client";
import { AmplitudeBrowser } from "@amplitude/analytics-browser";

// Module augmentation to add experiment at compile time
declare module '@amplitude/analytics-browser' {
  interface AmplitudeBrowser {
    /**
     * Install the Amplitude Experiment plugin to the Amplitude Analytics instance
     * by `client.add(new ExperimentAnalyticsPlugin());`
     *
     * Call experiment APIs by accessing the underlying experiment instance,
     * for example, `client.experiment.fetch();`
     *
     * The user identity and user properties set in the analytics SDK will
     * automatically be used by the Experiment SDK on fetch().
     */
    experiment: ExperimentClient;
  }
}

// Add experiment property at run time
Object.defineProperty(AmplitudeBrowser.prototype, 'experiment', {
  get: function() {
    return (
      this.plugin(
        'experiment-analytics-plugin',
      ) as ExperimentAnalyticsPlugin
    ).experiment;
  },
});


// amplitude.init() is the result of object destructuring.
// It's part of BrowserClient interface.
// So has to use class here.
/**
 * Initialize the Amplitude Analytics SDK.
 */
const client: AmplitudeBrowser = new amplitude.AmplitudeBrowser();
client.init('API_KEY', 'user@company.com', {
  logLevel: amplitude.Types.LogLevel.Debug,
}).promise.then((_) => {
  client.add(new ExperimentAnalyticsPlugin({ debug: true })).promise.then((_) => {
    // Add experiment plugin to existing Amplitude analytics SDK
    // and call experiment APIs.
    // Experiment APIs are only available when
    // 1. Amplitude instance has successfully setup
    // 2. Experiment plugin has been installed successfully
    void client.experiment.fetch();
    const variant = client.experiment.variant('FLAG_KEY');
  });
});

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
