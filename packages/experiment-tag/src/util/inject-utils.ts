export interface InjectUtils {
  /**
   * Returns a promise that is resolved when an element matching the selector
   * is found in DOM.
   *
   * @param selector The element selector to query for.
   */
  waitForElement(selector: string): Promise<Element>;

  /**
   * Function which can be set inside injected javascript code. This function is
   * called on page change, when experiments are re-evaluated.
   *
   * Useful for cleaning up changes to the page that have been made in single
   * page apps, where page the page is not fully reloaded. For example, if you
   * inject an HTML element on a specific page, you can set this function to
   * remove the injected element on page change.
   */
  remove: (() => void) | undefined;
}

export const getInjectUtils = (
  state: { cancelled?: boolean } = {},
): InjectUtils =>
  ({
    async waitForElement(selector: string): Promise<Element> {
      return new Promise((resolve) => {
        setTimeout(() => {
          if (state.cancelled) {
            return;
          }
          // If selector found in DOM, then return directly.
          const elem = document.querySelector(selector);
          if (elem) {
            resolve(elem);
            return;
          }

          // An observer that is listening for all DOM mutation events.
          const observer = new MutationObserver(() => {
            if (state.cancelled) {
              observer.disconnect();
              return;
            }
            const elem = document.querySelector(selector);
            if (elem) {
              observer.disconnect();
              resolve(elem);
            }
          });

          // Observe on all document changes.
          observer.observe(document.documentElement, {
            childList: true,
            subtree: true,
            attributes: true,
          });
        }, 0);
      });
    },
  } as InjectUtils);
