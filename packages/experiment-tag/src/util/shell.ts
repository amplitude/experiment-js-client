const MOBILE_MODE_SESSION_KEY = 'amp-visual-editor-mobile-mode';
const DEVICE_IFRAME_ID = 'amp-device-iframe';
const DEVICE_CONTAINER_ID = 'amp-overlay-device-iframe-container';
const OVERLAY_HOST_ID = 'overlay-shadow-host';

const DEFAULT_MOBILE_WIDTH = 375;
const DEFAULT_MOBILE_HEIGHT = 667;

export function isMobileModeActive(): boolean {
  try {
    return sessionStorage.getItem(MOBILE_MODE_SESSION_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Replaces the page DOM with a shell container that loads the customer site
 * in a same-origin iframe. Deferred until the document is fully parsed so
 * the HTML parser doesn't add elements after the body is cleared.
 */
export function buildShell(globalScope: typeof globalThis): void {
  const run = () => {
    const doc = globalScope.document;

    // Inject a CSS rule that hides any direct children of <body> except the
    // device-iframe container and the overlay host. This prevents third-party
    // scripts from rendering visible elements in the shell.
    const shellGuard = doc.createElement('style');
    shellGuard.setAttribute('data-amp-shell-guard', '');
    shellGuard.textContent =
      `body > *:not(#${DEVICE_CONTAINER_ID}):not(#${OVERLAY_HOST_ID}) ` +
      `{ display: none !important; }`;
    doc.head.appendChild(shellGuard);

    while (doc.body.firstChild) {
      doc.body.removeChild(doc.body.firstChild);
    }

    doc.body.style.cssText = `
      margin: 0;
      padding: 0;
      overflow: auto;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: #fff;
      background-image: url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAABZSURBVHgB7dG7DYBADANQJxexAiXSTXw9uyExBih34SOxQhr83Li2ASIiIiIiIpo7QbLW1tms1zijq9puSDaGLxhhuBPaqyKZTFK+/r6AZOJlg8shqv5ccAGZWRnaKiSy9QAAAABJRU5ErkJggg==");
    `;

    const container = doc.createElement('div');
    container.id = DEVICE_CONTAINER_ID;
    container.style.cssText = `
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    const iframe = doc.createElement('iframe');
    iframe.id = DEVICE_IFRAME_ID;
    iframe.src = globalScope.location.href;
    iframe.style.cssText = `
      width: ${DEFAULT_MOBILE_WIDTH}px;
      height: ${DEFAULT_MOBILE_HEIGHT}px;
      border: 1px solid #dedfe2;
      border-radius: 20px;
      box-shadow: 0px 1px 4px rgba(0, 0, 0, 0.1);
      background: #fff;
    `;

    container.appendChild(iframe);
    doc.body.appendChild(container);
  };

  if (globalScope.document.readyState === 'complete') {
    run();
  } else {
    globalScope.addEventListener('load', run, { once: true });
  }
}
