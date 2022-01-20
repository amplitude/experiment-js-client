import { useCallback, useContext, useEffect, useState } from 'react';
import { AmplitudeAnalyticsProvider, AmplitudeUserProvider, Experiment, Source } from "@amplitude/experiment-js-client";
import React, { createContext } from 'react';
import amplitude from 'amplitude-js';

export const ExperimentContext = createContext({
  client: null,
  ready: false,
  loaded: false,
});

export const useExperiment = () => {
  return useContext(ExperimentContext);
};

const analytics = amplitude.getInstance()
analytics.init("a6dd847b9d2f03c816d4f3f8458cdc1d")
analytics.setUserId("brian.giori@amplitude.com")

const config = {
  debug: true,
  source: Source.LocalStorage,
  initialVariants: {
    'js-browser-demo': {
      value: 'initial',
      payload: {},
    }
  },
  userProvider: new AmplitudeUserProvider(analytics),
  analyticsProvider: new AmplitudeAnalyticsProvider(analytics),
}

const experiment = Experiment.initialize(
  'client-IAxMYws9vVQESrrK88aTcToyqMxiiJoR',
  config,
);

export const ExperimentProvider = (props) => {
  const { experimentUser, children } = props;
  const [ready, setReady] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const startExperiment = useCallback(async () => {
    experiment.fetch(experimentUser)
      .then(() => {
        setLoaded(true);
      });
  }, [experimentUser]);

  useEffect(() => {
    console.log('starting experiment');
    startExperiment();
    setReady(true);
  }, [startExperiment]);

  return (
    ready && (
      <ExperimentContext.Provider
        value={{
          client: experiment,
          ready: ready,
          loaded: loaded,
        }}
      >
        {children}
      </ExperimentContext.Provider>
    )
  );
};
