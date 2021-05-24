/**
 * @category Types
 */
export type Variant = {
  /**
   * The value of the variant determined by the flag configuration
   */
  value: string;

  /**
   * The attached payload, if any
   */
  payload?: any;
};

/**
 * @category Types
 */
export type Variants = {
  [flagKey: string]: Variant;
};
