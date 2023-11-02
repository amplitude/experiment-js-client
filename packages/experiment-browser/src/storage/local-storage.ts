import { Storage } from '../types/storage';
export class LocalStorage implements Storage {
  get(key: string): string {
    return localStorage.getItem(key);
  }

  put(key: string, value: string): void {
    localStorage.setItem(key, value);
  }

  delete(key: string): void {
    localStorage.removeItem(key);
  }
}
