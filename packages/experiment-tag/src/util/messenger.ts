import { getGlobalScope } from '@amplitude/experiment-core';
import { Variant } from '@amplitude/experiment-js-client';

import { DefaultWebExperimentClient } from '../experiment';
import { PageObject } from '../types';

export class WindowMessenger {
  static setup(webExperimentClient: DefaultWebExperimentClient) {
    let state: 'closed' | 'opening' | 'open' = 'closed';
    getGlobalScope()?.addEventListener(
      'message',
      (
        e: MessageEvent<{
          type: string;
          context: {
            flagKey: string;
            pageViewObject: PageObject;
            variantKey: string;
            variants: Variant[];
            injectSrc: string;
          };
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
        } else if (e.data.type === 'ForceVariant') {
          const variants = e.data.context.variants.reduce((acc, variant) => {
            if (variant.key) {
              acc[variant.key] = variant;
            }
            return acc;
          }, {} as Record<string, Variant>);
          const flagKey = e.data.context.flagKey;
          const pageViewObject = e.data.context.pageViewObject;
          const variantKey = e.data.context.variantKey;
          webExperimentClient.previewNewFlagAndVariant(
            flagKey,
            pageViewObject,
            variants,
            variantKey,
          );
          e.source?.postMessage(
            { type: 'DoneForceVariant' },
            { targetOrigin: e.origin },
          );
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
      // Set the script nonce if it exists
      // This is useful for CSP (Content Security Policy) to allow the script to be loaded
      const nonceElem = document.querySelector('[nonce]');
      if (nonceElem) {
        scriptElement.setAttribute(
          'nonce',
          nonceElem['nonce'] ||
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  });
};
