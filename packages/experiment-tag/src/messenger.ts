export class WindowMessenger {
  static setup() {
    let state: 'closed' | 'opening' | 'open' = 'closed';
    window.addEventListener(
      'message',
      (
        e: MessageEvent<{
          type: string;
          context: { injectSrc: string };
        }>,
      ) => {
        const match =
          process.env.NODE_ENV === 'development'
            ? /^([\w\d]*\.)?amplitude\.com(:3000)?/
            : /^.*\.amplitude\.com/;
        if (!match.test(new URL(e.origin).hostname)) {
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
