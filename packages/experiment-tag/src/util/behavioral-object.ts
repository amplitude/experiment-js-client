import { BehavioralObjects } from '../types';

/**
 * Clone a BehavioralObjects map
 */
export function cloneBehavioralObjects(
  map: BehavioralObjects,
): BehavioralObjects {
  const clone: BehavioralObjects = {};
  for (const outerKey in map) {
    clone[outerKey] = {};
    for (const innerKey in map[outerKey]) {
      clone[outerKey][innerKey] = { ...map[outerKey][innerKey] };
    }
  }
  return clone;
}

/**
 * Check if two BehavioralObjects maps are equal (by structure and behavior IDs)
 */
export function areBehavioralObjectsEqual(
  a: BehavioralObjects,
  b: BehavioralObjects,
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
      const aBehavior = aInner[innerKey];
      const bBehavior = bInner[innerKey];
      if (!bBehavior || aBehavior.id !== bBehavior.id) return false;
    }
  }

  return true;
}
