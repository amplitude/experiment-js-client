/**
 * Lightweight floating dismissable modal for experiment preview mode
 */

import {
  cspSafeStyleSheet,
  type StyleSheetHandle,
} from '../util/csp-safe-stylesheet';
import { whenBodyReady } from '../util/when-body-ready';

let modalStylesHandle: StyleSheetHandle | undefined;

interface PreviewModeModalOptions {
  flags: Record<string, string>;
  onDismiss?: () => void;
}

export class PreviewModeModal {
  private modal: HTMLDivElement | null = null;
  private options: PreviewModeModalOptions;

  constructor(options: PreviewModeModalOptions) {
    this.options = options;
  }

  show(): void {
    if (document.getElementById('amp-preview-modal')) {
      return;
    }
    this.createModal();
    this.attachEventListeners();
  }

  hide(): void {
    if (this.modal) {
      this.modal.remove();
      this.modal = null;
    }

    this.options.onDismiss?.();
  }

  private createModal(): void {
    if (!document.body) {
      return;
    }

    this.modal = document.createElement('div');
    this.modal.id = 'amp-preview-modal';
    this.modal.className = 'amp-pv';

    const container = document.createElement('div');
    container.className = 'amp-pv-c';

    Object.entries(this.options.flags).forEach(([flagKey, variant]) => {
      const flagRow = document.createElement('div');
      flagRow.className = 'amp-pv-r';

      const titleElement = document.createElement('span');
      titleElement.className = 'amp-pv-t';
      titleElement.textContent = flagKey;

      const previewBadge = document.createElement('div');
      previewBadge.className = 'amp-pv-b amp-pv-pb';
      previewBadge.innerHTML = 'Preview Mode';

      const variantBadge = document.createElement('span');
      variantBadge.className = 'amp-pv-b';

      const greenDot = document.createElement('span');
      greenDot.className = 'amp-pv-d';

      variantBadge.appendChild(greenDot);
      variantBadge.appendChild(document.createTextNode(variant));

      flagRow.appendChild(titleElement);
      flagRow.appendChild(previewBadge);
      flagRow.appendChild(variantBadge);

      container.appendChild(flagRow);
    });

    const closeButton = document.createElement('button');
    closeButton.className = 'amp-pv-x';
    closeButton.setAttribute('aria-label', 'Dismiss preview mode notification');
    closeButton.innerHTML = '×';

    this.modal.appendChild(container);
    this.modal.appendChild(closeButton);

    this.injectStyles();
    requestAnimationFrame(() => {
      if (this.modal && document.body) {
        document.body.appendChild(this.modal);
      }
    });
  }

  private attachEventListeners(): void {
    this.modal
      ?.querySelector('.amp-pv-x')
      ?.addEventListener('click', () => this.hide());
  }

  private injectStyles(): void {
    if (modalStylesHandle) {
      return;
    }

    const css =
      // preview modal
      `.amp-pv{position:fixed;top:20px;right:20px;z-index:10000;background:#2d3748;border:1px solid #4a5568;border-radius:8px;box-shadow:0 4px 24px rgba(0,0,0,.12);font-family:system-ui,sans-serif;font-size:14px;line-height:1.4;color:#f7fafc;animation:amp-pv-in .3s ease-out;display:flex;gap:8px;padding:12px;max-width:600px}` +
      `@keyframes amp-pv-in{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}` +
      // preview modal container
      `.amp-pv-c{flex:1;display:flex;flex-direction:column;gap:8px}` +
      // preview modal row
      `.amp-pv-r{display:flex;align-items:center;gap:8px}` +
      // preview modal title
      `.amp-pv-t{font-weight:600;max-width:300px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}` +
      // preview modal badge
      `.amp-pv-b{padding:4px 8px;border-radius:12px;font-size:12px;font-weight:500;display:flex;align-items:center;gap:6px;border:1px solid #4a5568}` +
      // preview modal preview badge
      `.amp-pv-pb{color:#a0aec0}` +
      // preview modal variant dot
      `.amp-pv-d{width:8px;height:8px;border-radius:50%;background:#68d391;flex-shrink:0}` +
      // preview modal close button
      `.amp-pv-x{background:0 0;border:0;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;border-radius:6px;color:#718096;font-size:18px;line-height:1;width:24px;height:24px}` +
      // preview modal close button hover
      `.amp-pv-x:hover{background:#4a5568;color:#e2e8f0}`;

    modalStylesHandle = cspSafeStyleSheet(document, css);
  }
}

/**
 * Convenience function to create and show a preview mode modal
 */
export function showPreviewModeModal(
  options: PreviewModeModalOptions,
): PreviewModeModal {
  const modal = new PreviewModeModal(options);

  let bodyReady = false;
  let timeoutReady = false;

  const tryShow = () => {
    if (bodyReady && timeoutReady) {
      modal.show();
    }
  };

  whenBodyReady(() => {
    bodyReady = true;
    tryShow();
  });

  setTimeout(() => {
    timeoutReady = true;
    tryShow();
  }, 500);

  return modal;
}
