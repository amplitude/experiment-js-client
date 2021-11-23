type GlobalType = typeof globalThis | (NodeJS.Global & typeof globalThis);

export const safeGlobal =
  typeof globalThis !== 'undefined' ? globalThis : global || self;
