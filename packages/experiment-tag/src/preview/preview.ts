/**
 * Lightweight floating dismissable modal for experiment preview mode
 * Can be used as a standalone script without React dependencies
 */

interface PreviewModeModalOptions {
  flagKey: string;
  variant: string;
  onDismiss?: () => void;
}

export class PreviewModeModal {
  private modal: HTMLDivElement | null = null;
  private options: PreviewModeModalOptions;

  constructor(options: PreviewModeModalOptions) {
    this.options = options;
  }

  /**
   * Create and show the modal
   */
  show(): void {
    if (this.modal) {
      return; // Already showing
    }

    // Wait for DOM to be ready before creating modal
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        this.createModal();
        this.attachEventListeners();
      });
    } else {
      this.createModal();
      this.attachEventListeners();
    }
  }

  /**
   * Hide and remove the modal
   */
  hide(): void {
    if (this.modal) {
      this.modal.remove();
      this.modal = null;
    }

    this.options.onDismiss?.();
  }

  /**
   * Check if modal is currently visible
   */
  isVisible(): boolean {
    return this.modal !== null && document.body && document.body.contains(this.modal);
  }

  private createModal(): void {
    // Ensure document.body exists
    if (!document.body) {
      console.warn('Cannot create preview modal: document.body is not available');
      return;
    }

    // Create modal container
    this.modal = document.createElement('div');
    this.modal.className = 'amp-preview-modal';

    // Create content container
    const content = document.createElement('div');
    content.className = 'amp-preview-modal-content';

    // Create title
    const title = document.createElement('h3');
    title.className = 'amp-preview-modal-title';
    title.textContent = 'Web Experiment Preview Mode';

    // Create details
    const details = document.createElement('p');
    details.className = 'amp-preview-modal-details';

    const flagKeySpan = document.createElement('span');
    flagKeySpan.className = 'amp-preview-modal-flag-key';
    flagKeySpan.textContent = this.options.flagKey;

    const variantSpan = document.createElement('span');
    variantSpan.className = 'amp-preview-modal-variant';
    variantSpan.textContent = this.options.variant;

    details.appendChild(flagKeySpan);
    details.appendChild(document.createTextNode(': '));
    details.appendChild(variantSpan);

    // Create close button
    const closeButton = document.createElement('button');
    closeButton.className = 'amp-preview-modal-close';
    closeButton.setAttribute('aria-label', 'Dismiss preview mode notification');
    closeButton.innerHTML = '×';

    // Assemble modal
    content.appendChild(title);
    content.appendChild(details);
    this.modal.appendChild(content);
    this.modal.appendChild(closeButton);

    // Add styles
    this.injectStyles();

    // Add to DOM
    document.body.appendChild(this.modal);
  }

  private attachEventListeners(): void {
    if (!this.modal) return;

    const closeButton = this.modal.querySelector('.amp-preview-modal-close');
    if (closeButton) {
      closeButton.addEventListener('click', () => this.hide());
    }

    // Close on Escape key
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        this.hide();
        document.removeEventListener('keydown', handleKeydown);
      }
    };
    document.addEventListener('keydown', handleKeydown);
  }



  private injectStyles(): void {
    // Check if styles are already injected
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
        border: 1px solid #e1e5e9;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        padding: 12px 16px;
        max-width: 400px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        font-size: 14px;
        line-height: 1.4;
        color: #2c3e50;
        display: flex;
        align-items: flex-start;
        gap: 12px;
        animation: amp-preview-modal-slide-in 0.3s ease-out;
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

      .amp-preview-modal-content {
        flex: 1;
        min-width: 0;
      }

      .amp-preview-modal-title {
        font-weight: 600;
        margin: 0 0 4px 0;
        color: #1a202c;
        font-size: 14px;
      }

      .amp-preview-modal-details {
        margin: 0;
        word-break: break-word;
      }

      .amp-preview-modal-flag-key {
        font-weight: 500;
        color: #3182ce;
      }

      .amp-preview-modal-variant {
        font-weight: 500;
        color: #805ad5;
      }

      .amp-preview-modal-close {
        background: none;
        border: none;
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
        color: #718096;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        font-size: 18px;
        line-height: 1;
        width: 24px;
        height: 24px;
      }

      .amp-preview-modal-close:hover {
        background-color: #f7fafc;
        color: #4a5568;
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

        .amp-preview-modal-flag-key {
          color: #63b3ed;
        }

        .amp-preview-modal-variant {
          color: #b794f6;
        }

        .amp-preview-modal-close {
          color: #a0aec0;
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

  // Delay showing the modal if DOM is not ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      modal.show();
    });
  } else {
    modal.show();
  }

  return modal;
}

/**
 * Global function for script tag usage
 */
declare global {
  interface Window {
    AmplitudePreviewModal?: {
      show: (options: PreviewModeModalOptions) => PreviewModeModal;
      PreviewModeModal: typeof PreviewModeModal;
    };
  }
}

// Make available globally for script tag usage
if (typeof window !== 'undefined') {
  window.AmplitudePreviewModal = {
    show: showPreviewModeModal,
    PreviewModeModal,
  };
}
