import { getGlobalScope } from '@amplitude/experiment-core';

export const isElementOnPage = (selector: string): boolean => {
  const element = getGlobalScope()?.document.getElementById(selector);
  return element !== undefined && element !== null;
};
