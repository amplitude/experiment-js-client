import { MKTG } from '@amplitude/analytics-core';

import { WebExperimentConfig } from '../types';

export const getExperimentStorageKey = (apiKey: string): string => {
  return `EXP_${apiKey.slice(0, 10)}`;
};

export const getDefaultUserProviderStorageKey = (apiKey: string): string => {
  return `EXP_${apiKey.slice(0, 10)}_DEFAULT_USER_PROVIDER`;
};

export const getUnsentEventsStorageKey = (
  config: WebExperimentConfig,
): string => {
  return `EXP_unsent_${config.instanceName ?? 'default_instance'}`;
};

export const getRedirectStorageKey = (apiKey: string): string => {
  return `EXP_${apiKey.slice(0, 10)}_REDIRECT`;
};

export const getPreviewModeSessionKey = (): string => {
  return 'amp-preview-mode';
};

export const getVisualEditorSessionKey = (): string => {
  return 'visual-editor-state';
};

export const getPersistedURLParamsKey = (apiKey: string): string => {
  return `EXP_${MKTG}_${apiKey.substring(0, 10)}`;
};
