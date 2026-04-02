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
        if (node.nodeType === Node.ELEMENT_NODE) {
          try {
            const el = node as Element;
            // Check if the added node itself matches
            if (el.matches(selector)) {
              return true;
            }
            // Check if any descendant matches
            if (el.querySelector(selector)) {
              return true;
            }
          } catch (e) {
            // Invalid selector, skip
          }
        }
      }
    }

    // Check if mutation target or its descendants match
    if (mutation.target.nodeType === Node.ELEMENT_NODE) {
      try {
        const target = mutation.target as Element;
        // Check if target matches
        if (target.matches(selector)) {
          return true;
        }
        // Check if target contains matching elements
        if (target.querySelector(selector)) {
          return true;
        }
      } catch (e) {
        // Invalid selector, skip
      }
    }
  }

  return false;
}
