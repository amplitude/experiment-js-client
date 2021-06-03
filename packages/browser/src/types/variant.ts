/**
 * @category Types
 */
export type Variant = {
  /**
   * The value of the variant.
   */
  value?: string;

  /**
   * The attached payload, if any.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any;
};

/**
 * @category Types
 */
export type Variants = {
  [key: string]: Variant;
};
