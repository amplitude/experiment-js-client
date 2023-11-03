export interface Storage {
  get(key: string): string;
  put(key: string, value: string): void;
  delete(key: string): void;
}
