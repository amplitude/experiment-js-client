/**
 * Manages browser session ID using sessionStorage.
 * Session ID is unique per browser tab and cleared when tab closes.
 */
export class SessionManager {
  private static readonly STORAGE_KEY = 'amplitude_rtbt_session';
  private sessionId?: string;
  private sessionStartTime?: number;

  /**
   * Gets the current session ID, creating one if it doesn't exist.
   * Uses sessionStorage (cleared when tab closes).
   */
  getOrCreateSessionId(): string {
    if (this.sessionId) {
      return this.sessionId;
    }

    // Try to load from sessionStorage
    const stored = sessionStorage.getItem(SessionManager.STORAGE_KEY);

    if (stored) {
      try {
        const data = JSON.parse(stored);
        if (data.sessionId && typeof data.sessionId === 'string') {
          this.sessionId = data.sessionId;
          this.sessionStartTime = data.sessionStartTime;
          return data.sessionId;
        }
      } catch (e) {
        // Invalid JSON, create new session
      }
    }

    // Create new session
    this.sessionId = this.generateSessionId();
    this.sessionStartTime = Date.now();

    sessionStorage.setItem(
      SessionManager.STORAGE_KEY,
      JSON.stringify({
        sessionId: this.sessionId,
        sessionStartTime: this.sessionStartTime,
      }),
    );

    return this.sessionId;
  }

  /**
   * Gets the session start time in milliseconds since epoch.
   */
  getSessionStartTime(): number | undefined {
    if (!this.sessionStartTime) {
      this.getOrCreateSessionId(); // Load from storage
    }
    return this.sessionStartTime;
  }

  /**
   * Generates a unique session ID.
   */
  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clears the current session (for testing).
   */
  clearSession(): void {
    this.sessionId = undefined;
    this.sessionStartTime = undefined;
    sessionStorage.removeItem(SessionManager.STORAGE_KEY);
  }
}
