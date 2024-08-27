import { getGlobalScope } from '@amplitude/experiment-core';

import { Storage } from '../types/storage';
export class SessionStorage implements Storage {
  globalScope = getGlobalScope();
  get(key: string): string {
    return this.globalScope?.sessionStorage.getItem(key);
  }

  put(key: string, value: string): void {
    this.globalScope?.sessionStorage.setItem(key, value);
  }

  delete(key: string): void {
    this.globalScope?.sessionStorage.removeItem(key);
  }
}
