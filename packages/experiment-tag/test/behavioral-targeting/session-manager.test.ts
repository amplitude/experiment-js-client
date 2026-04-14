import { SessionManager } from 'src/behavioral-targeting/session-manager';

describe('SessionManager', () => {
  let sessionManager: SessionManager;
  const testApiKey = 'test-api-key';
  const storageKey = `EXP_${testApiKey.slice(0, 10)}_rtbt_session`;
  beforeEach(() => {
    // Clear sessionStorage before each test
    sessionStorage.clear();
    sessionManager = new SessionManager(testApiKey);
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  describe('getOrCreateSessionId', () => {
    test('should create new session ID if none exists', () => {
      const sessionId = sessionManager.getOrCreateSessionId();

      expect(sessionId).toBeDefined();
      expect(typeof sessionId).toBe('string');
      expect(sessionId.length).toBeGreaterThan(0);
    });

    test('should return same session ID on subsequent calls', () => {
      const sessionId1 = sessionManager.getOrCreateSessionId();
      const sessionId2 = sessionManager.getOrCreateSessionId();

      expect(sessionId1).toBe(sessionId2);
    });

    test('should persist session ID in sessionStorage', () => {
      const sessionId = sessionManager.getOrCreateSessionId();

      const stored = sessionStorage.getItem(storageKey);
      expect(stored).not.toBeNull();

      if (stored) {
        const data = JSON.parse(stored);
        expect(data.sessionId).toBe(sessionId);
        expect(data.sessionStartTime).toBeDefined();
      }
    });

    test('should load existing session from sessionStorage', () => {
      // Create a session
      const sessionId1 = sessionManager.getOrCreateSessionId();

      // Create new manager instance (simulates page reload)
      const newManager = new SessionManager(testApiKey);
      const sessionId2 = newManager.getOrCreateSessionId();

      expect(sessionId2).toBe(sessionId1);
    });

    test('should generate unique session IDs', () => {
      const sessionId1 = sessionManager.getOrCreateSessionId();

      // Clear and create new session
      sessionManager.clearSession();
      const sessionId2 = sessionManager.getOrCreateSessionId();

      expect(sessionId1).not.toBe(sessionId2);
    });

    test('should handle invalid JSON in sessionStorage', () => {
      sessionStorage.setItem(storageKey, 'invalid json');

      const sessionId = sessionManager.getOrCreateSessionId();

      expect(sessionId).toBeDefined();
      expect(typeof sessionId).toBe('string');
    });
  });

  describe('getSessionStartTime', () => {
    test('should return session start time', () => {
      const beforeTime = Date.now();
      sessionManager.getOrCreateSessionId();
      const startTime = sessionManager.getSessionStartTime();
      const afterTime = Date.now();

      expect(startTime).toBeDefined();
      expect(startTime).toBeGreaterThanOrEqual(beforeTime);
      expect(startTime).toBeLessThanOrEqual(afterTime);
    });

    test('should return same start time on subsequent calls', () => {
      sessionManager.getOrCreateSessionId();
      const startTime1 = sessionManager.getSessionStartTime();
      const startTime2 = sessionManager.getSessionStartTime();

      expect(startTime1).toBe(startTime2);
    });

    test('should load start time from sessionStorage', () => {
      sessionManager.getOrCreateSessionId();
      const startTime1 = sessionManager.getSessionStartTime();

      // Create new manager instance
      const newManager = new SessionManager(testApiKey);
      const startTime2 = newManager.getSessionStartTime();

      expect(startTime2).toBe(startTime1);
    });
  });

  describe('clearSession', () => {
    test('should clear session ID', () => {
      sessionManager.getOrCreateSessionId();
      sessionManager.clearSession();

      const sessionId = sessionManager.getOrCreateSessionId();
      expect(sessionId).toBeDefined();
    });

    test('should remove sessionStorage entry', () => {
      sessionManager.getOrCreateSessionId();
      sessionManager.clearSession();

      const stored = sessionStorage.getItem(storageKey);
      expect(stored).toBeNull();
    });

    test('should allow creating new session after clear', () => {
      const sessionId1 = sessionManager.getOrCreateSessionId();
      sessionManager.clearSession();
      const sessionId2 = sessionManager.getOrCreateSessionId();

      expect(sessionId1).not.toBe(sessionId2);
    });
  });
});
