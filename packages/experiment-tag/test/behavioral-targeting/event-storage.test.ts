import { EventStorageManager } from 'src/behavioral-targeting/event-storage';
import { SessionManager } from 'src/behavioral-targeting/session-manager';

describe('EventStorageManager', () => {
  let eventStorage: EventStorageManager;
  let sessionManager: SessionManager;

  beforeEach(() => {
    // Clear storage before each test
    localStorage.clear();
    sessionStorage.clear();
    sessionManager = new SessionManager();
    eventStorage = new EventStorageManager(sessionManager);
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('addEvent', () => {
    test('should add event with automatic session tracking', () => {
      eventStorage.addEvent('click', { button: 'submit' });

      const events = eventStorage.getAllEvents();
      expect(events).toHaveLength(1);
      expect(events[0].event_type).toBe('click');
      expect(events[0].properties).toEqual({ button: 'submit' });
      expect(events[0].session_id).toBeDefined();
      expect(events[0].timestamp).toBeDefined();
      expect(events[0].id).toBe(1);
    });

    test('should add multiple events with incrementing IDs', () => {
      eventStorage.addEvent('click');
      eventStorage.addEvent('view');
      eventStorage.addEvent('purchase');

      const events = eventStorage.getAllEvents();
      expect(events).toHaveLength(3);
      expect(events[0].id).toBe(1);
      expect(events[1].id).toBe(2);
      expect(events[2].id).toBe(3);
    });

    test('should persist events to localStorage', () => {
      eventStorage.addEvent('click', { button: 'submit' });
      eventStorage.flush(); // Flush debounced write for testing

      const stored = localStorage.getItem('amplitude_rtbt_events');
      expect(stored).toBeDefined();

      const data = JSON.parse(stored!);
      expect(data.events).toHaveLength(1);
      expect(data.events[0].event_type).toBe('click');
      expect(data.nextId).toBe(2);
    });

    test('should load existing events from localStorage', () => {
      eventStorage.addEvent('click');
      eventStorage.flush(); // Flush to localStorage before creating new instance

      // Create new manager instance (simulates page reload)
      const newEventStorage = new EventStorageManager(sessionManager);
      newEventStorage.addEvent('view');

      const events = newEventStorage.getAllEvents();
      expect(events).toHaveLength(2);
      expect(events[0].event_type).toBe('click');
      expect(events[1].event_type).toBe('view');
      expect(events[1].id).toBe(2);
    });

    test('should handle empty properties', () => {
      eventStorage.addEvent('click');

      const events = eventStorage.getAllEvents();
      expect(events[0].properties).toEqual({});
    });

    test('should apply FIFO limit of 500 events', () => {
      // Add 501 events
      for (let i = 0; i < 501; i++) {
        eventStorage.addEvent('test', { index: i });
      }

      const events = eventStorage.getAllEvents();
      expect(events).toHaveLength(500);

      // First event should be removed (FIFO)
      expect(events[0].properties.index).toBe(1);
      expect(events[499].properties.index).toBe(500);
    });

    test('should handle invalid JSON in localStorage', () => {
      localStorage.setItem('amplitude_rtbt_events', 'invalid json');

      eventStorage.addEvent('click');

      const events = eventStorage.getAllEvents();
      expect(events).toHaveLength(1);
      expect(events[0].id).toBe(1);
    });
  });

  describe('getAllEvents', () => {
    test('should return empty array when no events exist', () => {
      const events = eventStorage.getAllEvents();
      expect(events).toEqual([]);
    });

    test('should return all events', () => {
      eventStorage.addEvent('click');
      eventStorage.addEvent('view');
      eventStorage.addEvent('purchase');

      const events = eventStorage.getAllEvents();
      expect(events).toHaveLength(3);
    });
  });

  describe('getEventsByType', () => {
    beforeEach(() => {
      eventStorage.addEvent('click', { button: 'submit' });
      eventStorage.addEvent('view', { page: 'home' });
      eventStorage.addEvent('click', { button: 'cancel' });
      eventStorage.addEvent('purchase', { amount: 100 });
    });

    test('should filter events by type', () => {
      const clicks = eventStorage.getEventsByType('click');
      expect(clicks).toHaveLength(2);
      expect(clicks[0].properties.button).toBe('submit');
      expect(clicks[1].properties.button).toBe('cancel');
    });

    test('should return empty array for non-existent type', () => {
      const events = eventStorage.getEventsByType('nonexistent');
      expect(events).toEqual([]);
    });
  });

  describe('getEventsInTimeWindow', () => {
    describe('current_session mode', () => {
      test('should return only events from current session', () => {
        const sessionId1 = sessionManager.getOrCreateSessionId();
        eventStorage.addEvent('click');
        eventStorage.addEvent('view');

        // Clear and create new session
        sessionManager.clearSession();
        const sessionId2 = sessionManager.getOrCreateSessionId();
        eventStorage.addEvent('click');

        const currentSessionEvents = eventStorage.getEventsInTimeWindow(
          'click',
          'current_session',
          0,
        );

        expect(currentSessionEvents).toHaveLength(1);
        expect(currentSessionEvents[0].session_id).toBe(sessionId2);
      });

      test('should filter by event type within session', () => {
        eventStorage.addEvent('click');
        eventStorage.addEvent('view');
        eventStorage.addEvent('click');

        const events = eventStorage.getEventsInTimeWindow(
          'click',
          'current_session',
          0,
        );

        expect(events).toHaveLength(2);
        expect(events.every((e) => e.event_type === 'click')).toBe(true);
      });
    });

    describe('rolling time window mode', () => {
      beforeEach(() => {
        jest.useFakeTimers();
      });

      afterEach(() => {
        jest.useRealTimers();
      });

      test('should filter events by rolling time window in hours', () => {
        const now = Date.now();
        jest.setSystemTime(now);

        eventStorage.addEvent('click');

        // Move forward 30 minutes
        jest.setSystemTime(now + 30 * 60 * 1000);
        eventStorage.addEvent('click');

        // Move forward 2 hours (total 2.5 hours)
        jest.setSystemTime(now + 2.5 * 60 * 60 * 1000);
        eventStorage.addEvent('click');

        // Get events from last 1 hour
        const events = eventStorage.getEventsInTimeWindow(
          'click',
          'rolling',
          1,
          'hour',
        );

        expect(events).toHaveLength(1);
        expect(events[0].timestamp).toBeGreaterThanOrEqual(
          now + 1.5 * 60 * 60 * 1000,
        );
      });

      test('should filter events by rolling time window in days', () => {
        const now = Date.now();
        jest.setSystemTime(now);

        eventStorage.addEvent('click');

        // Move forward 12 hours
        jest.setSystemTime(now + 12 * 60 * 60 * 1000);
        eventStorage.addEvent('click');

        // Move forward 2 days (total 2.5 days)
        jest.setSystemTime(now + 2.5 * 24 * 60 * 60 * 1000);
        eventStorage.addEvent('click');

        // Get events from last 1 day
        const events = eventStorage.getEventsInTimeWindow(
          'click',
          'rolling',
          1,
          'day',
        );

        expect(events).toHaveLength(1);
      });

      test('should return all events if within time window', () => {
        const now = Date.now();
        jest.setSystemTime(now);

        eventStorage.addEvent('click');
        eventStorage.addEvent('click');
        eventStorage.addEvent('click');

        // Move forward 30 minutes
        jest.setSystemTime(now + 30 * 60 * 1000);

        const events = eventStorage.getEventsInTimeWindow(
          'click',
          'rolling',
          1,
          'hour',
        );

        expect(events).toHaveLength(3);
      });

      test('should return empty array if all events outside window', () => {
        const now = Date.now();
        jest.setSystemTime(now);

        eventStorage.addEvent('click');

        // Move forward 25 hours
        jest.setSystemTime(now + 25 * 60 * 60 * 1000);

        const events = eventStorage.getEventsInTimeWindow(
          'click',
          'rolling',
          1,
          'hour',
        );

        expect(events).toEqual([]);
      });
    });
  });

  describe('getEventCount', () => {
    test('should return count of events by type', () => {
      eventStorage.addEvent('click');
      eventStorage.addEvent('view');
      eventStorage.addEvent('click');
      eventStorage.addEvent('click');

      expect(eventStorage.getEventCount('click')).toBe(3);
      expect(eventStorage.getEventCount('view')).toBe(1);
      expect(eventStorage.getEventCount('purchase')).toBe(0);
    });
  });

  describe('getEventCountInTimeWindow', () => {
    test('should return count for current session', () => {
      eventStorage.addEvent('click');
      eventStorage.addEvent('click');

      sessionManager.clearSession();
      eventStorage.addEvent('click');

      const count = eventStorage.getEventCountInTimeWindow(
        'click',
        'current_session',
        0,
      );

      expect(count).toBe(1);
    });

    test('should return count for rolling window', () => {
      jest.useFakeTimers();
      const now = Date.now();
      jest.setSystemTime(now);

      eventStorage.addEvent('click');
      eventStorage.addEvent('click');

      jest.setSystemTime(now + 2 * 60 * 60 * 1000);
      eventStorage.addEvent('click');

      const count = eventStorage.getEventCountInTimeWindow(
        'click',
        'rolling',
        1,
        'hour',
      );

      expect(count).toBe(1);

      jest.useRealTimers();
    });
  });

  describe('clearEvents', () => {
    test('should clear all events', () => {
      eventStorage.addEvent('click');
      eventStorage.addEvent('view');
      eventStorage.addEvent('purchase');

      eventStorage.clearEvents();

      const events = eventStorage.getAllEvents();
      expect(events).toEqual([]);
    });

    test('should remove localStorage entry', () => {
      eventStorage.addEvent('click');
      eventStorage.clearEvents();

      const stored = localStorage.getItem('amplitude_rtbt_events');
      expect(stored).toBeDefined();

      const data = JSON.parse(stored!);
      expect(data.events).toEqual([]);
      expect(data.nextId).toBe(1);
    });

    test('should reset ID counter', () => {
      eventStorage.addEvent('click');
      eventStorage.addEvent('click');
      eventStorage.clearEvents();
      eventStorage.addEvent('click');

      const events = eventStorage.getAllEvents();
      expect(events[0].id).toBe(1);
    });
  });

  describe('session tracking across instances', () => {
    test('should maintain same session across manager instances', () => {
      const sessionId = sessionManager.getOrCreateSessionId();
      eventStorage.addEvent('click');
      eventStorage.flush(); // Flush to localStorage before creating new instance

      // Create new instances (simulates page navigation)
      const newSessionManager = new SessionManager();
      const newEventStorage = new EventStorageManager(newSessionManager);
      newEventStorage.addEvent('view');

      const events = newEventStorage.getAllEvents();
      expect(events).toHaveLength(2);
      expect(events[0].session_id).toBe(sessionId);
      expect(events[1].session_id).toBe(sessionId);
    });
  });

  describe('timestamp accuracy', () => {
    test('should use current timestamp for events', () => {
      const before = Date.now();
      eventStorage.addEvent('click');
      const after = Date.now();

      const events = eventStorage.getAllEvents();
      expect(events[0].timestamp).toBeGreaterThanOrEqual(before);
      expect(events[0].timestamp).toBeLessThanOrEqual(after);
    });
  });
});
