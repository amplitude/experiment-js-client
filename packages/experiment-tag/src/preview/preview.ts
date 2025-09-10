/**
 * Lightweight floating dismissable modal for experiment preview mode
 */
import { Variant } from '@amplitude/experiment-js-client';

interface PreviewModeModalOptions {
  flags: Record<string, Variant>;
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
    this.modal.className = 'amp-preview-modal';

    const container = document.createElement('div');
    container.className = 'amp-preview-modal-container';

    Object.entries(this.options.flags).forEach(([flagKey, variant]) => {
      const flagRow = document.createElement('div');
      flagRow.className = 'amp-preview-modal-row';

      const iconContainer = document.createElement('div');
      iconContainer.className = 'amp-preview-modal-icon';
      iconContainer.innerHTML = `
        <svg class="amp-preview-modal-icon-img" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M13.1389 11.4324L18.2087 18.1956H6.04109L11.1109 11.4324V6.02794H13.1389V11.4324ZM16.1402 4H8.10959C7.68372 4 7.45051 4.4867 7.71414 4.82131L9.083 6.53492V10.7632L3.20198 18.6011C2.70514 19.2704 3.1817 20.2235 4.01316 20.2235H20.2366C21.0681 20.2235 21.5447 19.2704 21.0478 18.6011L15.1668 10.7632V6.53492L16.5357 4.82131C16.7993 4.4867 16.5661 4 16.1402 4Z" fill="currentColor"/>
        </svg>
      `;

      const titleElement = document.createElement('span');
      titleElement.className = 'amp-preview-modal-title';
      titleElement.textContent = flagKey;

      const previewBadge = document.createElement('div');
      previewBadge.className =
        'amp-preview-modal-badge amp-preview-modal-preview-badge';
      previewBadge.innerHTML = `
        <svg class="amp-preview-modal-preview-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 6C15.79 6 19.17 8.13 20.82 11.5C19.17 14.87 15.79 17 12 17C8.21 17 4.83 14.87 3.18 11.5C4.83 8.13 8.21 6 12 6ZM12 4C7 4 2.73 7.11 1 11.5C2.73 15.89 7 19 12 19C17 19 21.27 15.89 23 11.5C21.27 7.11 17 4 12 4ZM12 9C13.38 9 14.5 10.12 14.5 11.5C14.5 12.88 13.38 14 12 14C10.62 14 9.5 12.88 9.5 11.5C9.5 10.12 10.62 9 12 9ZM12 7C9.52 7 7.5 9.02 7.5 11.5C7.5 13.98 9.52 16 12 16C14.48 16 16.5 13.98 16.5 11.5C16.5 9.02 14.48 7 12 7Z" fill="currentColor"/>
        </svg>
        Preview Mode
      `;

      const variantBadge = document.createElement('span');
      variantBadge.className = `amp-preview-modal-badge amp-preview-modal-variant-badge amp-preview-modal-variant-${variant.key?.toLowerCase()}`;

      const greenDot = document.createElement('span');
      greenDot.className = 'amp-preview-modal-variant-dot';

      variantBadge.appendChild(greenDot);
      variantBadge.appendChild(document.createTextNode(variant.key || ''));

      flagRow.appendChild(iconContainer);
      flagRow.appendChild(titleElement);
      flagRow.appendChild(previewBadge);
      flagRow.appendChild(variantBadge);

      container.appendChild(flagRow);
    });

    const closeButton = document.createElement('button');
    closeButton.className = 'amp-preview-modal-close';
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
    if (!this.modal) return;

