import { ExperimentUser } from '@amplitude/experiment-js-client';

export type WebExperimentContext = {
  user?: ExperimentUser;
  currentUrl?: string;
};

export type ApplyVariantsOption = {
  flagKeys?: string[];
};

export type RevertVariantsOptions = {
  flagKeys?: string[];
};
