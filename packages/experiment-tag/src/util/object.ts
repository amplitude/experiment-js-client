/**
 * Generic utilities for nested object operations
 */

/**
 * Deep clone a nested map structure by shallow cloning inner objects.
 * Structure: { [outerKey]: { [innerKey]: T } }
 */
export function deepCloneObject<T>(
  map: { [outerKey: string]: { [innerKey: string]: T } },
): { [outerKey: string]: { [innerKey: string]: T } } {
  const clone: { [outerKey: string]: { [innerKey: string]: T } } = {};
  for (const outerKey in map) {
    clone[outerKey] = {};
    for (const innerKey in map[outerKey]) {
      clone[outerKey][innerKey] = { ...map[outerKey][innerKey] };
    }
  }
  return clone;
}

/**
 * Check if two nested maps are equal by comparing their structure.
 * Structure: { [outerKey]: { [innerKey]: T } }
 *
 * This function compares only the keys (structure), not the object values themselves,
 * since the innerKey is expected to be the object's identifier (id property).
 */
export function areNestedObjectsEqual<T>(
  a: { [outerKey: string]: { [innerKey: string]: T } },
  b: { [outerKey: string]: { [innerKey: string]: T } },
): boolean {
  const aOuterKeys = Object.keys(a);
  const bOuterKeys = Object.keys(b);
  if (aOuterKeys.length !== bOuterKeys.length) return false;

  for (const outerKey of aOuterKeys) {
    const aInner = a[outerKey];
    const bInner = b[outerKey];
    if (!bInner) return false;

    const aInnerKeys = Object.keys(aInner);
    const bInnerKeys = Object.keys(bInner);
    if (aInnerKeys.length !== bInnerKeys.length) return false;

    for (const innerKey of aInnerKeys) {
      if (!bInner[innerKey]) return false;
    }
  }

  return true;
}
