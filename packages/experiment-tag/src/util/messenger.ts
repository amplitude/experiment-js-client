import { getGlobalScope } from '@amplitude/experiment-core';

export class WindowMessenger {
  static setup() {
    let state: 'closed' | 'opening' | 'open' = 'closed';
    getGlobalScope()?.addEventListener(
      'message',
      (
        e: MessageEvent<{
          type: string;
          context: { injectSrc: string };
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
}

export const asyncLoadScript = (url: string) => {
  return new Promise((resolve, reject) => {
    try {
      const scriptElement = document.createElement('script');
      scriptElement.type = 'text/javascript';
      scriptElement.async = true;
      scriptElement.src = url;
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
  });
};
