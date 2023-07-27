import { Storage } from '../types/storage';
export class LocalStorage implements Storage {
  async get(key: string): Promise<string> {
    return localStorage.getItem(key);
  }

  async put(key: string, value: string): Promise<void> {
    localStorage.setItem(key, value);
  }

  async delete(key: string): Promise<void> {
    localStorage.removeItem(key);
  }
}
