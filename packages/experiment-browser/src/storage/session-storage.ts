import { Storage } from '../types/storage';
export class SessionStorage implements Storage {
  get(key: string): string {
    return sessionStorage.getItem(key);
  }

  put(key: string, value: string): void {
    sessionStorage.setItem(key, value);
  }

  delete(key: string): void {
    sessionStorage.removeItem(key);
  }
}
