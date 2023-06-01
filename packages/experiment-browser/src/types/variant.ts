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

  /**
   * The experiment key. Used to distinguish two experiments associated with the same flag.
   */
  expKey?: string;
};

/**
 * @category Types
 */
export type Variants = {
  [key: string]: Variant;
};
