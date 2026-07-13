/* eslint-disable no-restricted-globals -- standalone global shim; cannot depend on experiment-core */
export const safeGlobal =
  typeof globalThis !== 'undefined'
    ? globalThis
    : typeof global !== 'undefined'
    ? global
    : self;
