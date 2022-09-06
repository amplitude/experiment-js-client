// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isEqual = (obj1: any, obj2: any): boolean => {
  const primitive = ['string', 'number', 'boolean', 'undefined'];
  const typeA = typeof obj1;
  const typeB = typeof obj2;
  if (typeA !== typeB) {
    return false;
  }
  for (const p of primitive) {
    if (p === typeA) {
      return obj1 === obj2;
    }
  }
  // check null
  if (obj1 == null && obj2 == null) {
    return true;
  } else if (obj1 == null || obj2 == null) {
    return false;
  }
  // if got here - objects
  if (obj1.length !== obj2.length) {
    return false;
  }
  //check if arrays
  const isArrayA = Array.isArray(obj1);
  const isArrayB = Array.isArray(obj2);
  if (isArrayA !== isArrayB) {
    return false;
  }
  if (isArrayA && isArrayB) {
    //arrays
    for (let i = 0; i < obj1.length; i++) {
      if (!isEqual(obj1[i], obj2[i])) {
        return false;
      }
    }
  } else {
    //objects
    const sorted1 = Object.keys(obj1).sort();
    const sorted2 = Object.keys(obj2).sort();
    if (!isEqual(sorted1, sorted2)) {
      return false;
    }
    //compare object values
    let result = true;
    Object.keys(obj1).forEach((key) => {
      if (!isEqual(obj1[key], obj2[key])) {
        result = false;
      }
    });
    return result;
  }
  return true;
};
