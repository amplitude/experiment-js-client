/**
 * Session keys declared here rather than beside their users so the consent gate
 * in `./storage` can name them without importing the modules that call it.
 */

/** Preview mode's flag overrides, carried across the URL-param cleanup. */
export const PREVIEW_MODE_SESSION_KEY = 'amp-preview-mode';

/** The visual editor's handshake state with the opener window. */
export const VISUAL_EDITOR_SESSION_KEY = 'visual-editor-state';

/**
 * Keys that stay readable and writable while consent is pending.
 *
 * Both hold Amplitude's own tooling state, entered deliberately by the person
 * building the experiment through a `PREVIEW`/`VISUAL_EDITOR` URL parameter —
 * they say nothing about the visitor and are not what a consent banner is
 * asking about. Gating them would leave an editor that silently fails to open
 * on any site that has consent gating switched on, since the state has to
 * survive the redirect that strips those parameters from the URL.
 */
export const CONSENT_EXEMPT_STORAGE_KEYS: ReadonlySet<string> = new Set([
  PREVIEW_MODE_SESSION_KEY,
  VISUAL_EDITOR_SESSION_KEY,
]);
