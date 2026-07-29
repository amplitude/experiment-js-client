import { getGlobalScope } from '@amplitude/experiment-core';

import { consentGate, isConsentPending } from '../consent/consent-gate';
import { ConsentManager } from '../consent/consent-manager';

export type StorageType = 'localStorage' | 'sessionStorage';

/**
 * Writes made while the visitor has yet to decide, held here instead of in
 * localStorage/sessionStorage. Entries carry the serialized form rather than the
 * live object so a buffered read parses a fresh copy exactly as a real read
 * would, and so a flush is a verbatim handover of what the caller asked to
 * store.
 */
const pendingWrites = new Map<
  string,
  { storageType: StorageType; key: string; json: string }
>();

/**
 * The manager this module's flush/drop listener is attached to. Tracking the
 * instance rather than a boolean means a replaced manager (only `reset` does
 * that) re-arms on the next gated call instead of leaving the buffer wired to a
 * manager nothing transitions any more.
 */
let armedManager: ConsentManager | null = null;

const armConsentListener = (): void => {
  if (armedManager === consentGate.manager) {
    return;
  }
  armedManager = consentGate.manager;
  pendingWrites.clear();
  consentGate.manager.onChange((status) => {
    if (status === 'granted') {
      for (const { storageType, key, json } of pendingWrites.values()) {
        writeThrough(storageType, key, json);
      }
    }
    // Denial discards them: consent was withheld for the whole window in which
    // they were produced.
    pendingWrites.clear();
  });
};

const bufferKey = (storageType: StorageType, key: string): string =>
  `${storageType}:${key}`;

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
  if (isConsentPending()) {
    armConsentListener();
    // Reads are gated as well as writes — ePrivacy covers access to data already
    // on the device, so a pending visitor sees only what this page put in the
    // buffer, never what an earlier consented session left behind.
    return parseOrNull<T>(pendingWrites.get(bufferKey(storageType, key))?.json);
  }
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
  let jsonString: string;
  try {
    jsonString = JSON.stringify(value);
  } catch (error) {
    console.warn(`Failed to stringify and set JSON in ${storageType}:`, error);
    return;
  }
  if (isConsentPending()) {
    armConsentListener();
    pendingWrites.set(bufferKey(storageType, key), {
      storageType,
      key,
      json: jsonString,
    });
    return;
  }
  writeThrough(storageType, key, jsonString);
};

const writeThrough = (
  storageType: StorageType,
  key: string,
  jsonString: string,
): void => {
  try {
    getStorage(storageType)?.setItem(key, jsonString);
  } catch (error) {
    console.warn(`Failed to set JSON in ${storageType}:`, error);
  }
};

const parseOrNull = <T>(json: string | undefined): T | null => {
  if (!json) {
    return null;
  }
  try {
    return JSON.parse(json) as T;
  } catch {
    return null;
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
  if (isConsentPending()) {
    armConsentListener();
    // Only the buffered write is dropped. Deleting the persisted key would be a
    // write to the device in its own right, and denial cleanup — which does run
    // against real storage — is the path that removes it.
    pendingWrites.delete(bufferKey(storageType, key));
    return;
  }
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
