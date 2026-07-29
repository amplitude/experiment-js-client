import { mergeWithWindowConfig } from '../src/config';
import { Defaults, WebExperimentConfig } from '../src/types';

const scopeWith = (experimentConfig?: WebExperimentConfig) =>
  ({ experimentConfig } as never);

describe('mergeWithWindowConfig', () => {
  it('applies defaults when neither side sets a value', () => {
    const merged = mergeWithWindowConfig({}, scopeWith({}));

    expect(merged.useDefaultNavigationHandler).toBe(
      Defaults.useDefaultNavigationHandler,
    );
  });

  it('prefers the initialize argument over the defaults', () => {
    const merged = mergeWithWindowConfig(
      { useDefaultNavigationHandler: false },
      scopeWith({}),
    );

    expect(merged.useDefaultNavigationHandler).toBe(false);
  });

  it('prefers the window config over the initialize argument', () => {
    const merged = mergeWithWindowConfig(
      { instanceName: 'arg-instance' },
      scopeWith({ instanceName: 'window-instance' }),
    );

    expect(merged.instanceName).toBe('window-instance');
  });

  // A top-level spread would swap the whole consentOptions object out, dropping
  // consentRequired and opening the gate for a page that sets the requirement in
  // the install snippet and the status from its consent platform on the window.
  it('merges consentOptions field-wise instead of replacing the object', () => {
    const merged = mergeWithWindowConfig(
      { consentOptions: { consentRequired: true } },
      scopeWith({ consentOptions: { consentStatus: 'granted' } }),
    );

    expect(merged.consentOptions).toEqual({
      consentRequired: true,
      consentStatus: 'granted',
    });
  });

  it('lets the window override a consentOptions field it shares', () => {
    const merged = mergeWithWindowConfig(
      { consentOptions: { consentRequired: true, consentStatus: 'granted' } },
      scopeWith({ consentOptions: { consentStatus: 'denied' } }),
    );

    expect(merged.consentOptions).toEqual({
      consentRequired: true,
      consentStatus: 'denied',
    });
  });

  it('always returns a consentOptions object so callers can read fields', () => {
    expect(mergeWithWindowConfig({}, scopeWith({})).consentOptions).toEqual({});
  });

  it('tolerates a missing global scope and window config', () => {
    expect(
      mergeWithWindowConfig({ instanceName: 'arg' }, undefined).instanceName,
    ).toBe('arg');
    expect(
      mergeWithWindowConfig({ instanceName: 'arg' }, scopeWith(undefined))
        .instanceName,
    ).toBe('arg');
  });
});
