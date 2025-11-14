export interface InjectUtils {
  /**
   * Returns a promise that is resolved when an element matching the selector
   * is found in DOM.
   *
   * @param selector The element selector to query for.
   */
  waitForElement(selector: string): Promise<Element>;

  /**
   * Call function whenever the selector is missing from DOM
   *
   * @param selector The element selector to query for.
   * @param callback The function to call when no element matches the selector
   */
  onElementMissing(selector: string, callback: () => void): void;

  /**
   * Inserts an element into the DOM at the specified selectors.
   * Re-inserts element whenever it gets removed
   *
   * @param element The element to insert.
   * @param parentSelector The parent selector to insert the element into.
   * @param insertBeforeSelector The sibling selector to insert the element before.
   */
  insertElement(
    element: Element,
    {
      parentSelector,
      insertBeforeSelector,
    }: { parentSelector: string; insertBeforeSelector: string | null },
  ): void;

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
      options: { parentSelector: string; insertBeforeSelector: string | null },
    ): void {
      let rateLimit = 0;
      let observer: MutationObserver | undefined = undefined;
      const checkMissing = () => {
        if (state.cancelled) {
          observer?.disconnect();
          return;
        }

        if (rateLimit >= 10) {
          return;
        }
        rateLimit++;
        setTimeout(() => rateLimit--, 1000);

        if (!element.isConnected || element.ownerDocument !== document) {
          const parent = document.querySelector(options.parentSelector);
          if (!parent) {
            return;
          }
          if (options.insertBeforeSelector) {
            const sibling = parent.querySelector(options.insertBeforeSelector);
            if (sibling) {
              parent.insertBefore(element, sibling);
            }
          } else {
            parent.appendChild(element);
          }
        }
      };

      checkMissing();
      observer = new MutationObserver(checkMissing);

      // Observe on all document changes.
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
    },

    onElementMissing(selector: string, callback: () => void): void {
      let rateLimit = 0;
      let observer: MutationObserver | undefined = undefined;
      const checkMissing = () => {
        if (state.cancelled) {
          observer?.disconnect();
          return;
        }

        if (rateLimit >= 10) {
          return;
        }
        rateLimit++;
        setTimeout(() => rateLimit--, 1000);

        const elem = document.querySelector(selector);
        if (!elem) {
          callback();
        }
      };

      checkMissing();
      observer = new MutationObserver(checkMissing);

      // Observe on all document changes.
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
    },
  } as InjectUtils);
