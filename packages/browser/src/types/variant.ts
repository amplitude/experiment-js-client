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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any;
};

/**
 * @category Types
 */
export type Flags = {
  [flagKey: string]: Variant;
};
