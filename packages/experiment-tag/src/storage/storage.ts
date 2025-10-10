import { getGlobalScope } from '@amplitude/experiment-core';

import { WebExperimentConfig } from '../types';

import {
  getDefaultUserProviderStorageKey,
  getExperimentStorageKey,
  getUnsentEventsStorageKey,
} from './keys';

export type StorageType = 'localStorage' | 'sessionStorage';

/**
 * Get a JSON value from storage and parse it
 * @param storageType - The type of storage to use ('localStorage' or 'sessionStorage')
 * @param key - The key to retrieve
 * @returns The parsed JSON value or null if not found or invalid JSON
 */
export const getStorageItem = <T>(
  storageType: StorageType,
  key: string,
): T | null => {
  try {
    const value = getStorage(storageType)?.getItem(key);
    if (!value) {
      return null;
    }
    return JSON.parse(value) as T;
  } catch (error) {
    console.warn(`Failed to get and parse JSON from ${storageType}:`, error);
    return null;
  }
};

/**
 * Set a JSON value in storage by stringifying it
 * @param storageType - The type of storage to use ('localStorage' or 'sessionStorage')
 * @param key - The key to store the value under
 * @param value - The value to stringify and store
 */
export const setStorageItem = (
  storageType: StorageType,
  key: string,
  value: unknown,
): void => {
  try {
    const jsonString = JSON.stringify(value);
    getStorage(storageType)?.setItem(key, jsonString);
  } catch (error) {
    console.warn(`Failed to stringify and set JSON in ${storageType}:`, error);
  }
};

/**
 * Remove a value from the specified storage type
 * @param storageType - The type of storage to use ('localStorage' or 'sessionStorage')
 * @param key - The key to remove
 */
export const removeStorageItem = (
  storageType: StorageType,
  key: string,
): void => {
  try {
    getStorage(storageType)?.removeItem(key);
  } catch (error) {
    console.warn(`Failed to remove item from ${storageType}:`, error);
  }
};

export const getStorage = (storageType: StorageType): Storage | null => {
  const globalScope = getGlobalScope();
  if (!globalScope) {
    return null;
  }
  return globalScope[storageType];
};

export const deletePersistedData = (
  apiKey: string,
  config: WebExperimentConfig,
): void => {
  const experimentStorageKey = getExperimentStorageKey(apiKey);
  const defaultUserProviderStorageKey =
    getDefaultUserProviderStorageKey(apiKey);
  const unsentEventsStorageKey = getUnsentEventsStorageKey(config);
  removeStorageItem('localStorage', experimentStorageKey);
  removeStorageItem('localStorage', defaultUserProviderStorageKey);
  removeStorageItem('sessionStorage', defaultUserProviderStorageKey);
  removeStorageItem('localStorage', unsentEventsStorageKey);
};
