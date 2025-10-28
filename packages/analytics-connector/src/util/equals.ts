// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isEqual = (value1: any, value2: any, seen = new WeakSet()) => {
  // 1. Strict equality check for primitives and same object references
  if (value1 === value2) {
    return true;
  }

  // 2. Handle null and undefined (already covered by === if both are null/undefined)
  // If one is null/undefined and the other is not, they are not equal.
  if (value1 == null || value2 == null) {
    return false;
  }

  // 3. Handle different types
  if (typeof value1 !== typeof value2) {
    return false;
  }

  // 4. Handle specific object types (Date, RegExp)
  if (value1 instanceof Date && value2 instanceof Date) {
    return value1.getTime() === value2.getTime();
  }
  if (value1 instanceof RegExp && value2 instanceof RegExp) {
    return value1.source === value2.source && value1.flags === value2.flags;
  }

  // 5. Handle objects and arrays (deep comparison)
  if (typeof value1 === 'object' && typeof value2 === 'object') {
    // Prevent infinite recursion with circular references
    if (seen.has(value1) && seen.has(value2)) {
      return true; // Already processed and found to be equal
    }
    seen.add(value1);
    seen.add(value2);

    // Compare arrays
    if (Array.isArray(value1) && Array.isArray(value2)) {
      if (value1.length !== value2.length) {
        return false;
      }
      for (let i = 0; i < value1.length; i++) {
        if (!isEqual(value1[i], value2[i], seen)) {
          return false;
        }
      }
      return true;
    }

    // Compare plain objects
    const keys1 = Object.keys(value1);
    const keys2 = Object.keys(value2);

    if (keys1.length !== keys2.length) {
      return false;
    }

    for (const key of keys1) {
      if (!keys2.includes(key) || !isEqual(value1[key], value2[key], seen)) {
        return false;
      }
    }
    return true;
  }

  // 6. Default case: values are not equal
  return false;
}