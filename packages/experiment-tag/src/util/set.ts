/**
 * Set comparison utilities
 */

/**
 * Compute symmetric difference of two sets.
 * Returns elements that are in either set but not in both.
 */
export function symmetricDifference<T>(a: Set<T>, b: Set<T>): Set<T> {
  const result = new Set<T>();
  for (const item of a) {
    if (!b.has(item)) result.add(item);
  }
  for (const item of b) {
    if (!a.has(item)) result.add(item);
  }
  return result;
}
