export const getGlobalScope = (): typeof globalThis | undefined => {
  if (typeof globalThis !== 'undefined' && globalThis !== null) {
    return globalThis;
  }
  if (typeof window !== 'undefined' && window !== null) {
    return window;
  }
  if (typeof self !== 'undefined' && self !== null) {
    return self;
  }
  if (typeof global !== 'undefined' && global !== null) {
    return global;
  }
  return undefined;
};

export const safeGlobal: typeof globalThis | undefined = getGlobalScope();

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

export const getLocalStorage = (): Storage | undefined => {
  return getGlobalScope()?.localStorage;
};

export const getSessionStorage = (): Storage | undefined => {
  return getGlobalScope()?.sessionStorage;
};

export const getDocument = (): Document | undefined => {
  return getGlobalScope()?.document;
};

export const getFetch = (): typeof fetch | undefined => {
  const scope = getGlobalScope();
  return scope?.fetch ? scope.fetch.bind(scope) : undefined;
};

export const getSetTimeout = (): typeof setTimeout | undefined => {
  const scope = getGlobalScope();
  return scope?.setTimeout ? scope.setTimeout.bind(scope) : undefined;
};

export const getClearTimeout = (): typeof clearTimeout | undefined => {
  const scope = getGlobalScope();
  return scope?.clearTimeout ? scope.clearTimeout.bind(scope) : undefined;
};

export const getSetInterval = (): typeof setInterval | undefined => {
  const scope = getGlobalScope();
  return scope?.setInterval ? scope.setInterval.bind(scope) : undefined;
};

export const getClearInterval = (): typeof clearInterval | undefined => {
  const scope = getGlobalScope();
  return scope?.clearInterval ? scope.clearInterval.bind(scope) : undefined;
};
