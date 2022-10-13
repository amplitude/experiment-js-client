import { Variant, Variants } from './variant';

export interface Storage {
  put(key: string, value: Variant): void;
  get(key: string): Variant;
  clear(): void;
  getAll(): Variants;
  save(): void;
  load(): void;
}
