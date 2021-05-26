import { Variant, Flags } from './variant';

export interface Storage {
  put(key: string, value: Variant): Variant;
  get(key: string): Variant;
  clear(): void;
  getAll(): Flags;
  save();
  load();
}
