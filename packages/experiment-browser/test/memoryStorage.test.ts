import { ExperimentClient } from '../src/experimentClient';
import { MemoryStorage } from '../src/storage/memory-storage';
import { Storage } from '../src/types/storage';

const API_KEY = 'client-DvWljIjiiuqLbyjqdvBaLFfEBrAvGuA3';

class SpyStorage implements Storage {
  gets: string[] = [];
  puts: Record<string, string> = {};
  get(key: string): string {
    this.gets.push(key);
    return undefined;
  }
  put(key: string, value: string): void {
    this.puts[key] = value;
  }
  delete(key: string): void {
    delete this.puts[key];
  }
}

describe('MemoryStorage', () => {
  test('get returns what was put, delete removes', () => {
    const storage = new MemoryStorage();
    expect(storage.get('k')).toBeUndefined();
    storage.put('k', 'v');
    expect(storage.get('k')).toEqual('v');
    storage.delete('k');
    expect(storage.get('k')).toBeUndefined();
  });

  test('instances are isolated', () => {
    const a = new MemoryStorage();
    const b = new MemoryStorage();
    a.put('k', 'v');
    expect(b.get('k')).toBeUndefined();
  });
});

describe('web experiment cache storage selection', () => {
  let sessionGetItem: jest.Mock;
  let localGetItem: jest.Mock;

  beforeEach(() => {
    // sessionStorage and localStorage share Storage.prototype, and jsdom
    // ignores instance-level getItem assignment/spyOn. Spy the prototype
    // once and route by `this` so the two remain distinguishable.
    sessionGetItem = jest.fn();
    localGetItem = jest.fn();
    const proto = Object.getPrototypeOf(window.sessionStorage);
    const originalGetItem: (
      this: globalThis.Storage,
      key: string,
    ) => string | null = proto.getItem;
    jest
      .spyOn(proto, 'getItem')
      .mockImplementation(function (this: globalThis.Storage, key: string) {
        if (this === window.sessionStorage) {
          sessionGetItem(key);
        } else if (this === window.localStorage) {
          localGetItem(key);
        }
        return originalGetItem.call(this, key);
      });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('injected internalCacheStorage is used for the amp-exp-* caches', () => {
    const injected = new SpyStorage();
    new ExperimentClient(API_KEY, {
      internalInstanceNameSuffix: 'web',
      internalCacheStorage: injected,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    // The constructor loads the variant/flag/options caches from the
    // injected storage instead of sessionStorage.
    expect(injected.gets.length).toBeGreaterThan(0);
    expect(injected.gets.every((key) => key.startsWith('amp-exp-'))).toBe(true);
    expect(sessionGetItem).not.toHaveBeenCalled();
    expect(localGetItem).not.toHaveBeenCalled();
  });

  test('falls back to SessionStorage when nothing is injected', () => {
    new ExperimentClient(API_KEY, {
      internalInstanceNameSuffix: 'web',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    expect(sessionGetItem).toHaveBeenCalled();
    expect(
      sessionGetItem.mock.calls.every(([key]) => key.startsWith('amp-exp-')),
    ).toBe(true);
    expect(localGetItem).not.toHaveBeenCalled();
  });

  test('non-web clients keep LocalStorage even when a storage is injected', () => {
    const injected = new SpyStorage();
    new ExperimentClient(API_KEY, {
      internalCacheStorage: injected,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    expect(injected.gets).toEqual([]);
    expect(localGetItem).toHaveBeenCalled();
    expect(sessionGetItem).not.toHaveBeenCalled();
  });
});
