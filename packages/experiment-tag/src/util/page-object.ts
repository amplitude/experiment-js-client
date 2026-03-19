import { MessageType } from '../subscriptions/message-bus';
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
 * Deep clone PageObjects by shallow cloning inner objects.
 */
export function clonePageObjects(pageObjects: PageObjects): PageObjects {
  const clone: PageObjects = {};
  for (const flagKey in pageObjects) {
    clone[flagKey] = {};
    for (const pageId in pageObjects[flagKey]) {
      clone[flagKey][pageId] = { ...pageObjects[flagKey][pageId] };
    }
  }
  return clone;
}

/**
 * Check if two PageObjects are equal by comparing their structure.
 * Compares only the keys (structure), not the object values themselves.
 */
export function arePageObjectsEqual(
  a: PageObjects,
  b: PageObjects,
): boolean {
  const aFlagKeys = Object.keys(a);
  const bFlagKeys = Object.keys(b);
  if (aFlagKeys.length !== bFlagKeys.length) return false;

  for (const flagKey of aFlagKeys) {
    const aPages = a[flagKey];
    const bPages = b[flagKey];
    if (!bPages) return false;

    const aPageIds = Object.keys(aPages);
    const bPageIds = Object.keys(bPages);
    if (aPageIds.length !== bPageIds.length) return false;

    for (const pageId of aPageIds) {
      if (!bPages[pageId]) return false;
    }
  }

  return true;
}
