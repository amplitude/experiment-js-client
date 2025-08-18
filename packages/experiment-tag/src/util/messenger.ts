import { getGlobalScope } from '@amplitude/experiment-core';

import { getStorage } from './storage';

interface VisualEditorSession {
  injectSrc: string;
  amplitudeWindowUrl: string;
}

export const VISUAL_EDITOR_SESSION_KEY = 'visual-editor-state';

export class WindowMessenger {
  static setup() {
    let state: 'closed' | 'opening' | 'open' = 'closed';

    // Check for existing session on setup
    const existingSession = WindowMessenger.getStoredSession();
    if (existingSession) {
      state = 'opening';
      asyncLoadScript(existingSession.injectSrc)
        .then(() => {
          state = 'open';
        })
        .catch((error) => {
          console.warn('Failed to load overlay from stored session:', error);
          state = 'closed';
        });
      return;
    }

    getGlobalScope()?.addEventListener(
      'message',
      (
        e: MessageEvent<{
          type: string;
          context: { injectSrc: string; amplitudeWindowUrl: string };
        }>,
      ) => {
        const match = /^.*\.amplitude\.com$/;
        try {
          if (!e.origin || !match.test(new URL(e.origin).hostname)) {
            return;
          }
        } catch {
          // The security check failed on exception, return without throwing.
          // new URL(e.origin) can throw.
          return;
        }

        if (e.data.type === 'OpenOverlay') {
          if (
            state !== 'closed' ||
            !match.test(new URL(e.data.context.injectSrc).hostname)
          ) {
            return;
          }
          state = 'opening';
          asyncLoadScript(e.data.context.injectSrc)
            .then(() => {
              state = 'open';
            })
            .catch(() => {
              state = 'closed';
            });
        }
      },
    );
  }

  /**
   * Retrieve stored session data (read-only)
   */
  private static getStoredSession(): VisualEditorSession | null {
    const sessionData = getStorage<VisualEditorSession>(
      'sessionStorage',
      VISUAL_EDITOR_SESSION_KEY,
    );
    if (!sessionData) {
      return null;
    }

    // Validate injectSrc is still from amplitude.com
    const match = /^.*\.amplitude\.com$/;
    try {
      if (!match.test(new URL(sessionData.injectSrc).hostname)) {
        return null;
      }
    } catch {
      return null;
    }

    return sessionData;
  }
}

export const asyncLoadScript = (url: string) => {
  return new Promise((resolve, reject) => {
    const loadScript = () => {
      try {
        const scriptElement = document.createElement('script');
        scriptElement.type = 'text/javascript';
        scriptElement.async = true;
        scriptElement.src = url;

        // Set the script nonce if it exists
        const nonceElem = document.querySelector('[nonce]');
        if (nonceElem) {
          scriptElement.setAttribute(
            'nonce',
            nonceElem['nonce'] ||
              (nonceElem as any).nonce ||
              nonceElem.getAttribute('nonce'),
          );
        }

        scriptElement.addEventListener(
          'load',
          () => {
            resolve({ status: true });
          },
          { once: true },
        );

        scriptElement.addEventListener('error', () => {
          reject({
            status: false,
            message: `Failed to load the script ${url}`,
          });
        });

        document.head?.appendChild(scriptElement);
      } catch (error) {
        reject(error);
      }
    };

    // Only start loading the script after document is completely loaded
    if (document.readyState === 'complete') {
      loadScript();
    } else {
      window.addEventListener('load', loadScript, { once: true });
    }
  });
};
