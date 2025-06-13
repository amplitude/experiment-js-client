import { Client } from '../../src';
import { Storage } from '../../src/types/storage';

export const mockClientStorage = (client: Client) => {
  const storage = new MockStorage();
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  client.variants.storage = storage;
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  client.flags.storage = storage;

  // Clear the in-memory caches to ensure test isolation
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  client.variants.clear();
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  client.flags.clear();
};

class MockStorage implements Storage {
  private store: Record<string, string>;

  constructor() {
    this.store = {};
  }

  delete(key: string): void {
    delete this.store[key];
  }

  get(key: string): string {
    return this.store[key];
  }

  put(key: string, value: string): void {
    this.store[key] = value;
  }
}
