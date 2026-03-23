import type {
  DebugEvent,
  DebugState,
  FlagDebugInfo,
  VEMessengerState,
  VisualEditorDebugInfo,
} from '../types/debug';

/**
 * Provides the non-event, non-timestamp parts of DebugState.
 * Registered once during client.start() so DebugRecorder can
 * assemble the full snapshot without depending on specific modules.
 */
type StateProvider = () => {
  flags: Record<string, FlagDebugInfo>;
  visualEditor: Omit<VisualEditorDebugInfo, 'messengerState'>;
  currentUrl: string;
};

const events: DebugEvent[] = [];
let active = false;
let messengerState: VEMessengerState = 'not_started';
let stateProvider: StateProvider | null = null;

export const DebugRecorder = {
  /**
   * Evaluate activation signals. Must be called before any other method.
   * Checks window.__AMP_DEBUG and localStorage('amp-ve-debug').
   */
  init: (globalScope: typeof globalThis) => {
    if ((globalScope as Record<string, unknown>).__AMP_DEBUG === true) {
      active = true;
      return;
    }
    try {
      active = globalScope.localStorage?.getItem('amp-ve-debug') === 'true';
    } catch {
      active = false;
    }
  },

  isActive: (): boolean => active,

  /** Append a debug event. No-op when not active. */
  push: (event: string, detail?: string) => {
    if (!active) return;
    events.push({ timestamp: Date.now(), event, detail });
  },

  getEvents: (): DebugEvent[] => events,

  setMessengerState: (state: VEMessengerState) => {
    messengerState = state;
  },

  getMessengerState: (): VEMessengerState => messengerState,

  /**
   * Register a callback that provides flag/variant/VE data for snapshots.
   * Called once during client.start().
   */
  registerStateProvider: (provider: StateProvider) => {
    stateProvider = provider;
  },

  /**
   * Assemble the full debug state snapshot.
   * Combines registered state provider data with event log and messenger state.
   */
  getDebugState: (): DebugState => {
    const snapshot = stateProvider?.() ?? {
      flags: {},
      visualEditor: { isActive: false },
      currentUrl: '',
    };
    return {
      flags: snapshot.flags,
      visualEditor: {
        ...snapshot.visualEditor,
        messengerState,
      },
      events,
      currentUrl: snapshot.currentUrl,
      timestamp: Date.now(),
    };
  },
};
