/**
 * Shared utilities for working with MutationObserver.
 */

/**
 * Check if a mutation is relevant to a specific CSS selector.
 * Returns true if the mutation affects elements matching the selector.
 *
 * @param mutationList - List of mutations to check
 * @param selector - CSS selector to match against
 * @returns true if any mutation is relevant to the selector
 */
export function isMutationRelevantToSelector(
  mutationList: MutationRecord[],
  selector: string,
): boolean {
  for (const mutation of mutationList) {
    // Check if any added nodes match the selector
    if (mutation.addedNodes.length > 0) {
      for (const node of Array.from(mutation.addedNodes)) {
        if (node instanceof Element) {
          try {
            // Check if the added node itself matches
            if (node.matches(selector)) {
              return true;
            }
            // Check if any descendant matches
            if (node.querySelector(selector)) {
              return true;
            }
          } catch (e) {
            // Invalid selector, skip
          }
        }
      }
    }

    // Check if mutation target or its descendants match
    if (mutation.target instanceof Element) {
      try {
        // Check if target matches
        if (mutation.target.matches(selector)) {
          return true;
        }
        // Check if target contains matching elements
        if (mutation.target.querySelector(selector)) {
          return true;
        }
      } catch (e) {
        // Invalid selector, skip
      }
    }
  }

  return false;
}
