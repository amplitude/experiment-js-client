import { getGlobalScope } from '@amplitude/experiment-core';

import { ConsentStatus } from '../types';

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

const getStorage = (storageType: StorageType): Storage | null => {
  const globalScope = getGlobalScope();
  if (!globalScope) {
    return null;
  }
  return globalScope[storageType];
};

/**
 * Consent-aware storage manager that handles persistence based on consent status
 */
export class ConsentAwareStorage {
  private inMemoryStorage: Map<StorageType, Map<string, unknown>> = new Map();
  private consentStatus: ConsentStatus = ConsentStatus.PENDING;

  constructor(initialConsentStatus: ConsentStatus) {
    this.consentStatus = initialConsentStatus;
  }

  /**
   * Set the consent status and handle persistence accordingly
   */
  public setConsentStatus(consentStatus: ConsentStatus): void {
    this.consentStatus = consentStatus;

    if (consentStatus === ConsentStatus.GRANTED) {
      for (const [storageType, storageMap] of this.inMemoryStorage.entries()) {
        for (const [key, value] of storageMap.entries()) {
          try {
            const jsonString = JSON.stringify(value);
            getStorage(storageType)?.setItem(key, jsonString);
          } catch (error) {
            console.warn(`Failed to persist data for key ${key}:`, error);
          }
        }
      }
      this.inMemoryStorage.clear();
    }
  }

  /**
   * Get a JSON value from storage with consent awareness
   */
  public getItem<T>(storageType: StorageType, key: string): T | null {
    if (this.consentStatus === ConsentStatus.GRANTED) {
      return getStorageItem(storageType, key);
    }

    const storageMap = this.inMemoryStorage.get(storageType);
    if (storageMap && storageMap.has(key)) {
      return storageMap.get(key) as T;
    }

    return null;
  }

  /**
   * Set a JSON value in storage with consent awareness
   */
  public setItem(storageType: StorageType, key: string, value: unknown): void {
    if (this.consentStatus === ConsentStatus.PENDING) {
      if (!this.inMemoryStorage.has(storageType)) {
        this.inMemoryStorage.set(storageType, new Map());
      }
      this.inMemoryStorage.get(storageType)?.set(key, value);
    } else if (this.consentStatus === ConsentStatus.GRANTED) {
      setStorageItem(storageType, key, value);
    }
  }

  /**
   * Remove a value from storage with consent awareness
   */
  public removeItem(storageType: StorageType, key: string): void {
    const storageMap = this.inMemoryStorage.get(storageType);
    if (storageMap) {
      storageMap.delete(key);
      if (storageMap.size === 0) {
        this.inMemoryStorage.delete(storageType);
      }
    }

    if (this.consentStatus === ConsentStatus.GRANTED) {
      removeStorageItem(storageType, key);
    }
  }
}
