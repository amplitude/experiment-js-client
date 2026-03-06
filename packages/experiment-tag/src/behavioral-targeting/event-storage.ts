import { SessionManager } from './session-manager';

/**
 * Represents a stored event record.
 */
export interface EventRecord {
  id: number;
  event_type: string;
  timestamp: number;
  session_id: string;
  properties: Record<string, unknown>;
}

/**
 * Internal storage structure.
 */
interface EventStorage {
  events: EventRecord[];
  nextId: number;
}

/**
 * Manages event storage in localStorage with automatic session tracking.
 */
export class EventStorageManager {
  private static readonly STORAGE_KEY = 'amplitude_rtbt_events';
  private static readonly MAX_EVENTS = 500;

  private sessionManager: SessionManager;

  constructor(sessionManager: SessionManager) {
    this.sessionManager = sessionManager;
  }

  /**
   * Adds an event to localStorage with automatic session tracking.
   */
  addEvent(eventType: string, properties: Record<string, unknown> = {}): void {
    const storage = this.getStorage();
    const sessionId = this.sessionManager.getOrCreateSessionId();

    const event: EventRecord = {
      id: storage.nextId++,
      event_type: eventType,
      timestamp: Date.now(),
      session_id: sessionId,
      properties,
    };

    storage.events.push(event);

    // Apply FIFO limit
    if (storage.events.length > EventStorageManager.MAX_EVENTS) {
      storage.events = storage.events.slice(-EventStorageManager.MAX_EVENTS);
    }

    this.saveStorage(storage);
  }

  /**
   * Gets all events (for testing/debugging).
   */
  getAllEvents(): EventRecord[] {
    return this.getStorage().events;
  }

  /**
   * Gets events filtered by event type.
   */
  getEventsByType(eventType: string): EventRecord[] {
    return this.getStorage().events.filter((e) => e.event_type === eventType);
  }

  /**
   * Gets events in a time window.
   */
  getEventsInTimeWindow(
    eventType: string,
    timeType: 'current_session' | 'rolling',
    timeValue: number,
    interval?: 'day' | 'hour',
  ): EventRecord[] {
    const storage = this.getStorage();
    let events = storage.events.filter((e) => e.event_type === eventType);

    if (timeType === 'current_session') {
      const currentSessionId = this.sessionManager.getOrCreateSessionId();
      events = events.filter((e) => e.session_id === currentSessionId);
    } else {
      // Rolling time window
      const now = Date.now();
      const windowMs =
        interval === 'day'
          ? timeValue * 24 * 60 * 60 * 1000
          : timeValue * 60 * 60 * 1000;
      const cutoffTimestamp = now - windowMs;

      events = events.filter((e) => e.timestamp >= cutoffTimestamp);
    }

    return events;
  }

  /**
   * Clears all events (for testing).
   */
  clearEvents(): void {
    this.saveStorage({ events: [], nextId: 1 });
  }

  /**
   * Gets event count for an event type.
   */
  getEventCount(eventType: string): number {
    return this.getEventsByType(eventType).length;
  }

  /**
   * Gets event count in a time window.
   */
  getEventCountInTimeWindow(
    eventType: string,
    timeType: 'current_session' | 'rolling',
    timeValue: number,
    interval?: 'day' | 'hour',
  ): number {
    return this.getEventsInTimeWindow(eventType, timeType, timeValue, interval)
      .length;
  }

  private getStorage(): EventStorage {
    const stored = localStorage.getItem(EventStorageManager.STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        // Invalid JSON, return empty
        return { events: [], nextId: 1 };
      }
    }
    return { events: [], nextId: 1 };
  }

  private saveStorage(storage: EventStorage): void {
    localStorage.setItem(
      EventStorageManager.STORAGE_KEY,
      JSON.stringify(storage),
    );
  }
}
