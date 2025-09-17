import { getGlobalScope } from '@amplitude/experiment-core';

export const applyAntiFlickerCss = () => {
  const globalScope = getGlobalScope();
  if (!globalScope?.document.getElementById('amp-exp-css')) {
    const id = 'amp-exp-css';
    const s = document.createElement('style');
    s.id = id;
    s.innerText =
      '* { visibility: hidden !important; background-image: none !important; }';
    document.head.appendChild(s);
    globalScope?.window.setTimeout(function () {
      s.remove();
    }, 1000);
  }
};
