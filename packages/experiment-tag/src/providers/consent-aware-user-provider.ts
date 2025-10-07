import {
  DefaultUserProvider,
  ExperimentUserProvider,
} from '@amplitude/experiment-js-client';

import { ConsentAwareStorage } from '../storage/consent-aware-storage';

import { Storage } from './types';

/**
 * Factory function that creates a DefaultUserProvider with consent-aware storage implementations.
 * This allows the DefaultUserProvider to respect consent status when storing/retrieving user data.
 *
 * @param consentAwareStorage - The ConsentAwareStorage instance to use for all storage operations
 * @param userProvider - Optional nested user provider for additional user context
 * @param apiKey - Optional API key for storage key generation
 * @returns A DefaultUserProvider configured with consent-aware storage
 */
export function createConsentAwareUserProvider(
  consentAwareStorage: ConsentAwareStorage,
  userProvider?: ExperimentUserProvider,
  apiKey?: string,
): DefaultUserProvider {
  return new DefaultUserProvider(
    userProvider,
    apiKey,
    new ConsentAwareLocalStorage(consentAwareStorage),
    new ConsentAwareSessionStorage(consentAwareStorage),
  );
}

class ConsentAwareLocalStorage implements Storage {
  constructor(private consentAwareStorage: ConsentAwareStorage) {}

  get(key: string): string {
    return this.consentAwareStorage.getItem<string>('localStorage', key) || '';
  }

  put(key: string, value: string): void {
    this.consentAwareStorage.setItem('localStorage', key, value);
  }

  delete(key: string): void {
    this.consentAwareStorage.removeItem('localStorage', key);
  }
}

/**
 * Adapter that implements the experiment-browser Storage interface
 * using ConsentAwareStorage for sessionStorage operations
 */
class ConsentAwareSessionStorage implements Storage {
  constructor(private consentAwareStorage: ConsentAwareStorage) {}

  get(key: string): string {
    return (
      this.consentAwareStorage.getItem<string>('sessionStorage', key) || ''
    );
  }

  put(key: string, value: string): void {
    this.consentAwareStorage.setItem('sessionStorage', key, value);
  }

  delete(key: string): void {
    this.consentAwareStorage.removeItem('sessionStorage', key);
  }
}
