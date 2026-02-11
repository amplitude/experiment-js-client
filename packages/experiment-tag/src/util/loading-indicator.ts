const LOADING_INDICATOR_ID = 'amp-exp-loading';
const AMPLITUDE_BRAND_COLOR = '#1e61f0';
const LOADING_TIMEOUT_MS = 10000;

let loadingTimeout: ReturnType<typeof setTimeout> | undefined;

export const showLoadingIndicator = () => {
  if (document.getElementById(LOADING_INDICATOR_ID)) {
    return;
  }

  const loadingContainer = document.createElement('div');
  loadingContainer.id = LOADING_INDICATOR_ID;

  // Safety timeout - hide after 10 seconds if overlay never loads
  loadingTimeout = setTimeout(() => {
    hideLoadingIndicator();
  }, LOADING_TIMEOUT_MS);

  loadingContainer.innerHTML = `
    <style>
      #${LOADING_INDICATOR_ID} {
        position: fixed;
        inset: 0;
        background: rgba(33, 33, 36, 0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2147483647;
      }

      #${LOADING_INDICATOR_ID} .modal {
        background: white;
        border-radius: 8px;
        padding: 32px 48px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 16px;
        box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
      }

      #${LOADING_INDICATOR_ID} .spinner {
        width: 32px;
        height: 32px;
        border: 3px solid #e5e7eb;
        border-top-color: ${AMPLITUDE_BRAND_COLOR};
        border-radius: 50%;
        animation: amp-spin 1s linear infinite;
      }

      @keyframes amp-spin {
        to { transform: rotate(360deg); }
      }

      #${LOADING_INDICATOR_ID} .text {
        color: #212124;
        font-size: 16px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
    </style>

    <div class="modal">
      <div class="spinner"></div>
      <div class="text">Loading Visual Editor</div>
    </div>
  `;

  const appendToBody = () => {
    // Check again in case it was added while waiting or hidden before body was ready
    if (
      document.getElementById(LOADING_INDICATOR_ID) ||
      loadingTimeout === undefined
    ) {
      return;
    }
    document.body.appendChild(loadingContainer);
  };

  // Defer if body doesn't exist yet
  if (document.body) {
    appendToBody();
  } else {
    document.addEventListener('DOMContentLoaded', appendToBody, { once: true });
  }
};

export const hideLoadingIndicator = () => {
  if (loadingTimeout) {
    clearTimeout(loadingTimeout);
    loadingTimeout = undefined;
  }
  document.getElementById(LOADING_INDICATOR_ID)?.remove();
};
