/**
 * Determines the primary source of variants before falling back.
 *
 * @category Source
 */
export enum Source {
  /**
   * The default way to source variants within your application. Before the
   * assignments are fetched, `getVariant(s)` will fallback to local storage
   * first, then `initialVariants` if local storage is empty. This option
   * effectively falls back to an assignment fetched previously.
   */
  LocalStorage = 'localStorage',

  /**
   * This bootstrap option is used primarily for servers-side rendering using an
   * Experiment server SDK. This bootstrap option always prefers the config
   * `initialVariants` over data in local storage, even if variants are fetched
   * successfully and stored locally.
   */
  InitialVariants = 'initialVariants',
}

/**
 * Indicates from which source the variant() function determines the variant
 *
 * @category Source
 */
export enum VariantSource {
  LocalStorage = 'storage',
  InitialVariants = 'initial',
  SecondaryLocalStorage = 'secondary-storage',
  SecondaryInitialVariants = 'secondary-initial',
  FallbackInline = 'fallback-inline',
  FallbackConfig = 'fallback-config',
}

/**
 * Returns true if the VariantSource is one of the fallbacks (inline or config)
 *
 * @param source a {@link VariantSource}
 * @returns true if source is {@link VariantSource.FallbackInline} or {@link VariantSource.FallbackConfig}
 */
export const isFallback = (source: VariantSource): boolean => {
  return (
    source === VariantSource.FallbackInline ||
    source === VariantSource.FallbackConfig ||
    source === VariantSource.SecondaryInitialVariants
  );
};
