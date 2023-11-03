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
};

class MockStorage implements Storage {
  private store = {};
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
