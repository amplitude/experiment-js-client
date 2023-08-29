export interface Storage {
  get(key: string): Promise<string>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}
