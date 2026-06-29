import { getGlobalScope } from '@amplitude/experiment-core';

export const safeGlobal = getGlobalScope() ?? ({} as typeof globalThis);
