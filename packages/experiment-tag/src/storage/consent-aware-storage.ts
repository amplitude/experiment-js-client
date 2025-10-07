import { CampaignParser, CookieStorage, MKTG } from '@amplitude/analytics-core';
import type { Campaign } from '@amplitude/analytics-core';

import { ConsentStatus } from '../types';

import {
  getStorage,
  getStorageItem,
  removeStorageItem,
  setStorageItem,
  StorageType,
} from './storage';

/**
 * Consent-aware storage manager that handles persistence based on consent status
 */
export class ConsentAwareStorage {
  private inMemoryStorage: Map<StorageType, Map<string, unknown>> = new Map();
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
      // Persist JSON storage
      for (const [storageType, storageMap] of this.inMemoryStorage.entries()) {
        for (const [key, value] of storageMap.entries()) {
          try {
            const jsonString = JSON.stringify(value);
            getStorage(storageType)?.setItem(key, jsonString);
          } catch (error) {
            console.warn(`Failed to persist JSON data for key ${key}:`, error);
          }
        }
      }
      this.inMemoryStorage.clear();
      this.persistMarketingCookies().then();
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
    if (this.consentStatus === ConsentStatus.GRANTED) {
      setStorageItem(storageType, key, value);
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
    if (this.consentStatus === ConsentStatus.GRANTED) {
      removeStorageItem(storageType, key);
      return;
    }

    // Remove from JSON storage
    const jsonStorageMap = this.inMemoryStorage.get(storageType);
    if (jsonStorageMap) {
      jsonStorageMap.delete(key);
      if (jsonStorageMap.size === 0) {
        this.inMemoryStorage.delete(storageType);
      }
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
