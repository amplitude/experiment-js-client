import { CookieStorage } from '@amplitude/analytics-core';

import { mergeIdentityCookieJson } from '../util/grant-flush-merge';

import {
  consentGate,
  isConsentPending,
  isConsentWithheld,
  onConsentDecision,
} from './consent-gate';

/**
 * The part of analytics-core's `CookieStorage` that experiment-tag actually uses.
 * Naming it lets call sites accept the consent wrapper and the raw storage
 * interchangeably, and lets tests substitute a plain object.
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
 * that go through analytics-core rather than this package's own helpers:
 * cross-subdomain identity, redirect impressions, and marketing attribution.
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

  constructor(private readonly delegate: AsyncCookieStore<T>) {}

  async get(key: string): Promise<T | undefined> {
    if (isConsentWithheld()) {
      // Empty once consent has been refused, so this reads as absent.
      this.armFlush();
      const value = this.buffered.get(key);
      return value === undefined ? undefined : snapshotValue(value);
    }
    await this.flush;
    return this.delegate.get(key);
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
    return this.delegate.set(key, value);
  }

  async remove(key: string): Promise<void> {
    // Refusal falls through so denial cleanup can erase a cookie from a
    // consented visit; only a still-undecided visitor stops at the buffer, since
    // expiring a cookie is itself a write.
    if (isConsentPending()) {
      this.buffered.delete(key);
      return;
    }
    await this.flush;
    return this.delegate.remove(key);
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
        for (const [key, value] of entries) {
          if (consentGate.manager.getStatus() !== 'granted') {
            return;
          }
          try {
            const existing = await this.delegate.get(key);
            const merged =
              typeof value === 'string'
                ? (mergeIdentityCookieJson(
                    existing as string | undefined,
                    value,
                  ) as T)
                : value;
            await this.delegate.set(key, merged);
          } catch {
            // Blocked cookie I/O degrades silently, as the raw paths do.
          }
        }
      })();
    });
  }
}

/**
 * Builds the cookie storage every experiment-tag call site should use, so a new
 * one cannot silently bypass the consent gate.
 */
export const createCookieStorage = <T>(
  options?: ConstructorParameters<typeof CookieStorage>[0],
): AsyncCookieStore<T> =>
  new ConsentAwareCookieStorage<T>(new CookieStorage<T>(options));
