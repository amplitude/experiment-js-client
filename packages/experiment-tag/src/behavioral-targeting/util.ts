import { BehavioralTargeting } from './types';

/**
 * Extracts all unique event names from behavioral targeting rules.
 * @param rules Map of flag keys to behavioral targeting rule arrays
 * @returns Set of event names referenced in the rules
 */
export function extractEventNames(rules: {
  [flagKey: string]: BehavioralTargeting;
}): Set<string> {
  const eventNames = new Set<string>();

  for (const flagKey in rules) {
    const behavioralTargeting = rules[flagKey];

    // Iterate through OR groups (outer array)
    for (const orGroup of behavioralTargeting) {
      // Iterate through AND conditions (inner array)
      for (const conditionSet of orGroup) {
        const condition = conditionSet.condition;
        // Extract the event name from type_value
        if (condition.type === 'event' && condition.type_value) {
          eventNames.add(condition.type_value);
        }
      }
    }
  }

  return eventNames;
}

/**
 * Creates a map of event names to flag keys for behavioral targeting rules.
 * @param rules Map of flag keys to behavioral targeting rule arrays
 * @returns Map of event names to sets of flag keys
 */
export function getEventToFlagMap(rules: {
  [flagKey: string]: BehavioralTargeting;
}): Map<string, Set<string>> {
  const eventToFlagMap = new Map<string, Set<string>>();

  for (const flagKey in rules) {
    const behavioralTargeting = rules[flagKey];
    const eventNames = extractEventNames({ [flagKey]: behavioralTargeting });

    for (const eventName of eventNames) {
      if (!eventToFlagMap.has(eventName)) {
        eventToFlagMap.set(eventName, new Set());
      }
      eventToFlagMap.get(eventName)?.add(flagKey);
    }
  }

  return eventToFlagMap;
}
