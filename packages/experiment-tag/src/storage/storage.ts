import { getGlobalScope } from '@amplitude/experiment-core';

export type StorageType = 'localStorage' | 'sessionStorage';

/**
 * Get a JSON string value from storage
 * @param storageType - The type of storage to use ('localStorage' or 'sessionStorage')
 * @param key - The key to retrieve the value for
 * @returns The JSON string value, or null if not found
 */
export const getRawStorageItem = <T>(
  storageType: StorageType,
  key: string,
): string => {
  return getStorage(storageType)?.getItem(key) || '';
};

/**
 * Set a JSON string value in storage
 * @param storageType - The type of storage to use ('localStorage' or 'sessionStorage')
 * @param key - The key to set the value for
 * @param value - The JSON string value to set
 */
export const setRawStorageItem = (
  storageType: StorageType,
  key: string,
  value: string,
): void => {
  getStorage(storageType)?.setItem(key, value);
};

export const getAndParseStorageItem = <T>(
  storageType: StorageType,
  key: string,
): T | null => {
  const value = getRawStorageItem(storageType, key);
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

export const setAndStringifyStorageItem = <T>(
  storageType: StorageType,
  key: string,
  value: T,
): void => {
  try {
    const stringValue = JSON.stringify(value);
    setRawStorageItem(storageType, key, stringValue);
  } catch (error) {
    console.warn(`Failed to persist data for key ${key}:`, error);
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

const getStorage = (storageType: StorageType): Storage | null => {
  const globalScope = getGlobalScope();
  if (!globalScope) {
    return null;
  }
  return globalScope[storageType];
};
