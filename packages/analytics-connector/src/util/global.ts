const getGlobalScope = (): typeof globalThis | undefined => {
  if (typeof globalThis !== 'undefined' && globalThis !== null)
    return globalThis;
  if (typeof window !== 'undefined' && window !== null) return window;
  if (typeof global !== 'undefined' && global !== null) return global;
  return self;
};

export const safeGlobal = getGlobalScope();
