import { CampaignParser, CookieStorage, MKTG } from '@amplitude/analytics-core';
import type { Campaign } from '@amplitude/analytics-core';

import { ConsentStatus } from '../types';

import {
  getAndParseStorageItem,
  getRawStorageItem,
  removeStorageItem,
  setAndStringifyStorageItem,
  setRawStorageItem,
  StorageType,
} from './storage';

/**
 * Consent-aware storage manager that handles persistence based on consent status
 */
export class ConsentAwareStorage {
  private inMemoryStorage: Map<StorageType, Map<string, unknown>> = new Map();
  private inMemoryRawStorage: Map<StorageType, Map<string, string>> = new Map();
  private inMemoryMarketingCookies: Map<string, Campaign> = new Map();
  private consentStatus: ConsentStatus;

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
          setAndStringifyStorageItem(storageType, key, value);
        }
      }
      for (const [
        storageType,
        storageMap,
      ] of this.inMemoryRawStorage.entries()) {
        for (const [key, value] of storageMap.entries()) {
          setRawStorageItem(storageType, key, value);
        }
      }
      this.inMemoryStorage.clear();
      this.inMemoryRawStorage.clear();
      this.persistMarketingCookies().catch();
    }
  }

  public loadPersistedDataToMemory(
    jsonKeys?: string[],
    rawKeys?: string[],
  ): void {
    for (const key of jsonKeys || []) {
      const localStorageValue = getAndParseStorageItem('localStorage', key);
      if (localStorageValue !== null) {
        if (!this.inMemoryStorage.has('localStorage')) {
          this.inMemoryStorage.set('localStorage', new Map());
        }
        this.inMemoryStorage.get('localStorage')?.set(key, localStorageValue);
      }

      const sessionStorageValue = getAndParseStorageItem('sessionStorage', key);
      if (sessionStorageValue !== null) {
        if (!this.inMemoryStorage.has('sessionStorage')) {
          this.inMemoryStorage.set('sessionStorage', new Map());
        }
        this.inMemoryStorage
          .get('sessionStorage')
          ?.set(key, sessionStorageValue);
      }
    }

    // Load raw string data into inMemoryRawStorage
    for (const key of rawKeys || []) {
      // Load from localStorage
      const localStorageValue = getRawStorageItem('localStorage', key);
      if (localStorageValue) {
        if (!this.inMemoryRawStorage.has('localStorage')) {
          this.inMemoryRawStorage.set('localStorage', new Map());
        }
        this.inMemoryRawStorage
          .get('localStorage')
          ?.set(key, localStorageValue);
      }

      // Load from sessionStorage
      const sessionStorageValue = getRawStorageItem('sessionStorage', key);
      if (sessionStorageValue) {
        if (!this.inMemoryRawStorage.has('sessionStorage')) {
          this.inMemoryRawStorage.set('sessionStorage', new Map());
        }
        this.inMemoryRawStorage
          .get('sessionStorage')
          ?.set(key, sessionStorageValue);
      }
    }
  }

  /**
   * Persist marketing cookies from memory to actual cookies
   */
  private async persistMarketingCookies(): Promise<void> {
    for (const [
      storageKey,
      campaign,
    ] of this.inMemoryMarketingCookies.entries()) {
      try {
        const cookieStorage = new CookieStorage<Campaign>({
          sameSite: 'Lax',
        });
        await cookieStorage.set(storageKey, campaign);
      } catch (error) {
        console.warn(
          `Failed to persist marketing cookie for key ${storageKey}:`,
          error,
        );
      }
    }
    this.inMemoryMarketingCookies.clear();
  }

  /**
   * Get a JSON value from storage with consent awareness
   */
  public getItem<T>(storageType: StorageType, key: string): T | null {
    if (this.consentStatus === ConsentStatus.GRANTED) {
      const value = getAndParseStorageItem(storageType, key);
      return value as T;
    }

    const storageMap = this.inMemoryStorage.get(storageType);
    if (storageMap?.has(key)) {
      return storageMap.get(key) as T;
    }

    return null;
  }

  /**
   * Set a JSON value in storage with consent awareness
   */
  public setItem(storageType: StorageType, key: string, value: unknown): void {
    if (this.consentStatus === ConsentStatus.GRANTED) {
      setAndStringifyStorageItem(storageType, key, value);
    } else {
      if (!this.inMemoryStorage.has(storageType)) {
        this.inMemoryStorage.set(storageType, new Map());
      }
      this.inMemoryStorage.get(storageType)?.set(key, value);
    }
  }

  /**
   * Remove a value from storage with consent awareness
   */
  public removeItem(storageType: StorageType, key: string): void {
    const storageMap = this.inMemoryStorage.get(storageType);
    if (this.consentStatus === ConsentStatus.GRANTED) {
      removeStorageItem(storageType, key);
      return;
    }
    if (storageMap) {
      storageMap.delete(key);
      if (storageMap.size === 0) {
        this.inMemoryStorage.delete(storageType);
      }
    }
  }

  /**
   * Get a raw string value from storage with consent awareness
   * This is used by Storage interface implementations that expect raw strings
   */
  public getRawItem(storageType: StorageType, key: string): string {
    if (this.consentStatus === ConsentStatus.GRANTED) {
      return getRawStorageItem(storageType, key);
    }

    const storageMap = this.inMemoryRawStorage.get(storageType);
    if (storageMap && storageMap.has(key)) {
      return storageMap.get(key) || '';
    }

    return '';
  }

  /**
   * Set a raw string value in storage with consent awareness
   * This is used by Storage interface implementations that work with raw strings
   */
  public setRawItem(
    storageType: StorageType,
    key: string,
    value: string,
  ): void {
    if (this.consentStatus === ConsentStatus.GRANTED) {
      setRawStorageItem(storageType, key, value);
    } else {
      if (!this.inMemoryRawStorage.has(storageType)) {
        this.inMemoryRawStorage.set(storageType, new Map());
      }
      this.inMemoryRawStorage.get(storageType)?.set(key, value);
    }
  }

  /**
   * Set marketing cookie with consent awareness
   * Parses current campaign data from URL and referrer, then stores it in the marketing cookie
   */
  public async setMarketingCookie(apiKey: string): Promise<void> {
    try {
      const parser = new CampaignParser();
      const storageKey = `AMP_${MKTG}_ORIGINAL_${apiKey.substring(0, 10)}`;
      const campaign = await parser.parse();

      if (this.consentStatus === ConsentStatus.GRANTED) {
        const cookieStorage = new CookieStorage<Campaign>({
          sameSite: 'Lax',
        });
        await cookieStorage.set(storageKey, campaign);
      } else {
        this.inMemoryMarketingCookies.set(storageKey, campaign);
      }
    } catch (error) {
      console.warn('Failed to set marketing cookie:', error);
    }
  }
}

export class ConsentAwareLocalStorage {
  constructor(private consentAwareStorage: ConsentAwareStorage) {}

  get(key: string): string {
    return this.consentAwareStorage.getRawItem('localStorage', key);
  }

  put(key: string, value: string): void {
    this.consentAwareStorage.setRawItem('localStorage', key, value);
  }

  delete(key: string): void {
    this.consentAwareStorage.removeItem('localStorage', key);
  }
}

export class ConsentAwareSessionStorage {
  constructor(private consentAwareStorage: ConsentAwareStorage) {}

  get(key: string): string {
    return this.consentAwareStorage.getRawItem('sessionStorage', key);
  }

  put(key: string, value: string): void {
    this.consentAwareStorage.setRawItem('sessionStorage', key, value);
  }

  delete(key: string): void {
    this.consentAwareStorage.removeItem('sessionStorage', key);
  }
}
