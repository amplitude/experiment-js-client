import { RelayClient } from './relay-client';
import { RelayEventStorage } from './relay-protocol';
import { SessionManager } from './session-manager';

/**
 * Dedup key for cross-subdomain merge (matches relay.js MIGRATE_EVENTS for
 * migration; includes id so same-millisecond events do not collapse on merge).
 */
export function eventDedupKey(event: {
  event_type: string;
  timestamp: number;
  id: number;
}): string {
  return `${event.event_type}:${event.timestamp}:${event.id}`;
}

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
  private relayClient: RelayClient | null = null;

  constructor(
    apiKey: string,
    sessionManager: SessionManager,
    persistedEvents?: Set<string>,
    relayClient?: RelayClient | null,
  ) {
    this.storageKey = `EXP_${apiKey.slice(0, 10)}_rtbt_events`;
    this.sessionManager = sessionManager;
    this.persistedEvents = persistedEvents;
    this.relayClient = relayClient ?? null;

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
    let fifoTrimmed = false;
    if (this.memoryCache.events.length > EventStorageManager.MAX_EVENTS) {
      this.memoryCache.events = this.memoryCache.events.slice(
        -EventStorageManager.MAX_EVENTS,
      );
      fifoTrimmed = true;
    }

    // Trigger debounced write to localStorage
    this.scheduleDebouncedWrite();

    // Fire-and-forget relay write when cross-subdomain sync is enabled
    if (fifoTrimmed) {
      this.syncRelayCacheAfterFifoTrim();
    } else {
      this.relayClient?.writeEvent(event);
    }
  }

  /**
   * Attach or detach the relay client for cross-subdomain dual-write.
   */
  setRelayClient(relayClient: RelayClient | null): void {
    this.relayClient = relayClient;
  }

  /**
   * Flushes pending relay writes (e.g. on page unload).
   */
  flushRelay(): void {
    this.relayClient?.flush();
  }

  /**
   * Merges relay events into the in-memory cache. Relay wins on dedup conflicts.
   */
  mergeFromRelay(relayStore: RelayEventStorage): void {
    const byKey = new Map<string, EventRecord>();
    for (const event of this.memoryCache.events) {
      byKey.set(eventDedupKey(event), event);
    }
    for (const event of relayStore.events) {
      byKey.set(eventDedupKey(event), event);
    }

    let events = Array.from(byKey.values()).sort(
      (a, b) => a.timestamp - b.timestamp,
    );
    if (events.length > EventStorageManager.MAX_EVENTS) {
      events = events.slice(-EventStorageManager.MAX_EVENTS);
    }

    let nextId = Math.max(this.memoryCache.nextId, relayStore.nextId);
    for (const event of events) {
      if (event.id + 1 > nextId) {
        nextId = event.id + 1;
      }
    }

    this.memoryCache = { events, nextId };
    this.hasPendingWrites = true;
    this.scheduleDebouncedWrite();
  }

  /**
   * Pass 2 sync: migrate local store to relay if needed, then merge relay events.
   * Returns true when sync completed; false when relay unavailable or RPC failed.
   */
  async syncFromRelay(): Promise<boolean> {
    const relay = this.relayClient;
    if (!relay?.relayAvailable) {
      return false;
    }

    try {
      const origin = window.location.origin;
      const migrated = await relay.checkMigrated(origin);

      if (!migrated && this.memoryCache.events.length > 0) {
        await relay.migrateEvents(origin, {
          events: [...this.memoryCache.events],
          nextId: this.memoryCache.nextId,
        });
      } else if (migrated && this.memoryCache.events.length > 0) {
        const existingRelayStore = await relay.readEvents();
        const relayKeys = new Set(
          existingRelayStore.events.map((e) => eventDedupKey(e)),
        );
        for (const event of this.memoryCache.events) {
          if (!relayKeys.has(eventDedupKey(event))) {
            relay.writeEvent(event);
          }
        }
      }

      const relayStore = await relay.readEvents();
      this.mergeFromRelay(relayStore);
      return true;
    } catch {
      return false;
    }
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
    this.flushRelay();
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
  private syncRelayCacheAfterFifoTrim(): void {
    const relay = this.relayClient;
    if (!relay?.relayAvailable) {
      return;
    }
    for (const event of this.memoryCache.events) {
      relay.writeEvent(event);
    }
  }

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
    this.flushRelay();
  };

  /**
   * Handler for visibilitychange event.
   */
  private handleVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden') {
      this.flushToLocalStorage();
      this.flushRelay();
    }
  };

  /**
   * Cleanup method to remove event listeners.
   * Should be called when EventStorageManager is no longer needed.
   */
  cleanup(): void {
    // Flush any pending writes
    this.flushToLocalStorage();
    this.flushRelay();

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
