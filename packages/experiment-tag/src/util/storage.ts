import { getGlobalScope } from '@amplitude/experiment-core';

export type StorageType = 'localStorage' | 'sessionStorage';

/**
 * Get a JSON value from storage and parse it
 * @param storageType - The type of storage to use ('localStorage' or 'sessionStorage')
 * @param key - The key to retrieve
 * @returns The parsed JSON value or null if not found or invalid JSON
 */
export const getStorage = <T = any>(
  storageType: StorageType,
  key: string,
): T | null => {
  try {
    const globalScope = getGlobalScope();
    if (!globalScope) {
      return null;
    }

    const storage = globalScope[storageType];
    if (!storage) {
      return null;
    }

    const value = storage.getItem(key);
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
export const setStorage = (
  storageType: StorageType,
  key: string,
  value: any,
): void => {
  try {
    const globalScope = getGlobalScope();
    if (!globalScope) {
      return;
    }

    const storage = globalScope[storageType];
    if (!storage) {
      return;
    }

    const jsonString = JSON.stringify(value);
    storage.setItem(key, jsonString);
  } catch (error) {
    console.warn(`Failed to stringify and set JSON in ${storageType}:`, error);
  }
};

/**
 * Remove a value from the specified storage type
 * @param storageType - The type of storage to use ('localStorage' or 'sessionStorage')
 * @param key - The key to remove
 */
export const removeStorage = (storageType: StorageType, key: string): void => {
  try {
    const globalScope = getGlobalScope();
    if (!globalScope) {
      return;
    }

    const storage = globalScope[storageType];
    if (!storage) {
      return;
    }

    storage.removeItem(key);
  } catch (error) {
    console.warn(`Failed to remove item from ${storageType}:`, error);
  }
};
