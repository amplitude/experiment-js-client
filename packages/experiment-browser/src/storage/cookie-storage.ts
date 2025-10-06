import { getGlobalScope } from '@amplitude/experiment-core';

import { Storage } from '../types/storage';
export class CookieStorage implements Storage {
  globalScope = getGlobalScope();
  get(key: string): string {
    return this.globalScope?.cookieStorage.getItem(key);
  }

  put(key: string, value: string): void {
    this.globalScope?.cookieStorage.setItem(key, value);
  }

  delete(key: string): void {
    this.globalScope?.cookieStorage.removeItem(key);
  }
}