    const closeButton = this.modal.querySelector('.amp-preview-modal-close');
    if (closeButton) {
      closeButton.addEventListener('click', () => this.hide());
    }
  }

  private injectStyles(): void {
    if (document.getElementById('amp-preview-modal-styles')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'amp-preview-modal-styles';
    style.textContent = `
      .amp-preview-modal {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        background-color: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        font-size: 14px;
        line-height: 1.4;
        color: #2d3748;
        animation: amp-preview-modal-slide-in 0.3s ease-out;
        display: flex;
        align-items: flex-start;
        gap: 8px;
        padding: 12px 16px;
        max-width: 600px;
      }

      @keyframes amp-preview-modal-slide-in {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }

      .amp-preview-modal-container {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .amp-preview-modal-row {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .amp-preview-modal-icon {
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .amp-preview-modal-icon-img {
        width: 16px;
        height: 16px;
        color: #718096;
      }

      .amp-preview-modal-title {
        font-weight: 600;
        color: #1a202c;
        font-size: 14px;
        white-space: nowrap;
      }

      /* Base badge styles */
      .amp-preview-modal-badge {
        background-color: #ffffff;
        color: #4a5568;
        padding: 4px 8px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: 500;
        white-space: nowrap;
        display: flex;
        align-items: center;
        gap: 6px;
        border: 1px solid #e2e8f0;
      }

      .amp-preview-modal-preview-badge {
        color: #718096;
      }

      .amp-preview-modal-preview-icon {
        width: 14px;
        height: 14px;
        color: currentColor;
      }

      .amp-preview-modal-variant-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background-color: #68d391;
        flex-shrink: 0;
      }

      .amp-preview-modal-variant-badge.amp-preview-modal-variant-a .amp-preview-modal-variant-dot {
        background-color: #68d391;
      }

      .amp-preview-modal-variant-badge.amp-preview-modal-variant-b .amp-preview-modal-variant-dot {
        background-color: #fc8181;
      }

      .amp-preview-modal-variant-badge.amp-preview-modal-variant-testing .amp-preview-modal-variant-dot {
        background-color: #63b3ed;
      }

      .amp-preview-modal-close {
        background: none;
        border: none;
        cursor: pointer;
        padding: 4px;
        border-radius: 6px;
        color: #a0aec0;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        font-size: 18px;
        line-height: 1;
        width: 24px;
        height: 24px;
        transition: all 0.2s ease;
        align-self: flex-start;
      }

      .amp-preview-modal-close:hover {
        background-color: #f7fafc;
        color: #718096;
      }

      .amp-preview-modal-close:focus {
        outline: 2px solid #3182ce;
        outline-offset: 1px;
      }

      /* Dark mode support */
      @media (prefers-color-scheme: dark) {
        .amp-preview-modal {
          background-color: #2d3748;
          border-color: #4a5568;
          color: #e2e8f0;
        }

        .amp-preview-modal-title {
          color: #f7fafc;
        }

        .amp-preview-modal-badge {
          background-color: #2d3748;
          color: #e2e8f0;
          border-color: #4a5568;
        }

        .amp-preview-modal-preview-badge {
          color: #a0aec0;
        }

        .amp-preview-modal-variant-dot {
          background-color: #68d391;
        }

        .amp-preview-modal-variant-badge.amp-preview-modal-variant-a .amp-preview-modal-variant-dot {
          background-color: #68d391;
        }

        .amp-preview-modal-variant-badge.amp-preview-modal-variant-b .amp-preview-modal-variant-dot {
          background-color: #fc8181;
        }

        .amp-preview-modal-variant-badge.amp-preview-modal-variant-testing .amp-preview-modal-variant-dot {
          background-color: #63b3ed;
        }

        .amp-preview-modal-close {
          color: #718096;
        }

        .amp-preview-modal-close:hover {
          background-color: #4a5568;
          color: #e2e8f0;
        }
      }
    `;

    document.head.appendChild(style);
  }
}

/**
 * Convenience function to create and show a preview mode modal
 */
export function showPreviewModeModal(
  options: PreviewModeModalOptions,
): PreviewModeModal {
  const modal = new PreviewModeModal(options);

  let documentReady = false;
  let timeoutReady = false;

  const tryShow = () => {
    if (documentReady && timeoutReady) {
      modal.show();
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      documentReady = true;
      tryShow();
    });
  } else {
    documentReady = true;
  }

  setTimeout(() => {
    timeoutReady = true;
    tryShow();
  }, 500);

  return modal;
}
