import { getGlobalScope } from '@amplitude/experiment-core';

import { DefaultWebExperimentClient } from './experiment';
import { HttpClient } from './preview/http';
import { SdkPreviewApi } from './preview/preview-api';
import { deletePersistedData } from './storage/storage';
import { ConsentStatus, WebExperimentConfig } from './types';
import { applyAntiFlickerCss } from './util/anti-flicker';
import { isPreviewMode } from './util/url';

export const initialize = (
  apiKey: string,
  initialFlags: string,
  pageObjects: string,
  config: WebExperimentConfig,
): void => {
  if (
    getGlobalScope()?.experimentConfig.consentOptions.status ===
    ConsentStatus.REJECTED
  ) {
    deletePersistedData(apiKey, config);
    return;
  }
  const shouldFetchConfigs =
    isPreviewMode() || getGlobalScope()?.WebExperiment.injectedByExtension;

  if (shouldFetchConfigs) {
    applyAntiFlickerCss();
    fetchLatestConfigs(apiKey, config.serverZone)
      .then((previewState) => {
        const flags = JSON.stringify(previewState.flags);
        const objects = JSON.stringify(previewState.pageViewObjects);
        startClient(apiKey, flags, objects, config);
      })
      .catch((error) => {
        console.warn('Failed to fetch latest configs for preview:', error);
        startClient(apiKey, initialFlags, pageObjects, config);
      });
  } else {
    startClient(apiKey, initialFlags, pageObjects, config);
  }
};

const startClient = (
  apiKey: string,
  flags: string,
  objects: string,
  config: WebExperimentConfig,
): void => {
  DefaultWebExperimentClient.getInstance(apiKey, flags, objects, config)
    .start()
    .finally(() => {
      // Remove anti-flicker css if it exists
      document.getElementById('amp-exp-css')?.remove();
    });
};

const fetchLatestConfigs = async (apiKey: string, serverZone?: string) => {
  const serverUrl =
    serverZone === 'EU'
      ? 'https://api.lab.eu.amplitude.com'
      : 'https://api.lab.amplitude.com';
  const api = new SdkPreviewApi(apiKey, serverUrl, HttpClient);
  return api.getPreviewFlagsAndPageViewObjects();
};

export {
  ApplyVariantsOptions,
  RevertVariantsOptions,
  PreviewVariantsOptions,
  WebExperimentClient,
  WebExperimentConfig,
} from 'types';
