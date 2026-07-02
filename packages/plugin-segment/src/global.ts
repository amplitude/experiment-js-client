import { getGlobalScope, type GlobalScope } from '@amplitude/experiment-core';

export const safeGlobal = getGlobalScope() ?? ({} as GlobalScope);
