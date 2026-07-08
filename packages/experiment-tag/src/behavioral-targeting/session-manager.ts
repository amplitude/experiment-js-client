import { getTopLevelDomainSync, SyncJsonCookie } from '../util/cookie';

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

function newSession(now: number): SessionState {
  return {
    sessionId: `${now}-${Math.random().toString(36).substr(2, 9)}`,
    sessionStartTime: now,
    lastEventTime: now,
  };
}

/**
 * Validates a parsed cookie payload as a {@link SessionState}, normalizing a
 * missing `sessionStartTime` to `lastEventTime` (older cookies). Returns
 * undefined for anything that isn't a usable session.
 */
function validateSessionState(data: unknown): SessionState | undefined {
  if (
    data &&
    typeof data === 'object' &&
    typeof (data as Record<string, unknown>).sessionId === 'string' &&
    typeof (data as Record<string, unknown>).lastEventTime === 'number'
  ) {
    const d = data as Record<string, unknown>;
    return {
      sessionId: d.sessionId as string,
      sessionStartTime:
        typeof d.sessionStartTime === 'number'
          ? d.sessionStartTime
          : (d.lastEventTime as number),
      lastEventTime: d.lastEventTime as number,
    };
  }
  return undefined;
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
 * Cookie I/O + the cookie→memory two-tier fallback are delegated to
 * {@link SyncJsonCookie}; this class owns the session lifecycle (rotation on
 * inactivity, validation) on top of it.
 */
export class SessionManager {
  private sessionTimeoutMs: number;
  private store: SyncJsonCookie<SessionState>;
  /** Lazily resolved leading-dot domain (e.g. `.example.com`) or `''`. */
  private resolvedDomain?: string;

  constructor(
    apiKey: string,
    sessionTimeoutMs: number = DEFAULT_SESSION_TIMEOUT_MS,
  ) {
    this.sessionTimeoutMs = sessionTimeoutMs;
    this.store = new SyncJsonCookie<SessionState>(
      `EXP_${apiKey.slice(0, 10)}_rtbt_session`,
      () => this.domain(),
      { validate: validateSessionState },
    );
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
    const existing = this.store.read();
    if (existing && now - existing.lastEventTime <= this.sessionTimeoutMs) {
      this.store.write({ ...existing, lastEventTime: now });
    } else {
      this.store.write(newSession(now));
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
    this.store.clear();
  }

  /**
   * Resolves the active session: returns the persisted session when it is
   * still within the inactivity window, otherwise creates, persists and
   * returns a fresh one. Does not extend an already-active session.
   */
  private resolve(): SessionState {
    const now = Date.now();
    const existing = this.store.read();
    if (existing && now - existing.lastEventTime <= this.sessionTimeoutMs) {
      return existing;
    }
    const fresh = newSession(now);
    this.store.write(fresh);
    return fresh;
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
}
