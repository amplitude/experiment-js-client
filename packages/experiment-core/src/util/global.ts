export const getGlobalScope = (): typeof globalThis | undefined => {
  if (typeof globalThis !== 'undefined' && globalThis !== null)
    return globalThis;
  if (typeof window !== 'undefined' && window !== null) return window;
  if (typeof global !== 'undefined' && global !== null) return global;
  return self;
};

export const safeGlobal = getGlobalScope();

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
