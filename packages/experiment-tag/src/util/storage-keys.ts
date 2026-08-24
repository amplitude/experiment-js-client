/**
 * Storage keys declared here rather than beside their users so the consent
 * modules can name them without importing the modules that call them.
 */

/**
 * Root-domain cookie holding the cross-subdomain `web_exp_id_v2`. Written by
 * identity resolution in `experiment.ts`; the denial sweep and erasure guard in
 * `consent/clear-data.ts` delete and probe it.
 */
export const identityCookieKey = (apiKey: string): string =>
  `EXP_${apiKey.slice(0, 10)}_identity`;

/** Preview mode's flag overrides, carried across the URL-param cleanup. */
export const PREVIEW_MODE_SESSION_KEY = 'amp-preview-mode';

/** The visual editor's handshake state with the opener window. */
export const VISUAL_EDITOR_SESSION_KEY = 'visual-editor-state';

/**
 * Keys that stay readable and writable while consent is pending. Both hold
 * Amplitude's own tooling state (entered via a `PREVIEW`/`VISUAL_EDITOR` URL
 * parameter), say nothing about the visitor, and must survive the redirect
 * that strips those parameters — gating them would break preview mode and the
 * visual editor on consent-gated sites.
 */
export const CONSENT_EXEMPT_STORAGE_KEYS: ReadonlySet<string> = new Set([
  PREVIEW_MODE_SESSION_KEY,
  VISUAL_EDITOR_SESSION_KEY,
]);
