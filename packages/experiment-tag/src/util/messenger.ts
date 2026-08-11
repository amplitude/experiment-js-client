import { getGlobalScope } from '@amplitude/experiment-core';

import { DebugRecorder } from './debug-recorder';
import {
  showLoadingIndicator,
  hideLoadingIndicator,
} from './loading-indicator';
import { isOpenerChannelBroken } from './opener-channel';
import { getStorageItem } from './storage';
import { VISUAL_EDITOR_SESSION_KEY } from './storage-keys';
import { whenBodyReady } from './when-body-ready';

interface VisualEditorSession {
  injectSrc: string;
  amplitudeWindowUrl: string;
}

export { VISUAL_EDITOR_SESSION_KEY };

export class WindowMessenger {
  static setup(nonce?: string) {
    let state: 'closed' | 'opening' | 'open' = 'closed';

    // Surface a diagnostic so `getDebugState().events` exposes the opener
    // state regardless of how setup() was reached (VE mode, preview mode).
    DebugRecorder.push(
      'opener_check',
      isOpenerChannelBroken()
        ? 'FAIL: window.opener is null, closed, or inaccessible'
        : 'PASS',
    );

    // Check for existing session on setup
    const existingSession = WindowMessenger.getStoredSession();
    if (existingSession) {
      DebugRecorder.push(
        'setup',
        `stored session found, loading ${existingSession.injectSrc}`,
      );
      DebugRecorder.setMessengerState('loading');
      state = 'opening';
      showLoadingIndicator();
      asyncLoadScript(existingSession.injectSrc, nonce)
        .then(() => {
          state = 'open';
          DebugRecorder.setMessengerState('loaded');
          DebugRecorder.push('script_load_success', 'from stored session');
        })
        .catch((error) => {
          console.warn('Failed to load overlay from stored session:', error);
          state = 'closed';
          DebugRecorder.setMessengerState('error');
          DebugRecorder.push(
            'script_load_error',
            `from stored session: ${String(error?.message || error)}`,
          );
          hideLoadingIndicator();
        });
      return;
    }

    DebugRecorder.push(
      'setup',
      'no stored session, registering message listener',
    );
    DebugRecorder.setMessengerState('waiting');

    getGlobalScope()?.addEventListener(
      'message',
      (
        e: MessageEvent<{
          type: string;
          context: {
            injectSrc: string;
            amplitudeWindowUrl: string;
          };
        }>,
      ) => {
        const match = /^.*\.amplitude\.com$/;
        try {
          if (!e.origin || !match.test(new URL(e.origin).hostname)) {
            DebugRecorder.push(
              'origin_validation',
              `FAIL: ${e.origin || '(empty)'}`,
            );
            return;
          }
        } catch {
          // The security check failed on exception, return without throwing.
          // new URL(e.origin) can throw.
          DebugRecorder.push(
            'origin_validation',
            `FAIL: exception parsing origin ${e.origin}`,
          );
          return;
        }
        if (e.data.type === 'OpenOverlay') {
          DebugRecorder.push(
            'message_received',
            `origin=${e.origin}, type=OpenOverlay`,
          );
          DebugRecorder.push('origin_validation', 'PASS');

          const injectSrc = new URL(e.data.context.injectSrc);
          if (state !== 'closed') {
            DebugRecorder.push('state_guard', `rejected: state=${state}`);
            return;
          }
          if (
            injectSrc.protocol !== 'https:' ||
            !match.test(injectSrc.hostname)
          ) {
            DebugRecorder.push(
              'injectSrc_validation',
              `FAIL: ${injectSrc.href}`,
            );
            return;
          }
          DebugRecorder.push(
            'injectSrc_validation',
            `PASS (${injectSrc.hostname})`,
          );

          DebugRecorder.setMessengerState('loading');
          state = 'opening';
          showLoadingIndicator();
          asyncLoadScript(e.data.context.injectSrc, nonce)
            .then(() => {
              state = 'open';
              DebugRecorder.setMessengerState('loaded');
              DebugRecorder.push('script_load_success');
            })
            .catch(() => {
              state = 'closed';
              DebugRecorder.setMessengerState('error');
              DebugRecorder.push(
                'script_load_error',
                `Failed to load ${e.data.context.injectSrc}`,
              );
              hideLoadingIndicator();
            });
        }
      },
    );
  }

  /**
   * Retrieve stored session data (read-only)
   */
  private static getStoredSession(): VisualEditorSession | null {
    const sessionData = getStorageItem<VisualEditorSession>(
      'sessionStorage',
      VISUAL_EDITOR_SESSION_KEY,
    );
    if (!sessionData) {
      return null;
    }

    // Validate injectSrc is still from amplitude.com
    const match = /^.*\.amplitude\.com$/;
    try {
      const injectSrc = new URL(sessionData.injectSrc);
      if (injectSrc.protocol !== 'https:' || !match.test(injectSrc.hostname)) {
        return null;
      }
    } catch {
      return null;
    }

    return sessionData;
  }
}

export const asyncLoadScript = (url: string, nonce?: string) => {
  return new Promise((resolve, reject) => {
    DebugRecorder.push('script_load_start', `loading ${url}`);

    const loadScript = () => {
      try {
        const scriptElement = document.createElement('script');
        const scriptNonce =
          nonce ??
          (getGlobalScope()?.document?.querySelector('[nonce]') as HTMLElement)
            ?.nonce;
        scriptElement.type = 'text/javascript';
        scriptElement.async = true;
        scriptElement.src = url;

        // Set the script nonce if it exists
        if (scriptNonce) {
          scriptElement.setAttribute('nonce', scriptNonce);
          DebugRecorder.push('nonce_check', `found: ${String(scriptNonce)}`);
        } else {
          DebugRecorder.push('nonce_check', 'not found, skipping');
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

    DebugRecorder.push('readyState', document.readyState);

    // The overlay's top-level setup calls document.body.appendChild and
    // throws when body is null.
    whenBodyReady(loadScript);
  });
};
