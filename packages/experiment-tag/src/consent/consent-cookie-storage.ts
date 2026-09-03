import { mergeIdentityCookieJson } from '../util/grant-flush-merge';

import {
  consentGate,
  isConsentPending,
  isConsentWithheld,
  onConsentDecision,
} from './consent-gate';

/**
 * The faux asynchronous cookie backend the consent gate wraps. Implemented over
 * `document.cookie` in `util/cookie.ts`; tests substitute a plain object.
 */
export interface AsyncCookieStore<T> {
  get(key: string): Promise<T | undefined>;
  set(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
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
export class ConsentAwareCookieStorage<T> implements AsyncCookieStore<T> {
  private readonly buffered = new Map<string, T>();
  /**
   * The in-flight grant flush. Reads and writes join it before touching the
   * delegate, so nothing observes the store half-populated.
   */
  private flush: Promise<void> | null = null;
  private flushArmed = false;
  private resolvedDelegate: Promise<AsyncCookieStore<T>> | null = null;

  /**
   * A factory delegate is resolved lazily, on the first access that reaches
   * real storage. This lets the cross-subdomain cookie domain — unprobeable
   * while consent is withheld — be resolved for real post-grant instead of
   * freezing a pending-time guess.
   */
  constructor(
    private readonly delegate:
      | AsyncCookieStore<T>
      | (() => Promise<AsyncCookieStore<T>> | AsyncCookieStore<T>),
  ) {}

  private getDelegate(): Promise<AsyncCookieStore<T>> {
    return (this.resolvedDelegate ??= Promise.resolve(
      typeof this.delegate === 'function' ? this.delegate() : this.delegate,
    ));
  }

  async get(key: string): Promise<T | undefined> {
    if (isConsentWithheld()) {
      // Empty once consent has been refused, so this reads as absent.
      this.armFlush();
      const value = this.buffered.get(key);
      return value === undefined ? undefined : snapshotValue(value);
    }
    await this.flush;
    return (await this.getDelegate()).get(key);
  }

  async set(key: string, value: T): Promise<void> {
    if (isConsentWithheld()) {
      if (isConsentPending()) {
        this.armFlush();
        this.buffered.set(key, snapshotValue(value));
      }
      return;
    }
    await this.flush;
    return (await this.getDelegate()).set(key, value);
  }

  async remove(key: string): Promise<void> {
    // Pending stops at the buffer (expiring a cookie is itself a write);
    // refusal falls through so denial cleanup can erase real cookies.
    if (isConsentPending()) {
      this.buffered.delete(key);
      return;
    }
    await this.flush;
    return (await this.getDelegate()).remove(key);
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
      this.flush = (async () => {
        // Resolved post-grant so a factory delegate probes the real cookie
        // domain rather than reusing a pending-time guess.
        let delegate: AsyncCookieStore<T>;
        try {
          delegate = await this.getDelegate();
        } catch {
          // Drop the buffer; the flush must not reject or every later access
          // (which awaits it) would too.
          return;
        }
        for (const [key, value] of entries) {
          if (consentGate.manager.getStatus() !== 'granted') {
            return;
          }
          try {
            const existing = await delegate.get(key);
            const merged =
              typeof value === 'string'
                ? (mergeIdentityCookieJson(
                    existing as string | undefined,
                    value,
                  ) as T)
                : value;
            await delegate.set(key, merged);
          } catch {
            // Blocked cookie I/O degrades silently, as the raw paths do.
          }
        }
      })();
    });
  }
}
