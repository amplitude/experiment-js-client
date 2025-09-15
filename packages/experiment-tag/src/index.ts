import { getGlobalScope } from '@amplitude/experiment-core';

import { version as PACKAGE_VERSION } from '../package.json';

import { DefaultWebExperimentClient, PREVIEW_MODE_PARAM } from './experiment';
import { FetchHttpClient, WrapperClient } from './preview/http';
import { SdkPreviewApi } from './preview/preview-api';
import { Defaults, WebExperimentConfig } from './types';
import { getUrlParams } from './util/url';

export const initialize = (
  apiKey: string,
  initialFlags: string,
  pageObjects: string,
  config: WebExperimentConfig,
): void => {
  if (
    getUrlParams()[PREVIEW_MODE_PARAM] === 'true' ||
    getGlobalScope()?.WebExperiment.injectedByExtension
  ) {
    const serverZone = config.serverZone ?? 'US';
    fetchLatestConfigs(apiKey, serverZone).then((previewState) => {
      const previewFlags = JSON.stringify(previewState.flags);
      const previewPageObjects = JSON.stringify(previewState.pageViewObjects);

      DefaultWebExperimentClient.getInstance(
        apiKey,
        previewFlags ?? initialFlags,
        previewPageObjects ?? pageObjects,
        config,
      )
        .start()
        .finally(() => {
          // Remove anti-flicker css if it exists
          document.getElementById('amp-exp-css')?.remove();
        });
    });
  } else {
    DefaultWebExperimentClient.getInstance(
      apiKey,
      initialFlags,
      pageObjects,
      config,
    )
      .start()
      .finally(() => {
        // Remove anti-flicker css if it exists
        document.getElementById('amp-exp-css')?.remove();
      });
  }
};

const fetchLatestConfigs = async (apiKey: string, serverZone: string) => {
  // fetch up-to-date flags and page view objects
  const serverUrl =
    serverZone === 'US'
      ? 'https://api.lab.amplitude.com'
      : 'https://api.lab.eu.amplitude.com';
  const api = new SdkPreviewApi(
    apiKey,
    serverUrl,
    new WrapperClient(FetchHttpClient),
  );
  return await api.getPreviewFlagsAndPageViewObjects({
    libraryName: 'experiment-tag',
    libraryVersion: PACKAGE_VERSION,
    timeoutMillis: Defaults.fetchTimeoutMillis,
  });
};

export {
  ApplyVariantsOptions,
  RevertVariantsOptions,
  PreviewVariantsOptions,
  WebExperimentClient,
  WebExperimentConfig,
} from 'types';
