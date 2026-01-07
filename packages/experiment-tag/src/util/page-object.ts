import { MessageType } from '../message-bus';
import {
  ElementAppearedTriggerValue,
  ElementVisibleTriggerValue,
  PageObject,
  PageObjects,
  ScrolledToTriggerValue,
} from '../types';

/**
 * Utility to get all page objects that match the specified trigger types
 */
export function getPageObjectsByTriggerType(
  pageObjects: PageObjects,
  triggerTypes: MessageType[],
): PageObject[] {
  const pages: PageObject[] = [];

  for (const pagesByExperiment of Object.values(pageObjects)) {
    for (const page of Object.values(pagesByExperiment)) {
      if (triggerTypes.includes(page.trigger_type)) {
        pages.push(page);
      }
    }
  }

  return pages;
}

/**
 * Get all unique element selectors from page objects with element-based triggers
 * (element_appeared, element_visible, scrolled_to with element mode)
 */
export function getElementSelectors(pageObjects: PageObjects): Set<string> {
  const selectors = new Set<string>();

  for (const pages of Object.values(pageObjects)) {
    for (const page of Object.values(pages)) {
      if (
        page.trigger_type === 'element_appeared' ||
        page.trigger_type === 'element_visible'
      ) {
        const triggerValue = page.trigger_value as
          | ElementAppearedTriggerValue
          | ElementVisibleTriggerValue;
        const selector = triggerValue.selector;
        if (selector) {
          selectors.add(selector);
        }
      } else if (page.trigger_type === 'scrolled_to') {
        const triggerValue = page.trigger_value as ScrolledToTriggerValue;
        if (triggerValue.mode === 'element' && triggerValue.selector) {
          selectors.add(triggerValue.selector);
        }
      }
    }
  }

  return selectors;
}

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
