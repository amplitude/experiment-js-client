import { ConsentManager } from 'src/consent/consent-manager';
import { ConsentStatus } from 'src/types';

describe('ConsentManager', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(jest.fn());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('defaults to pending', () => {
    expect(new ConsentManager().getStatus()).toBe('pending');
  });

  test('accepts an initial status', () => {
    expect(new ConsentManager('granted').getStatus()).toBe('granted');
  });

  it.each<[ConsentStatus, ConsentStatus]>([
    ['pending', 'granted'],
    ['pending', 'denied'],
    ['granted', 'denied'], // revocation
    ['denied', 'granted'], // preference-center re-grant
  ])('applies valid transition %s -> %s', (from, to) => {
    const manager = new ConsentManager(from);
    expect(manager.setStatus(to)).toBe(true);
    expect(manager.getStatus()).toBe(to);
  });

  it.each<ConsentStatus>(['granted', 'denied'])(
    'ignores transition %s -> pending',
    (from) => {
      const manager = new ConsentManager(from);
      expect(manager.setStatus('pending')).toBe(false);
      expect(manager.getStatus()).toBe(from);
      expect(console.warn).toHaveBeenCalled();
    },
  );

  test('same-status transition is a no-op and does not notify', () => {
    const manager = new ConsentManager('granted');
    const listener = jest.fn();
    manager.onChange(listener);
    expect(manager.setStatus('granted')).toBe(false);
    expect(listener).not.toHaveBeenCalled();
  });

  test('notifies listeners with next and previous status', () => {
    const manager = new ConsentManager();
    const listener = jest.fn();
    manager.onChange(listener);
    manager.setStatus('granted');
    expect(listener).toHaveBeenCalledWith('granted', 'pending');
  });

  test('notifies multiple listeners in registration order', () => {
    const manager = new ConsentManager();
    const calls: string[] = [];
    manager.onChange(() => calls.push('first'));
    manager.onChange(() => calls.push('second'));
    manager.setStatus('denied');
    expect(calls).toEqual(['first', 'second']);
  });

  test('unsubscribe stops notifications', () => {
    const manager = new ConsentManager();
    const listener = jest.fn();
    const unsubscribe = manager.onChange(listener);
    unsubscribe();
    manager.setStatus('granted');
    expect(listener).not.toHaveBeenCalled();
  });

  test('a throwing listener does not block the transition or other listeners', () => {
    jest.spyOn(console, 'error').mockImplementation(jest.fn());
    const manager = new ConsentManager();
    const listener = jest.fn();
    manager.onChange(() => {
      throw new Error('listener failure');
    });
    manager.onChange(listener);
    expect(manager.setStatus('granted')).toBe(true);
    expect(manager.getStatus()).toBe('granted');
    expect(listener).toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
  });

  test('does not notify for ignored transitions to pending', () => {
    const manager = new ConsentManager('granted');
    const listener = jest.fn();
    manager.onChange(listener);
    manager.setStatus('pending');
    expect(listener).not.toHaveBeenCalled();
  });
});
