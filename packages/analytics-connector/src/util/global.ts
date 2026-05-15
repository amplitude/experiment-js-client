const getGlobalScope = (): typeof globalThis | undefined => {
  if (typeof globalThis !== 'undefined' && globalThis !== null)
    return globalThis;
  if (typeof window !== 'undefined' && window !== null) return window;
  if (typeof global !== 'undefined' && global !== null) return global;
  if (typeof self !== 'undefined' && self !== null) return self;
  return undefined;
};

export const safeGlobal = getGlobalScope();
