import { mergeIdentityCookieJson } from '../util/grant-flush-merge';

import {
  consentGate,
  isConsentPending,
  isConsentWithheld,
  onConsentDecision,
} from './consent-gate';

/**
 * The synchronous cookie backend the consent gate wraps. Implemented over
 * `document.cookie` in `util/cookie.ts`; tests substitute a plain object.
 */
export interface SyncCookieStore<T> {
  get(key: string): T | undefined;
  set(key: string, value: T): void;
  remove(key: string): void;
}

/** Snapshots a buffered value so callers cannot mutate what a grant will flush. */
const snapshotValue = <T>(value: T): T =>
  JSON.parse(JSON.stringify(value)) as T;

/**
 * Holds cookie writes in memory until consent arrives, then hands them to the
 * real storage. The counterpart to the gate in `util/storage.ts`, for the cookies
 * that go through analytics-core's wire format rather than this package's own
 * helpers: cross-subdomain identity, redirect impressions, and marketing
 * attribution.
 *
 * Reads are gated with the writes, so a visitor who has not decided is not
 * re-identified from a cookie an earlier consented visit left behind.
 */
export class ConsentAwareCookieStorage<T> implements SyncCookieStore<T> {
  private readonly buffered = new Map<string, T>();
  private flushArmed = false;
  private resolvedDelegate: SyncCookieStore<T> | null = null;

  /**
   * A factory delegate is resolved lazily, on the first access that reaches
   * real storage. This lets the cross-subdomain cookie domain — unprobeable
   * while consent is withheld — be resolved for real post-grant instead of
   * freezing a pending-time guess.
   */
  constructor(
    private readonly delegate: SyncCookieStore<T> | (() => SyncCookieStore<T>),
  ) {}

  private getDelegate(): SyncCookieStore<T> {
    if (this.resolvedDelegate) {
      return this.resolvedDelegate;
    }
    this.resolvedDelegate =
      typeof this.delegate === 'function' ? this.delegate() : this.delegate;
    return this.resolvedDelegate;
  }

  get(key: string): T | undefined {
    if (isConsentWithheld()) {
      // Empty once consent has been refused, so this reads as absent.
      this.armFlush();
      const value = this.buffered.get(key);
      return value === undefined ? undefined : snapshotValue(value);
    }
    return this.getDelegate().get(key);
  }

  set(key: string, value: T): void {
    if (isConsentWithheld()) {
      if (isConsentPending()) {
        this.armFlush();
        this.buffered.set(key, snapshotValue(value));
      }
      return;
    }
    this.getDelegate().set(key, value);
  }

  remove(key: string): void {
    // Pending stops at the buffer (expiring a cookie is itself a write);
    // refusal falls through so denial cleanup can erase real cookies.
    if (isConsentPending()) {
      this.buffered.delete(key);
      return;
    }
    this.getDelegate().remove(key);
  }

  private armFlush(): void {
    if (this.flushArmed) {
      return;
    }
    this.flushArmed = true;
    onConsentDecision((granted) => {
      const entries = [...this.buffered];
      this.buffered.clear();
      if (!granted) {
        return;
      }
      let delegate: SyncCookieStore<T>;
      try {
        delegate = this.getDelegate();
      } catch {
        return;
      }
      for (const [key, value] of entries) {
        if (consentGate.manager.getStatus() !== 'granted') {
          return;
        }
        try {
          const existing = delegate.get(key);
          const merged =
            typeof value === 'string'
              ? (mergeIdentityCookieJson(
                  existing as string | undefined,
                  value,
                ) as T)
              : value;
          delegate.set(key, merged);
        } catch {
          // Blocked cookie I/O degrades silently, as the raw paths do.
        }
      }
    });
  }
}
