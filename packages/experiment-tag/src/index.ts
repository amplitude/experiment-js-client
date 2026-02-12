import { Event, Plugin } from '@amplitude/analytics-types';
import { getGlobalScope } from '@amplitude/experiment-core';

import { DefaultWebExperimentClient } from './experiment';
import { HttpClient } from './preview/http';
import { SdkPreviewApi } from './preview/preview-api';
import { WebExperimentConfig } from './types';
import { applyAntiFlickerCss } from './util/anti-flicker';
import { isPreviewMode } from './util/url';

const eventBuffer: Array<{
  event_type: string;
  event_properties?: Record<string, unknown>;
}> = [];

export const initialize = (
  apiKey: string,
  initialFlags: string,
  pageObjects: string,
  config: WebExperimentConfig,
): void => {
  const globalScope = getGlobalScope();
  if (!globalScope) {
    throw new Error('Global scope not available');
  }

  // Expose plugin factory immediately (only if not already a real client instance)
  if (
    !globalScope.webExperiment ||
    !(globalScope.webExperiment instanceof DefaultWebExperimentClient)
  ) {
    globalScope.webExperiment = { plugin: createPlugin };
  }

  const shouldFetchConfigs =
    isPreviewMode() || globalScope.WebExperiment?.injectedByExtension;

  if (shouldFetchConfigs) {
    applyAntiFlickerCss();

    // Fetch latest configs and create client
    fetchLatestConfigs(apiKey, config.serverZone)
      .then((previewState) => {
        const flags = JSON.stringify(previewState.flags);
        const objects = JSON.stringify(previewState.pageViewObjects);
        startClient(apiKey, flags, objects, config);
      })
      .catch((error) => {
        console.warn('Failed to fetch latest configs for preview:', error);
        startClient(apiKey, initialFlags, pageObjects, config);
      })
      .finally(() => {
        // Remove anti-flicker css if it exists
        document.getElementById('amp-exp-css')?.remove();
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

// Plugin factory that can be called before client initialization
export const createPlugin = (): Plugin => ({
  name: '@amplitude/experiment-tag',
  type: 'enrichment',
  execute: async (context: Event): Promise<Event> => {
    const globalScope = getGlobalScope();
    const client = globalScope?.webExperiment;

    if (
      client &&
      client instanceof DefaultWebExperimentClient &&
      typeof client.trackEvent === 'function' &&
      (client as any).isRunning === true // Check if client is fully started
    ) {
      // Client ready - forward event directly
      client.trackEvent(
        context.event_type,
        context.event_properties as Record<string, unknown>,
      );
    } else {
      // Client not ready - buffer event
      eventBuffer.push({
        event_type: context.event_type,
        event_properties: context.event_properties as Record<string, unknown>,
      });
    }
    return context;
  },
});

// Internal function to flush buffered events
export const flushEventBuffer = (client: DefaultWebExperimentClient): void => {
  if (eventBuffer.length > 0) {
    eventBuffer.forEach(({ event_type, event_properties }) => {
      client.trackEvent(event_type, event_properties);
    });
    eventBuffer.length = 0;
  }
};

export {
  ApplyVariantsOptions,
  RevertVariantsOptions,
  PreviewVariantsOptions,
  WebExperimentClient,
  WebExperimentConfig,
} from './types';
