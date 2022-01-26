export const safeGlobal =
  typeof globalThis !== 'undefined' ? globalThis : global || self;
