/**
 * @packageDocumentation
 * @internal
 */

import { Storage } from '../types/storage';
import { Variant, Variants } from '../types/variant';

const localStorageInstances = {};

export const getLocalStorageInstance = (apiKey: string): Storage => {
  const shortApiKey = apiKey.substring(apiKey.length - 6);
  const storageKey = `amp-sl-${shortApiKey}`;
  if (!localStorageInstances[storageKey]) {
    localStorageInstances[storageKey] = new LocalStorage(storageKey);
  }
  return localStorageInstances[storageKey];
};

export class LocalStorage implements Storage {
  protected readonly namespace: string;
  protected map: Record<string, Variant> = {};

  constructor(namespace: string) {
    this.namespace = namespace;
  }

  put(key: string, value: Variant): void {
    this.map[key] = value;
  }

  get(key: string): Variant {
    let value = this.map[key];
    if (value === undefined) {
      value = null;
    }
    return value;
  }

  clear(): void {
    this.map = {};
  }

  getAll(): Variants {
    return this.map;
  }

  load(): void {
    try {
      const map = JSON.parse(localStorage.getItem(this.namespace)) || {};
      const newMap = {};
      for (const [key, value] of Object.entries(map)) {
        if (typeof value === 'string') {
          // old format
          newMap[key] = { value: value };
        } else if (typeof value === 'object') {
          // new format
          newMap[key] = {
            value: value['value'],
            payload: value['payload'],
          };
        }
      }
      this.map = newMap;
    } catch (e) {
      this.map = {};
    }
  }
  save(): void {
    try {
      localStorage.setItem(this.namespace, JSON.stringify(this.map));
    } catch (e) {
      // pass
    }
  }
}
