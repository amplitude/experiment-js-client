import { getGlobalScope } from '@amplitude/experiment-core';

import { Storage } from '../types/storage';
export class LocalStorage implements Storage {
  globalScope = getGlobalScope();
  get(key: string): string {
    return this.globalScope?.localStorage.getItem(key);
  }

  put(key: string, value: string): void {
    this.globalScope?.localStorage.setItem(key, value);
  }

  delete(key: string): void {
    this.globalScope?.localStorage.removeItem(key);
  }
}
