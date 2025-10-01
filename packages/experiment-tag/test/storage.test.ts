import * as coreUtil from '@amplitude/experiment-core';

import { ConsentAwareStorage } from '../src/storage/storage';
import { ConsentStatus } from '../src/types';

// Mock the getGlobalScope function
const spyGetGlobalScope = jest.spyOn(coreUtil, 'getGlobalScope');

describe('ConsentAwareStorage', () => {
  let mockGlobal: any;
  let storage: ConsentAwareStorage;

  const createStorageMock = () => {
    let store: Record<string, string> = {};
    return {
      getItem: jest.fn((key: string) => store[key] || null),
      setItem: jest.fn((key: string, value: string) => {
        store[key] = value;
      }),
      removeItem: jest.fn((key: string) => {
        delete store[key];
      }),
      clear: jest.fn(() => {
        store = {};
      }),
      length: jest.fn(() => Object.keys(store).length),
      key: jest.fn((index: number) => Object.keys(store)[index] || null),
    };
  };

  beforeEach(() => {
    mockGlobal = {
      localStorage: createStorageMock(),
      sessionStorage: createStorageMock(),
    };
    spyGetGlobalScope.mockReturnValue(mockGlobal);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('setItem with PENDING consent', () => {
    beforeEach(() => {
      storage = new ConsentAwareStorage(ConsentStatus.PENDING);
    });

    it('should store data in memory for localStorage', () => {
      const testData = { key: 'value', number: 42 };
      storage.setItem('localStorage', 'testKey', testData);

      expect(mockGlobal.localStorage.setItem).not.toHaveBeenCalled();

      const retrieved = storage.getItem('localStorage', 'testKey');
      expect(retrieved).toEqual(testData);
    });

    it('should store data in memory for sessionStorage', () => {
      const testData = { key: 'value', array: [1, 2, 3] };
      storage.setItem('sessionStorage', 'testKey', testData);

      expect(mockGlobal.sessionStorage.setItem).not.toHaveBeenCalled();

      const retrieved = storage.getItem('sessionStorage', 'testKey');
      expect(retrieved).toEqual(testData);
    });

    it('should handle multiple keys in the same storage type', () => {
      storage.setItem('localStorage', 'key1', 'value1');
      storage.setItem('localStorage', 'key2', 'value2');

      expect(storage.getItem('localStorage', 'key1')).toBe('value1');
      expect(storage.getItem('localStorage', 'key2')).toBe('value2');
    });

    it('should handle multiple storage types independently', () => {
      storage.setItem('localStorage', 'key', 'localValue');
      storage.setItem('sessionStorage', 'key', 'sessionValue');

      expect(storage.getItem('localStorage', 'key')).toBe('localValue');
      expect(storage.getItem('sessionStorage', 'key')).toBe('sessionValue');
    });
  });

  describe('setItem with GRANTED consent', () => {
    beforeEach(() => {
      storage = new ConsentAwareStorage(ConsentStatus.GRANTED);
    });

    it('should store data directly in localStorage', () => {
      const testData = { key: 'value' };
      storage.setItem('localStorage', 'testKey', testData);

      const retrieved = storage.getItem('localStorage', 'testKey');
      expect(retrieved).toEqual(testData);
    });

    it('should store data directly in sessionStorage', () => {
      const testData = { key: 'value' };
      storage.setItem('sessionStorage', 'testKey', testData);

      const retrieved = storage.getItem('sessionStorage', 'testKey');
      expect(retrieved).toEqual(testData);
    });
  });

  describe('setItem with REJECTED consent', () => {
    beforeEach(() => {
      storage = new ConsentAwareStorage(ConsentStatus.REJECTED);
    });

    it('should not store data anywhere', () => {
      storage.setItem('localStorage', 'testKey', { key: 'value' });

      expect(mockGlobal.localStorage.setItem).not.toHaveBeenCalled();
      expect(storage.getItem('localStorage', 'testKey')).toBeNull();
    });

    it('should not store data in sessionStorage', () => {
      storage.setItem('sessionStorage', 'testKey', { key: 'value' });

      expect(mockGlobal.sessionStorage.setItem).not.toHaveBeenCalled();
      expect(storage.getItem('sessionStorage', 'testKey')).toBeNull();
    });
  });

  describe('getItem with PENDING consent', () => {
    beforeEach(() => {
      storage = new ConsentAwareStorage(ConsentStatus.PENDING);
    });

    it('should return data from memory if available', () => {
      const testData = { key: 'value' };
      storage.setItem('localStorage', 'testKey', testData);

      const retrieved = storage.getItem('localStorage', 'testKey');
      expect(retrieved).toEqual(testData);
      expect(mockGlobal.localStorage.getItem).not.toHaveBeenCalled();
    });

    it('should return null if not in memory and consent is pending', () => {
      const retrieved = storage.getItem('localStorage', 'nonExistentKey');
      expect(retrieved).toBeNull();
      expect(mockGlobal.localStorage.getItem).not.toHaveBeenCalled();
    });
  });

  describe('getItem with GRANTED consent', () => {
    beforeEach(() => {
      storage = new ConsentAwareStorage(ConsentStatus.GRANTED);
    });

    it('should return data from actual storage, not memory', () => {
      const testData = { key: 'value' };

      storage.setItem('localStorage', 'testKey', testData);

      const retrieved = storage.getItem('localStorage', 'testKey');
      expect(retrieved).toEqual(testData);
    });

    it('should return null for non-existent keys', () => {
      const retrieved = storage.getItem('localStorage', 'nonExistentKey');
      expect(retrieved).toBeNull();
    });
  });

  describe('getItem with REJECTED consent', () => {
    beforeEach(() => {
      storage = new ConsentAwareStorage(ConsentStatus.REJECTED);
    });

    it('should return null and not access actual storage', () => {
      const retrieved = storage.getItem('localStorage', 'testKey');
      expect(retrieved).toBeNull();
      expect(mockGlobal.localStorage.getItem).not.toHaveBeenCalled();
    });
  });

  describe('removeItem with PENDING consent', () => {
    beforeEach(() => {
      storage = new ConsentAwareStorage(ConsentStatus.PENDING);
    });

    it('should remove data from memory', () => {
      storage.setItem('localStorage', 'testKey', { key: 'value' });
      expect(storage.getItem('localStorage', 'testKey')).not.toBeNull();

      storage.removeItem('localStorage', 'testKey');
      expect(storage.getItem('localStorage', 'testKey')).toBeNull();
      expect(mockGlobal.localStorage.removeItem).not.toHaveBeenCalled();
    });

    it('should handle removing non-existent keys gracefully', () => {
      storage.removeItem('localStorage', 'nonExistentKey');
      expect(mockGlobal.localStorage.removeItem).not.toHaveBeenCalled();
    });

    it('should clean up empty storage maps', () => {
      storage.setItem('localStorage', 'testKey', { key: 'value' });
      storage.removeItem('localStorage', 'testKey');

      storage.setItem('sessionStorage', 'otherKey', { other: 'value' });
      expect(storage.getItem('sessionStorage', 'otherKey')).not.toBeNull();
    });
  });

  describe('removeItem with GRANTED consent', () => {
    beforeEach(() => {
      storage = new ConsentAwareStorage(ConsentStatus.GRANTED);
    });

    it('should remove data from actual storage', () => {
      storage.setItem('localStorage', 'testKey', { key: 'value' });
      storage.removeItem('localStorage', 'testKey');

      expect(storage.getItem('localStorage', 'testKey')).toBeNull();
    });

    it('should handle removing non-existent keys gracefully', () => {
      storage.removeItem('localStorage', 'testKey');
      expect(storage.getItem('localStorage', 'testKey')).toBeNull();
    });
  });

  describe('removeItem with REJECTED consent', () => {
    beforeEach(() => {
      storage = new ConsentAwareStorage(ConsentStatus.REJECTED);
    });

    it('should not remove from actual storage', () => {
      storage.removeItem('localStorage', 'testKey');
      expect(mockGlobal.localStorage.removeItem).not.toHaveBeenCalled();
    });
  });

  describe('setConsentStatus', () => {
    it('should persist in-memory data when changing from PENDING to GRANTED', () => {
      storage = new ConsentAwareStorage(ConsentStatus.PENDING);

      // Store data in memory
      const localData = { local: 'value' };
      const sessionData = { session: 'value' };
      storage.setItem('localStorage', 'localKey', localData);
      storage.setItem('sessionStorage', 'sessionKey', sessionData);

      // Change consent to granted
      storage.setConsentStatus(ConsentStatus.GRANTED);

      // Verify data is now accessible from actual storage (not memory)
      expect(storage.getItem('localStorage', 'localKey')).toEqual(localData);
      expect(storage.getItem('sessionStorage', 'sessionKey')).toEqual(
        sessionData,
      );
    });

    it('should handle persistence errors gracefully', () => {
      storage = new ConsentAwareStorage(ConsentStatus.PENDING);
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Store data that will cause JSON.stringify to fail
      const circularData: any = {};
      circularData.self = circularData;
      storage.setItem('localStorage', 'circularKey', circularData);

      storage.setConsentStatus(ConsentStatus.GRANTED);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to persist data for key circularKey:',
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });

    it('should not persist data when changing from PENDING to REJECTED', () => {
      storage = new ConsentAwareStorage(ConsentStatus.PENDING);

      storage.setItem('localStorage', 'testKey', { key: 'value' });
      storage.setConsentStatus(ConsentStatus.REJECTED);

      expect(mockGlobal.localStorage.setItem).not.toHaveBeenCalled();
    });
  });
});
