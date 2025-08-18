import { getGlobalScope } from '@amplitude/experiment-core';

import { PREVIEW_MODE_SESSION_KEY } from '../experiment';

export const storePreviewFlags = (previewFlags: Record<string, string>) => {
  try {
    getGlobalScope()?.sessionStorage.setItem(
      PREVIEW_MODE_SESSION_KEY,
      JSON.stringify(previewFlags),
    );
  } catch (error) {
    console.warn('Error storing preview flags:', error);
  }
};

export const getStoredPreviewFlags = (): Record<string, string> => {
  try {
    const stored = getGlobalScope()?.sessionStorage.getItem(
      PREVIEW_MODE_SESSION_KEY,
    );
    if (!stored) {
      return {};
    }
    return JSON.parse(stored);
  } catch (error) {
    console.warn('Error retrieving stored preview flags:', error);
    return {};
  }
};
