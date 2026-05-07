const BANNER_ID = 'amp-exp-opener-severed';
const AMPLITUDE_BRAND_COLOR = '#1e61f0';

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
        padding: 32px;
      }

      #${BANNER_ID} .title {
        font-size: 18px;
        font-weight: 600;
        margin: 0 0 12px 0;
      }

      #${BANNER_ID} .body {
        font-size: 14px;
        line-height: 1.5;
        margin: 0 0 12px 0;
        color: #5a5e68;
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
        margin-top: 20px;
      }

      #${BANNER_ID} button {
        font-size: 14px;
        padding: 8px 16px;
        border-radius: 6px;
        border: 1px solid transparent;
        cursor: pointer;
      }

      #${BANNER_ID} .primary {
        background: ${AMPLITUDE_BRAND_COLOR};
        color: white;
      }

      #${BANNER_ID} .primary:hover {
        filter: brightness(0.95);
      }

      #${BANNER_ID} .secondary {
        background: white;
        color: #212124;
        border-color: #d1d5db;
      }

      #${BANNER_ID} .secondary:hover {
        background: #f9fafb;
      }
    </style>

    <div class="modal">
      <h2 id="${BANNER_ID}-title" class="title">Visual Editor can't open on this page</h2>
      <p class="body">
        This page has been isolated from the window that opened it, so the
        visual editor can't communicate with Amplitude here.
      </p>
      <p class="body">
        This is most often caused by a <code>Cross-Origin-Opener-Policy</code>
        response header on this page. To use the visual editor, ask the site
        owner to remove the header (or set it to <code>unsafe-none</code>) on
        the pages you want to edit, or launch the editor on a staging build
        that doesn't ship the header.
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
    const closeButton = dialog.querySelector<HTMLButtonElement>(
      'button[data-action="close"]',
    );
    closeButton?.addEventListener('click', () => {
      hideOpenerSeveredBanner();
    });
  };

  if (document.body) {
    mount();
  } else {
    document.addEventListener('DOMContentLoaded', mount, { once: true });
  }
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
