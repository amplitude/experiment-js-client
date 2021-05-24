import { useCallback, useContext, useEffect, useState } from 'react';
import { Experiment } from '@amplitude/experiment-js-client';
import React, { createContext } from 'react';

export const ExperimentContext = createContext({
  client: null,
  ready: false,
  loaded: false,
});

export const useExperiment = () => {
  return useContext(ExperimentContext);
};

export const ExperimentProvider = (props) => {
  const { instanceName, experimentUser, children } = props;
  const [ready, setReady] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const startExperiment = useCallback(async () => {
    Experiment.instance(instanceName)
      .start(experimentUser)
      .then(() => {
        setLoaded(true);
      });
  }, [instanceName, experimentUser]);

  useEffect(() => {
    console.log('starting experiment');
    startExperiment();
    setReady(true);
  }, [startExperiment]);

  return (
    ready && (
      <ExperimentContext.Provider
        value={{
          client: Experiment.instance(instanceName),
          ready: ready,
          loaded: loaded,
        }}
      >
        {children}
      </ExperimentContext.Provider>
    )
  );
};
