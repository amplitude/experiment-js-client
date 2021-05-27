import './App.css';
import React from 'react';

import { useExperiment, ExperimentProvider } from './experiment';

const Feature = (props) => {
  const { client, ready, loaded } = useExperiment();

  const feature = client.variant('js-browser-demo');
  console.log(
    `js-browser-demo: ${feature?.value}, payload: ${JSON.stringify(feature?.payload)}, ready: ${ready}, loaded: ${loaded}`,
  );

  return (
    <>
      <p className="description">
        If you see an image below, the feature flag is enabled
      </p>
      <p>{`js-browser-demo: ${feature?.value}`}</p>
      <p>{`payload: ${JSON.stringify(feature?.payload)}`}</p>
      {feature?.value && (
        <footer className="footer">
          <div>
            <img
              src="/amplitude-logo.svg"
              alt="Flag enabled!"
              className="logo"
            />
          </div>
        </footer>
      )}
    </>
  );
};

export default function App() {
  return (
    <ExperimentProvider experimentUser={{ user_id: 'user_id', device_family: 'device_family' }}>
      <div className="container">
        <main className="main">
          <h1 className="title">Browser demo for Experiment</h1>
          <Feature />
        </main>
      </div>
    </ExperimentProvider>
  );
}
