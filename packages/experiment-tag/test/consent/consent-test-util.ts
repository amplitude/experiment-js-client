import { consentGate } from 'src/consent/consent-gate';

/**
 * Puts the gate in the state `initialize` leaves it in for a given status.
 * Shared by every consent suite so the simulation of a gated initialize
 * cannot drift between them.
 */
export const activateConsent = (
  status: 'pending' | 'granted' | 'denied',
): void => {
  consentGate.required = true;
  consentGate.manager.seedFromConfig(status);
};
