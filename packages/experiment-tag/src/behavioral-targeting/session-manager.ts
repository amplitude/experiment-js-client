import { getTopLevelDomainSync } from '../util/cookie';

/**
 * Default rolling inactivity window before a session rotates, mirroring
 * Amplitude Analytics' 30-minute session timeout.
 */
export const DEFAULT_SESSION_TIMEOUT_MS = 30 * 60 * 1000;

interface SessionState {
  sessionId: string;
  sessionStartTime: number;
  /** Epoch ms of the most recent activity; drives the rolling timeout. */
  lastEventTime: number;
}

/**
 * Manages the RTBT session ID.
 *
 * Unlike the previous per-tab `sessionStorage` implementation, the session is
 * persisted in a root-domain cookie so it is shared across subdomains, and it
 * rotates on a rolling inactivity timeout (the same model Amplitude Analytics
 * uses). When cookies are unavailable (private browsing, ITP, blocked I/O) the
 * session degrades gracefully to an in-memory, per-page session.
 *
 * Two-tier storage: cookie (authoritative, cross-subdomain + cross-tab) →
 * in-memory (per-page fallback / cache).
 */
export class SessionManager {
  private cookieKey: string;
  private sessionTimeoutMs: number;
  /** In-memory cache and fallback when cookie storage is unavailable. */
  private memoryState?: SessionState;
  /** Lazily resolved leading-dot domain (e.g. `.example.com`) or `''`. */
  private resolvedDomain?: string;
  /** Tri-state: undefined = unknown, true/false = detected via write-back. */
  private cookiesUsable?: boolean;

  constructor(
    apiKey: string,
    sessionTimeoutMs: number = DEFAULT_SESSION_TIMEOUT_MS,
  ) {
    this.cookieKey = `EXP_${apiKey.slice(0, 10)}_rtbt_session`;
    this.sessionTimeoutMs = sessionTimeoutMs;
  }

  /**
   * Returns the current session ID, rotating it when the inactivity timeout
   * has elapsed and creating one when none exists. This is a read: it does not
   * extend the session (use {@link recordActivity} for that).
   */
  getCurrentSessionId(): string {
    return this.resolve().sessionId;
  }

  /**
   * Backwards-compatible alias for {@link getCurrentSessionId}.
   */
  getOrCreateSessionId(): string {
    return this.getCurrentSessionId();
  }

  /**
   * Records activity for the current page event: extends the active session
   * (bumping `lastEventTime`) or rotates to a new session when the inactivity
   * timeout has elapsed. Call this for every observed Amplitude event so that
   * any activity keeps the session alive.
   */
  recordActivity(): void {
    const now = Date.now();
    const existing = this.read();
    if (existing && now - existing.lastEventTime <= this.sessionTimeoutMs) {
      this.persist({ ...existing, lastEventTime: now });
    } else {
      this.persist(this.newSession(now));
    }
  }

  /**
   * Gets the session start time in milliseconds since epoch.
   */
  getSessionStartTime(): number | undefined {
    return this.resolve().sessionStartTime;
  }

  /**
   * Clears the current session from memory and cookie storage.
   */
  clearSession(): void {
    this.memoryState = undefined;
    this.deleteCookie();
  }

  /**
   * Resolves the active session: returns the persisted session when it is
   * still within the inactivity window, otherwise creates, persists and
   * returns a fresh one. Does not extend an already-active session.
   */
  private resolve(): SessionState {
    const now = Date.now();
    const existing = this.read();
    if (existing && now - existing.lastEventTime <= this.sessionTimeoutMs) {
      return existing;
    }
    const fresh = this.newSession(now);
    this.persist(fresh);
    return fresh;
  }

  private newSession(now: number): SessionState {
    return {
      sessionId: `${now}-${Math.random().toString(36).substr(2, 9)}`,
      sessionStartTime: now,
      lastEventTime: now,
    };
  }

  /**
   * Reads session state, preferring the cookie (cross-tab / cross-subdomain
   * source of truth) and falling back to the in-memory copy.
   */
  private read(): SessionState | undefined {
    if (this.cookiesUsable !== false) {
      const raw = this.readCookie();
      const parsed = raw !== undefined ? this.parse(raw) : undefined;
      if (parsed) {
        return parsed;
      }
    }
    return this.memoryState;
  }

  private persist(state: SessionState): void {
    this.memoryState = state;
    this.writeCookie(state);
  }

  private parse(raw: string): SessionState | undefined {
    try {
      const data = JSON.parse(raw);
      if (
        data &&
        typeof data.sessionId === 'string' &&
        typeof data.lastEventTime === 'number'
      ) {
        return {
          sessionId: data.sessionId,
          sessionStartTime:
            typeof data.sessionStartTime === 'number'
              ? data.sessionStartTime
              : data.lastEventTime,
          lastEventTime: data.lastEventTime,
        };
      }
    } catch {
      // Invalid JSON; treat as no session.
    }
    return undefined;
  }

  private domain(): string {
    if (this.resolvedDomain === undefined) {
      this.resolvedDomain =
        typeof location !== 'undefined' && location.hostname
          ? getTopLevelDomainSync(location.hostname)
          : '';
    }
    return this.resolvedDomain;
  }

  private readCookie(): string | undefined {
    if (typeof document === 'undefined') return undefined;
    const cookies = document.cookie ? document.cookie.split('; ') : [];
    for (const cookie of cookies) {
      const eq = cookie.indexOf('=');
      const key = eq === -1 ? cookie : cookie.slice(0, eq);
      if (key === this.cookieKey) {
        const value = eq === -1 ? '' : cookie.slice(eq + 1);
        try {
          return decodeURIComponent(value);
        } catch {
          return value;
        }
      }
    }
    return undefined;
  }

  private writeCookie(state: SessionState): void {
    if (this.cookiesUsable === false || typeof document === 'undefined') {
      this.cookiesUsable = false;
      return;
    }
    try {
      const value = encodeURIComponent(JSON.stringify(state));
      const domain = this.domain();
      const secure =
        typeof location !== 'undefined' && location.protocol === 'https:'
          ? '; Secure'
          : '';
      document.cookie =
        `${this.cookieKey}=${value}; path=/; SameSite=Lax` +
        (domain ? `; domain=${domain}` : '') +
        secure;
      // Verify via read-back: detects blocked cookie I/O (ITP, private mode).
      this.cookiesUsable = this.readCookie() !== undefined;
    } catch {
      this.cookiesUsable = false;
    }
  }

  private deleteCookie(): void {
    if (typeof document === 'undefined') return;
    try {
      const domain = this.domain();
      document.cookie =
        `${this.cookieKey}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT` +
        (domain ? `; domain=${domain}` : '');
    } catch {
      // Best-effort delete; in-memory state is already cleared.
    }
  }
}
