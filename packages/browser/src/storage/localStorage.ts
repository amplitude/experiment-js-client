/**
 * @packageDocumentation
 * @internal
 */

import { Storage } from '../types/storage';
import { Variant, Variants } from '../types/variant';

export class LocalStorage implements Storage {
  protected readonly namespace: string;
  protected map: Record<string, Variant> = {};

  constructor(namespace: string) {
    this.namespace = namespace;
  }

  put(key: string, value: Variant): Variant {
    const oldValue: Variant = this.get(key);
    this.map[key] = value;
    return oldValue;
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
