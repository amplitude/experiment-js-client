export class WindowMessenger {
  static setup() {
    let state: 'closed' | 'opening' | 'open' = 'closed';
    window.addEventListener('message', (e: MessageEvent<{
      type: string,
      context: { injectSrc: string }
    }>) => {
      // We need to validate that the message & the script inject src is being
      // sent by a trusted source. Without, attackers could inject arbitrary
      // scripts hosted by untrusted sources.
      const match = /^https:\/\/.*\.amplitude\.com\//;
      if (!match.test(e.origin)) {
        return;
      }
      if (e.data.type === 'OpenOverlay') {
        if (state !== 'closed' || !match.test(e.data.context.injectSrc)) {
          return;
        }
        state = 'opening'
        asyncLoadScript(e.data.context.injectSrc).then(() => {
          state = 'open'
        }).catch(() => {
          state = 'closed'
        });
      }
    })
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
