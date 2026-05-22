import { whenBodyReady } from './when-body-ready';

const BANNER_ID = 'amp-exp-opener-severed';

/**
 * Modal shown when `window.opener` is unreachable, so the visual editor
 * can't postMessage saves back to skylab. Vanilla DOM + inline CSS so this
 * module has no dependency on the overlay bundle (which can't load here).
 */
export const showOpenerSeveredBanner = () => {
  if (document.getElementById(BANNER_ID)) {
    return;
  }

  const dialog = document.createElement('dialog');
  dialog.id = BANNER_ID;
  dialog.setAttribute('role', 'alertdialog');
  dialog.setAttribute('aria-labelledby', `${BANNER_ID}-title`);

  dialog.innerHTML = `
    <style>
      @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;600&display=swap');

      #${BANNER_ID},
      #${BANNER_ID} * {
        font-family: 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      }
      #${BANNER_ID} code {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important;
      }

      /* Defensive resets — host pages often style h2/h3/p with
       * text-transform, letter-spacing, etc. that would otherwise leak in. */
      #${BANNER_ID} h2,
      #${BANNER_ID} h3,
      #${BANNER_ID} p,
      #${BANNER_ID} button,
      #${BANNER_ID} code,
      #${BANNER_ID} hr {
        text-transform: none !important;
        letter-spacing: normal !important;
        text-decoration: none !important;
        font-style: normal !important;
      }

      #${BANNER_ID} {
        border: none;
        padding: 0;
        background: white;
        border-radius: 8px;
        max-width: 480px;
        box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
        color: #212124;
      }

      #${BANNER_ID}::backdrop {
        background: rgba(33, 33, 36, 0.4);
      }

      #${BANNER_ID} .modal {
        position: relative;
        padding: 32px;
      }

      #${BANNER_ID} .close-icon {
        position: absolute;
        top: 16px;
        right: 16px;
        width: 28px;
        height: 28px;
        padding: 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: transparent;
        border: none;
        border-radius: 6px;
        color: #5a5e68;
        cursor: pointer;
      }

      #${BANNER_ID} .close-icon:hover {
        background: #f3f4f6;
        color: #212124;
      }

      #${BANNER_ID} .close-icon svg {
        width: 16px;
        height: 16px;
      }

      #${BANNER_ID} .title {
        font-size: 18px;
        font-weight: 600;
        margin: 0 0 12px 0;
        padding-right: 24px;
      }

      #${BANNER_ID} .body {
        font-size: 14px;
        line-height: 1.5;
        margin: 0 0 12px 0;
        color: #5a5e68;
      }

      #${BANNER_ID} .divider {
        border: none;
        border-top: 1px solid #e5e7eb;
        margin: 20px 0;
      }

      #${BANNER_ID} .subtitle {
        font-size: 14px;
        font-weight: 600;
        margin: 0 0 8px 0;
        color: #212124;
      }

      #${BANNER_ID} code {
        background: #f3f4f6;
        padding: 1px 6px;
        border-radius: 4px;
        font-size: 13px;
      }

      #${BANNER_ID} .actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        margin-top: 24px;
      }

      #${BANNER_ID} .secondary {
        font-size: 14px;
        padding: 8px 16px;
        border-radius: 6px;
        background: white;
        color: #212124;
        border: 1px solid #d1d5db;
        cursor: pointer;
      }

      #${BANNER_ID} .secondary:hover {
        background: #f9fafb;
      }
    </style>

    <div class="modal">
      <button
        type="button"
        class="close-icon"
        data-action="close"
        aria-label="Close"
      >
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
          <path d="M3 3 L13 13 M13 3 L3 13" />
        </svg>
      </button>
      <h2 id="${BANNER_ID}-title" class="title">Can't connect to this page</h2>
      <p class="body">
        The Visual Editor lost its connection to this page and can't make
        edits here. This is usually a configuration issue on the site.
      </p>
      <hr class="divider" />
      <h3 class="subtitle">Technical Details</h3>
      <p class="body">
        This page sends a <code>Cross-Origin-Opener-Policy</code> header that
        isolates it from the editor window. To resolve this:
      </p>
      <p class="body">
        Remove the <code>Cross-Origin-Opener-Policy</code> header, or set its
        value to <code>unsafe-none</code> on pages you want to edit.
      </p>
      <div class="actions">
        <button type="button" class="secondary" data-action="close">Close</button>
      </div>
    </div>
  `;

  const mount = () => {
    if (document.getElementById(BANNER_ID)) {
      return;
    }
    document.body.appendChild(dialog);

    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }

    // TODO: switch to `command="close"` + `commandfor` once `last 5 firefox`
    // is entirely Firefox 144+ (when invoker commands shipped).
    const closeButtons = dialog.querySelectorAll<HTMLButtonElement>(
      'button[data-action="close"]',
    );
    closeButtons.forEach((button) => {
      button.addEventListener('click', () => {
        hideOpenerSeveredBanner();
      });
    });
  };

  whenBodyReady(mount);
};

export const hideOpenerSeveredBanner = () => {
  const dialog = document.getElementById(BANNER_ID) as HTMLDialogElement | null;
  if (!dialog) {
    return;
  }
  if (typeof dialog.close === 'function' && dialog.open) {
    dialog.close();
  }
  dialog.remove();
};
