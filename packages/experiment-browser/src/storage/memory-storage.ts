import { Storage } from '../types/storage';

/**
 * In-memory {@link Storage} for the web experiment variant/flag caches
 * (`amp-exp-*`), injected by experiment-tag while cookie consent has not been
 * granted so the caches never touch sessionStorage pre-consent. The storage is
 * chosen once at client construction: after a mid-session grant the cache
 * stays in memory for the page lifetime and reverts to SessionStorage on the
 * next load — acceptable because it is a cache that repopulates on fetch.
 */
export class MemoryStorage implements Storage {
  private readonly store = new Map<string, string>();

  get(key: string): string {
    return this.store.get(key);
  }

  put(key: string, value: string): void {
    this.store.set(key, value);
  }

  delete(key: string): void {
    this.store.delete(key);
  }
}
