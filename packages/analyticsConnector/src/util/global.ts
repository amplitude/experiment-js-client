export const safeGlobal = typeof globalThis !== 'undefined'
  ? globalThis
  : typeof global !== 'undefined'
    ? global
    : self;
