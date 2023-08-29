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
  async delete(key: string): Promise<void> {
    delete this.store[key];
  }

  async get(key: string): Promise<string> {
    return this.store[key];
  }

  async put(key: string, value: string): Promise<void> {
    this.store[key] = value;
  }
}
