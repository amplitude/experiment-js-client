export const safeGlobal =
  typeof globalThis !== 'undefined' ? globalThis : global || self;

export const getGlobalScope = (): typeof globalThis | undefined => {
  if (typeof globalThis !== 'undefined') {
    return globalThis;
  }
  if (typeof window !== 'undefined') {
    return window;
  }
  if (typeof self !== 'undefined') {
    return self;
  }
  if (typeof global !== 'undefined') {
    return global;
  }
  return undefined;
};

export const isLocalStorageAvailable = (): boolean => {
  const globalScope = getGlobalScope();
  if (globalScope) {
    try {
      const testKey = 'EXP_test';
      globalScope.localStorage.setItem(testKey, testKey);
      globalScope.localStorage.removeItem(testKey);
      return true;
    } catch (e) {
      return false;
    }
  }
  return false;
};
