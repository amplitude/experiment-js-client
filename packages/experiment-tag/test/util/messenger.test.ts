import { mergeWithWindowConfig } from '../../src/util/config';
import { asyncLoadScript } from '../../src/util/messenger';

describe('asyncLoadScript', () => {
  afterEach(() => {
    document.head.replaceChildren();
  });

  it('discovers a nonce added after config is merged', () => {
    const config = mergeWithWindowConfig({}, window as never);
    const nonceSource = document.createElement('script');
    nonceSource.setAttribute('nonce', 'late-nonce');
    document.head.appendChild(nonceSource);

    void asyncLoadScript('https://cdn.amplitude.com/overlay.js', config.nonce);

    const overlay = document.head.querySelector(
      'script[src="https://cdn.amplitude.com/overlay.js"]',
    );
    expect(overlay?.getAttribute('nonce')).toBe('late-nonce');
  });
});
