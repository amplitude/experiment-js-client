import { UserInteractionType } from '../../types';

/**
 * Utilities for generating consistent state keys.
 * All key generation is centralized here to ensure consistency across the codebase.
 *
 * Keys use null character (\0) as delimiter to avoid collisions with user input.
 */
export class TriggerStateKeys {
  private static readonly DELIMITER = '\0';

  /**
   * Create visibility key: "selector\0ratio"
   * Used for element_visible triggers with IntersectionObserver
   */
  static visibility(selector: string, ratio: number): string {
    return `${selector}${this.DELIMITER}${ratio}`;
  }

  /**
   * Parse visibility key back to components
   */
  static parseVisibility(key: string): { selector: string; ratio: number } {
    const [selector, ratioStr] = key.split(this.DELIMITER);
    return { selector, ratio: parseFloat(ratioStr) };
  }

  /**
   * Create user interaction key: "selector\0type\0threshold"
   * Used for tracking click/hover/focus interactions
   */
  static userInteraction(
    selector: string,
    type: UserInteractionType,
    threshold: number,
  ): string {
    return `${selector}${this.DELIMITER}${type}${this.DELIMITER}${threshold}`;
  }

  /**
   * Create scrolled-to key: "selector\0offset"
   * Used for element-based scrolled_to triggers
   */
  static scrolledTo(selector: string, offset: number): string {
    return `${selector}${this.DELIMITER}${offset}`;
  }

  /**
   * Parse scrolled-to key back to components
   */
  static parseScrolledTo(key: string): { selector: string; offset: number } {
    const [selector, offsetStr] = key.split(this.DELIMITER);
    return { selector, offset: parseInt(offsetStr, 10) };
  }

  /**
   * Create timeout key for threshold-based interactions
   * Used internally for managing hover/focus timeouts
   */
  static timeout(selector: string, threshold: number): string {
    return `${selector}${this.DELIMITER}${threshold}`;
  }
}
