export interface InjectUtils {
  /**
   * Returns a promise that is resolved when an element matching the selector
   * is found in DOM.
   *
   * @param selector The element selector to query for.
   */
  waitForElement(selector: string): Promise<Element>;

  /**
   * Inserts an element into the DOM at the specified selectors.
   * Re-inserts element whenever it gets removed
   * Returns a promise that is resolved the first time the element is inserted.
   *
   * @param element The element to insert.
   * @param  options The insertion options.
   * @param options.parentSelector The parent selector to insert the element into.
   * @param options.insertBeforeSelector The sibling selector to insert the element before.
   * @param callback Optional callback to be called after every insertion.
   */
  insertElement(
    element: Element,
    options: {
      parentSelector: string;
      insertBeforeSelector: string | null;
    },
    callback?: () => void,
  ): Promise<void>;

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

export const getInjectUtils = (state: { cancelled: boolean }): InjectUtils =>
  ({
    async waitForElement(selector: string): Promise<Element> {
      let observer: MutationObserver | undefined = undefined;

      const findElement = () => {
        if (state.cancelled) {
          observer?.disconnect();
          return;
        }

        return document.querySelector(selector);
      };

      // If selector found in DOM, then return directly.
      const elem = findElement();
      if (elem) {
        return elem;
      }

      return new Promise<Element>((resolve) => {
        // An observer that is listening for all DOM mutation events.
        observer = new MutationObserver(() => {
          const elem = findElement();
          if (elem) {
            observer?.disconnect();
            resolve(elem);
          }
        });

        // Observe on all document changes.
        observer.observe(document.documentElement, {
          childList: true,
          subtree: true,
          attributes: true,
        });
      });
    },

    insertElement(
      element: Element,
      options: {
        parentSelector: string;
        insertBeforeSelector: string | null;
      },
      callback?: () => void,
    ): Promise<void> {
      return new Promise((resolve) => {
        let rateLimit = 0;
        let observer: MutationObserver | undefined = undefined;

        const checkElementInserted = () => {
          if (state.cancelled) {
            observer?.disconnect();
            return;
          }

          if (element.isConnected && element.ownerDocument === document) {
            return; // element was already inserted
          }

          if (rateLimit >= 10) {
            return;
          }
          rateLimit++;
          setTimeout(() => rateLimit--, 1000);

          const parent = document.querySelector(options.parentSelector);
          if (!parent) {
            return;
          }
          const sibling = options.insertBeforeSelector
            ? parent.querySelector(options.insertBeforeSelector)
            : null;

          if (options.insertBeforeSelector && !sibling) {
            // wait until matching sibling is found before inserting
            return;
          }

          parent.insertBefore(element, sibling);
          callback?.();
          resolve();
        };

        checkElementInserted();
        observer = new MutationObserver(checkElementInserted);

        // Observe on all document changes.
        observer.observe(document.documentElement, {
          childList: true,
          subtree: true,
          attributes: true,
        });
      });
    },
  } as InjectUtils);
