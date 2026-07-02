import {
  DEFAULT_SESSION_TIMEOUT_MS,
  SessionManager,
} from 'src/behavioral-targeting/session-manager';

const testApiKey = 'test-api-key';
const cookieKey = `EXP_${testApiKey.slice(0, 10)}_rtbt_session`;

const clearSessionCookie = () => {
  document.cookie = `${cookieKey}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
};

const readSessionCookie = (): Record<string, unknown> | undefined => {
  const match = document.cookie
    .split('; ')
    .find((c) => c.startsWith(`${cookieKey}=`));
  if (!match) return undefined;
  return JSON.parse(decodeURIComponent(match.slice(cookieKey.length + 1)));
};

describe('SessionManager', () => {
  let sessionManager: SessionManager;

  beforeEach(() => {
    clearSessionCookie();
    sessionManager = new SessionManager(testApiKey);
  });

  afterEach(() => {
    clearSessionCookie();
    jest.useRealTimers();
  });

  describe('getCurrentSessionId', () => {
    test('should create a new session ID if none exists', () => {
      const sessionId = sessionManager.getCurrentSessionId();

      expect(sessionId).toBeDefined();
      expect(typeof sessionId).toBe('string');
      expect(sessionId.length).toBeGreaterThan(0);
    });

    test('should return the same session ID on subsequent calls', () => {
      const sessionId1 = sessionManager.getCurrentSessionId();
      const sessionId2 = sessionManager.getCurrentSessionId();

      expect(sessionId1).toBe(sessionId2);
    });

    test('getOrCreateSessionId is an alias for getCurrentSessionId', () => {
      const sessionId1 = sessionManager.getOrCreateSessionId();
      const sessionId2 = sessionManager.getCurrentSessionId();

      expect(sessionId1).toBe(sessionId2);
    });

    test('should persist the session to the cookie', () => {
      const sessionId = sessionManager.getCurrentSessionId();

      const stored = readSessionCookie();
      expect(stored).toBeDefined();
      expect(stored?.sessionId).toBe(sessionId);
      expect(stored?.sessionStartTime).toBeDefined();
      expect(stored?.lastEventTime).toBeDefined();
    });

    test('should share the session across manager instances (cross-tab/subdomain)', () => {
      const sessionId1 = sessionManager.getCurrentSessionId();

      // A second instance simulates another tab or subdomain reading the
      // shared root-domain cookie.
      const otherManager = new SessionManager(testApiKey);
      const sessionId2 = otherManager.getCurrentSessionId();

      expect(sessionId2).toBe(sessionId1);
    });

    test('should handle invalid JSON in the cookie', () => {
      document.cookie = `${cookieKey}=not-valid-json; path=/`;

      const sessionId = sessionManager.getCurrentSessionId();

      expect(sessionId).toBeDefined();
      expect(typeof sessionId).toBe('string');
    });

    test('should not extend the session (read-only)', () => {
      jest.useFakeTimers();
      const now = Date.now();
      jest.setSystemTime(now);

      const sessionId = sessionManager.getCurrentSessionId();
      const lastEventTime = readSessionCookie()?.lastEventTime;

      jest.setSystemTime(now + 5 * 60 * 1000);
      expect(sessionManager.getCurrentSessionId()).toBe(sessionId);
      // lastEventTime is unchanged by a read.
      expect(readSessionCookie()?.lastEventTime).toBe(lastEventTime);
    });

    test('should rotate the session after the inactivity timeout', () => {
      jest.useFakeTimers();
      const now = Date.now();
      jest.setSystemTime(now);

      const sessionId1 = sessionManager.getCurrentSessionId();

      jest.setSystemTime(now + DEFAULT_SESSION_TIMEOUT_MS + 1);
      const sessionId2 = sessionManager.getCurrentSessionId();

      expect(sessionId2).not.toBe(sessionId1);
    });
  });

  describe('recordActivity', () => {
    test('should create a session on first activity', () => {
      sessionManager.recordActivity();

      expect(readSessionCookie()?.sessionId).toBeDefined();
    });

    test('should keep the same session within the timeout window', () => {
      jest.useFakeTimers();
      const now = Date.now();
      jest.setSystemTime(now);

      sessionManager.recordActivity();
      const sessionId1 = sessionManager.getCurrentSessionId();

      jest.setSystemTime(now + DEFAULT_SESSION_TIMEOUT_MS - 1);
      sessionManager.recordActivity();
      const sessionId2 = sessionManager.getCurrentSessionId();

      expect(sessionId2).toBe(sessionId1);
    });

    test('should extend the session by bumping lastEventTime', () => {
      jest.useFakeTimers();
      const now = Date.now();
      jest.setSystemTime(now);

      sessionManager.recordActivity();
      const startTime = sessionManager.getSessionStartTime();

      const later = now + 10 * 60 * 1000;
      jest.setSystemTime(later);
      sessionManager.recordActivity();

      const stored = readSessionCookie();
      expect(stored?.lastEventTime).toBe(later);
      // Start time stays anchored to when the session began.
      expect(stored?.sessionStartTime).toBe(startTime);
    });

    test('should keep the session alive past the timeout with continued activity', () => {
      jest.useFakeTimers();
      let now = Date.now();
      jest.setSystemTime(now);

      sessionManager.recordActivity();
      const sessionId = sessionManager.getCurrentSessionId();

      // Repeated activity just under the timeout never rotates the session.
      for (let i = 0; i < 5; i++) {
        now += DEFAULT_SESSION_TIMEOUT_MS - 1;
        jest.setSystemTime(now);
        sessionManager.recordActivity();
      }

      expect(sessionManager.getCurrentSessionId()).toBe(sessionId);
    });

    test('should rotate the session after a gap longer than the timeout', () => {
      jest.useFakeTimers();
      const now = Date.now();
      jest.setSystemTime(now);

      sessionManager.recordActivity();
      const sessionId1 = sessionManager.getCurrentSessionId();

      jest.setSystemTime(now + DEFAULT_SESSION_TIMEOUT_MS + 1);
      sessionManager.recordActivity();
      const sessionId2 = sessionManager.getCurrentSessionId();

      expect(sessionId2).not.toBe(sessionId1);
    });
  });

  describe('configurable timeout', () => {
    test('should honor a custom session timeout', () => {
      jest.useFakeTimers();
      const now = Date.now();
      jest.setSystemTime(now);

      const customTimeout = 60 * 1000; // 1 minute
      const manager = new SessionManager(testApiKey, customTimeout);
      const sessionId1 = manager.getCurrentSessionId();

      jest.setSystemTime(now + customTimeout + 1);
      const sessionId2 = manager.getCurrentSessionId();

      expect(sessionId2).not.toBe(sessionId1);
    });
  });

  describe('getSessionStartTime', () => {
    test('should return the session start time', () => {
      const beforeTime = Date.now();
      sessionManager.getCurrentSessionId();
      const startTime = sessionManager.getSessionStartTime();
      const afterTime = Date.now();

      expect(startTime).toBeDefined();
      expect(startTime).toBeGreaterThanOrEqual(beforeTime);
      expect(startTime).toBeLessThanOrEqual(afterTime);
    });

    test('should return the same start time on subsequent calls', () => {
      sessionManager.getCurrentSessionId();
      const startTime1 = sessionManager.getSessionStartTime();
      const startTime2 = sessionManager.getSessionStartTime();

      expect(startTime1).toBe(startTime2);
    });

    test('should load the start time from the cookie in a new instance', () => {
      sessionManager.getCurrentSessionId();
      const startTime1 = sessionManager.getSessionStartTime();

      const newManager = new SessionManager(testApiKey);
      const startTime2 = newManager.getSessionStartTime();

      expect(startTime2).toBe(startTime1);
    });
  });

  describe('clearSession', () => {
    test('should remove the cookie', () => {
      sessionManager.getCurrentSessionId();
      sessionManager.clearSession();

      expect(readSessionCookie()).toBeUndefined();
    });

    test('should create a new, distinct session after clear', () => {
      const sessionId1 = sessionManager.getCurrentSessionId();
      sessionManager.clearSession();
      const sessionId2 = sessionManager.getCurrentSessionId();

      expect(sessionId1).not.toBe(sessionId2);
    });
  });

  describe('in-memory fallback when cookies are unavailable', () => {
    afterEach(() => {
      // Remove the own-property shadow so the jsdom prototype getter/setter
      // is used again.
      delete (document as unknown as { cookie?: string }).cookie;
    });

    test('should degrade to a stable per-page session without throwing', () => {
      // Simulate blocked cookie I/O: writes are dropped, reads return ''.
      Object.defineProperty(document, 'cookie', {
        configurable: true,
        get: () => '',
        set: () => undefined,
      });

      const manager = new SessionManager(testApiKey);
      const sessionId1 = manager.getCurrentSessionId();
      const sessionId2 = manager.getCurrentSessionId();

      expect(sessionId1).toBeDefined();
      expect(sessionId1).toBe(sessionId2);
    });
  });
});
