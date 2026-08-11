import { whenBodyReady } from './when-body-ready';

/**
 * Alert shown when `window.opener` is unreachable, so the visual editor
 * can't postMessage saves back to skylab.
 */
export const showOpenerSeveredBanner = () => {
  whenBodyReady(() =>
    alert(`*Can't connect to this page*
The Visual Editor lost its connection to this page and can't make edits here. This is usually a configuration issue on the site.
---

*Technical Details*
This page sends a Cross-Origin-Opener-Policy header that isolates it from the editor window. To resolve this:

Remove the Cross-Origin-Opener-Policy header, or set its value to unsafe-none on pages you want to edit.`),
  );
};
