import { getGlobalScope } from '@amplitude/experiment-core';

import {
  consentGate,
  isConsentPending,
  isConsentWithheld,
  onConsentDecision,
} from '../consent/consent-gate';
import type { ConsentManager } from '../consent/consent-manager';

import { mergePendingJsonWithDevice } from './grant-flush-merge';
import { isConsentExemptStorageKey } from './storage-keys';

export type StorageType = 'localStorage' | 'sessionStorage';

/**
 * Writes buffered while consent is pending, held here instead of in
 * localStorage/sessionStorage. Entries hold the serialized form so buffered
 * reads parse a fresh copy exactly as a real read would.
 */
const pendingWrites = new Map<
  string,
  { storageType: StorageType; key: string; json: string }
>();

/**
 * The manager this module's flush/drop listener is attached to. The test-only
 * `consentGate.reset()` replaces the manager, stranding listeners on the old
 * instance; comparing instances makes the next gated call re-subscribe to the
 * live one.
 */
let armedManager: ConsentManager | null = null;

const armConsentListener = (): void => {
  if (armedManager === consentGate.manager) {
    return;
  }
  armedManager = consentGate.manager;
  pendingWrites.clear();
  onConsentDecision((granted) => {
    if (granted) {
      for (const { storageType, key, json } of pendingWrites.values()) {
        if (consentGate.manager.getStatus() !== 'granted') {
          break;
        }
        const merged = mergePendingJsonWithDevice(
          storageType,
          key,
          json,
          readDeviceJson,
        );
        writeThrough(storageType, key, merged);
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
 * Amplitude tooling state and the redirect stick-detector — see
 * {@link isConsentExemptStorageKey}.
 */
const isExempt = (key: string): boolean => isConsentExemptStorageKey(key);

/** Whether a key is subject to the gate at all. */
const isGated = (key: string): boolean => isConsentWithheld() && !isExempt(key);

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
  if (isGated(key)) {
    // Reads are gated too — ePrivacy covers access to data already on the
    // device — so a visitor without consent sees only this page's buffer,
    // never what an earlier consented session left behind.
    if (isConsentPending()) {
      armConsentListener();
    }
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
  if (isGated(key)) {
    // Pending is held in case consent arrives; refused is dropped outright, so a
    // client still running after a mid-session revocation stops persisting.
    if (isConsentPending()) {
      armConsentListener();
      pendingWrites.set(bufferKey(storageType, key), {
        storageType,
        key,
        json: jsonString,
      });
    }
    return;
  }
  writeThrough(storageType, key, jsonString);
};

const readDeviceJson = (
  storageType: StorageType,
  key: string,
): string | null => {
  try {
    return getStorage(storageType)?.getItem(key) ?? null;
  } catch {
    return null;
  }
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
  // Pending stops at the buffer (a delete is itself a device write); refusal
  // falls through to real storage, which is how denial cleanup erases data.
  if (isConsentPending() && !isExempt(key)) {
    armConsentListener();
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
