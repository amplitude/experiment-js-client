import { safeGlobal } from '@amplitude/experiment-core';

import { Storage } from '../types/storage';
export class LocalStorage implements Storage {
  async get(key: string): Promise<string> {
    return safeGlobal.localStorage.getItem(key);
  }

  async put(key: string, value: string): Promise<void> {
    safeGlobal.localStorage.setItem(key, value);
    return;
  }

  async delete(key: string): Promise<void> {
    safeGlobal.localStorage.removeItem(key);
    return;
  }
}
