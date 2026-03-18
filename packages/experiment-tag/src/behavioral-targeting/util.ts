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
