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
 * Manages event storage with in-memory cache and debounced localStorage persistence.
 * All reads are from memory for performance, writes are debounced to localStorage.
 */
export class EventStorageManager {
  private static readonly MAX_EVENTS = 500;
  private static readonly DEBOUNCE_MS = 500; // 500ms debounce

  private sessionManager: SessionManager;
  private memoryCache: EventStorage; // In-memory cache for fast reads
  private debouncedWriteTimeout: ReturnType<typeof setTimeout> | null = null;
  private hasPendingWrites = false; // Track if cache has unsaved changes
  private persistedEvents?: Set<string>; // Optional set of event types to persist
  private storageKey: string;

  constructor(
    apiKey: string,
    sessionManager: SessionManager,
    persistedEvents?: Set<string>,
  ) {
    this.storageKey = `EXP_${apiKey}_rtbt_events`;
    this.sessionManager = sessionManager;
    this.persistedEvents = persistedEvents;

    // Load from localStorage into memory on initialization
    this.memoryCache = this.loadFromLocalStorage();

    // Setup flush handlers to prevent data loss
    this.setupFlushHandlers();
  }

  /**
   * Adds an event to in-memory cache with automatic session tracking.
   * Triggers debounced write to localStorage.
   * If persistedEvents is set, only events with matching event types will be stored.
   */
  addEvent(
    eventType: string,
    properties: Record<string, unknown> = {},
    eventTime?: number,
  ): void {
    // Skip if persistedEvents is set and this event type is not in the set
    if (this.persistedEvents && !this.persistedEvents.has(eventType)) {
      return;
    }

    const sessionId = this.sessionManager.getOrCreateSessionId();

    const event: EventRecord = {
      id: this.memoryCache.nextId++,
      event_type: eventType,
      timestamp: eventTime ?? Date.now(),
      session_id: sessionId,
      properties,
    };

    this.memoryCache.events.push(event);

    // Apply FIFO limit
    if (this.memoryCache.events.length > EventStorageManager.MAX_EVENTS) {
      this.memoryCache.events = this.memoryCache.events.slice(
        -EventStorageManager.MAX_EVENTS,
      );
    }

    // Trigger debounced write to localStorage
    this.scheduleDebouncedWrite();
  }

  /**
   * Gets all events from in-memory cache (for testing/debugging).
   */
  getAllEvents(): EventRecord[] {
    return this.memoryCache.events;
  }

  /**
   * Gets events filtered by event type from in-memory cache.
   */
  getEventsByType(eventType: string): EventRecord[] {
    return this.memoryCache.events.filter((e) => e.event_type === eventType);
  }

  /**
   * Gets events in a time window from in-memory cache.
   */
  getEventsInTimeWindow(
    eventType: string,
    timeType: 'current_session' | 'rolling',
    timeValue: number,
    interval?: 'day' | 'hour',
  ): EventRecord[] {
    let events = this.memoryCache.events.filter(
      (e) => e.event_type === eventType,
    );

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
   * Clears all events from memory and localStorage.
   */
  clearEvents(): void {
    this.memoryCache = { events: [], nextId: 1 };
    this.hasPendingWrites = true; // Force flush to persist clear operation
    this.flushToLocalStorage(); // Immediate write for clear
  }

  /**
   * Manually flushes pending writes to localStorage.
   * Useful for testing or when immediate persistence is required.
   */
  flush(): void {
    this.flushToLocalStorage();
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

  /**
   * Loads data from localStorage into memory on initialization.
   */
  private loadFromLocalStorage(): EventStorage {
    const stored = localStorage.getItem(this.storageKey);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // Validate structure to prevent crashes from malformed data
        if (
          parsed &&
          typeof parsed === 'object' &&
          Array.isArray(parsed.events) &&
          typeof parsed.nextId === 'number'
        ) {
          return parsed;
        }
        // Invalid structure, return empty
        return { events: [], nextId: 1 };
      } catch (e) {
        // Invalid JSON, return empty
        return { events: [], nextId: 1 };
      }
    }
    return { events: [], nextId: 1 };
  }

  /**
   * Schedules a debounced write to localStorage.
   * Resets the timer on each call to batch multiple writes together.
   */
  private scheduleDebouncedWrite(): void {
    this.hasPendingWrites = true;

    // Clear existing timeout if any
    if (this.debouncedWriteTimeout) {
      clearTimeout(this.debouncedWriteTimeout);
    }

    // Schedule new write
    this.debouncedWriteTimeout = setTimeout(() => {
      this.flushToLocalStorage();
    }, EventStorageManager.DEBOUNCE_MS);
  }

  /**
   * Immediately writes in-memory cache to localStorage.
   */
  private flushToLocalStorage(): void {
    if (!this.hasPendingWrites) {
      return; // No changes to persist
    }

    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.memoryCache));
      this.hasPendingWrites = false;

      // Clear debounce timeout since we just flushed
      if (this.debouncedWriteTimeout) {
        clearTimeout(this.debouncedWriteTimeout);
        this.debouncedWriteTimeout = null;
      }
    } catch (e) {
      // localStorage quota exceeded or unavailable
    }
  }

  /**
   * Sets up event handlers to flush data before page unload or when tab is hidden.
   * This prevents data loss on page close or backgrounding.
   */
  private setupFlushHandlers(): void {
    // Flush before page unload (close, refresh, navigation)
    window.addEventListener('beforeunload', this.handleBeforeUnload);

    // Flush when tab becomes hidden (user switches tabs)
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  }

  /**
   * Handler for beforeunload event.
   */
  private handleBeforeUnload = (): void => {
    this.flushToLocalStorage();
  };

  /**
   * Handler for visibilitychange event.
   */
  private handleVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden') {
      this.flushToLocalStorage();
    }
  };

  /**
   * Cleanup method to remove event listeners.
   * Should be called when EventStorageManager is no longer needed.
   */
  cleanup(): void {
    // Flush any pending writes
    this.flushToLocalStorage();

    // Clear debounce timeout
    if (this.debouncedWriteTimeout) {
      clearTimeout(this.debouncedWriteTimeout);
      this.debouncedWriteTimeout = null;
    }

    // Remove event listeners
    window.removeEventListener('beforeunload', this.handleBeforeUnload);
    document.removeEventListener(
      'visibilitychange',
      this.handleVisibilityChange,
    );
  }
}
