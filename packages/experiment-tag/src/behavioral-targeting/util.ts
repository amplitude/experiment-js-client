/**
 * Check if two Maps of behavioral flags are equal.
 * Compares flag keys and their associated behavior ID sets.
 * @param current Current map of flag keys to behavior ID sets
 * @param previous Previous map of flag keys to behavior ID sets
 * @returns true if the maps are equal, false if they're different
 */
export function areBehaviorsEqual(
  current: Map<string, Set<string>> | undefined,
  previous: Map<string, Set<string>>,
): boolean {
  // If one is undefined and the other isn't, they're different
  if (!current && previous.size > 0) return false;
  if (current && current.size !== previous.size) return false;
  if (!current) return true;

  // Check if all keys and their values match
  for (const [flagKey, behaviorIds] of current) {
    const previousBehaviorIds = previous.get(flagKey);
    if (!previousBehaviorIds) return false;

    // Compare sets of behavior IDs
    if (behaviorIds.size !== previousBehaviorIds.size) return false;
    for (const id of behaviorIds) {
      if (!previousBehaviorIds.has(id)) return false;
    }
  }

  return true;
}
