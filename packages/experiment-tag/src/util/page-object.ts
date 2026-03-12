import { PageObjects } from '../types';

/**
 * Clone a PageObjects map
 */
export function clonePageObjects(map: PageObjects): PageObjects {
  const clone: PageObjects = {};
  for (const outerKey in map) {
    clone[outerKey] = {};
    for (const innerKey in map[outerKey]) {
      clone[outerKey][innerKey] = { ...map[outerKey][innerKey] };
    }
  }
  return clone;
}

/**
 * Check if two PageObjects maps are equal (by structure and page IDs)
 */
export function arePageObjectsEqual(a: PageObjects, b: PageObjects): boolean {
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
      const aPage = aInner[innerKey];
      const bPage = bInner[innerKey];
      if (!bPage || aPage.id !== bPage.id) return false;
    }
  }

  return true;
}
