import { ExperimentUser } from '@amplitude/experiment-js-client';

export type WebExperimentContext = {
  user?: ExperimentUser;
  currentUrl?: string;
};

export type ApplyVariantsOptions = {
  flagKeys?: string[];
};

export type RevertVariantsOptions = {
  flagKeys?: string[];
};

export type PreviewVariantsOptions = {
  keyToVariant?: Record<string, string>;
};
