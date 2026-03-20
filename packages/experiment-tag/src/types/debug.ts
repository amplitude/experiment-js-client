import type { MessageType } from '../subscriptions/message-bus';

// --- Top-level debug state ---

export interface DebugState {
  flags: Record<string, FlagDebugInfo>;
  visualEditor: VisualEditorDebugInfo;
  currentUrl: string;
  timestamp: number;
}

// --- Per-flag debug info ---

export interface FlagDebugInfo {
  flagKey: string;
  variant: VariantDebugInfo | null;
  isActive: boolean;
  pageObjects: PageObjectDebugInfo[];
}

export interface VariantDebugInfo {
  key: string;
  value?: string;
}

// --- Per-page-object debug info ---

export interface PageObjectDebugInfo {
  id: string;
  name: string;
  urlConditionsPassed: boolean;
  triggerPassed: boolean;
  trigger: TriggerDebugInfo;
  overallStatus: 'pass' | 'fail';
}

// --- Trigger debug info (discriminated union on `type`) ---

export type TriggerDebugInfo =
  | UrlChangeTriggerDebugInfo
  | ElementAppearedTriggerDebugInfo
  | ElementVisibleTriggerDebugInfo
  | ManualTriggerDebugInfo
  | AnalyticsEventTriggerDebugInfo
  | UserInteractionTriggerDebugInfo
  | ExitIntentTriggerDebugInfo
  | TimeOnPageTriggerDebugInfo
  | ScrolledToTriggerDebugInfo;

interface TriggerDebugInfoBase {
  type: MessageType;
  passed: boolean;
}

export interface UrlChangeTriggerDebugInfo extends TriggerDebugInfoBase {
  type: 'url_change';
}

export interface ElementAppearedTriggerDebugInfo extends TriggerDebugInfoBase {
  type: 'element_appeared';
  config: { selector: string };
}

export interface ElementVisibleTriggerDebugInfo extends TriggerDebugInfoBase {
  type: 'element_visible';
  config: { selector: string; visibilityRatio: number };
}

export interface ManualTriggerDebugInfo extends TriggerDebugInfoBase {
  type: 'manual';
  config: { name: string };
}

export interface AnalyticsEventTriggerDebugInfo extends TriggerDebugInfoBase {
  type: 'analytics_event';
  config: { conditions: unknown };
}

export interface UserInteractionTriggerDebugInfo extends TriggerDebugInfoBase {
  type: 'user_interaction';
  config: {
    selector: string;
    interactionType: string;
    minThresholdMs: number;
  };
}

export interface ExitIntentTriggerDebugInfo extends TriggerDebugInfoBase {
  type: 'exit_intent';
  config: { minTimeOnPageMs?: number };
}

export interface TimeOnPageTriggerDebugInfo extends TriggerDebugInfoBase {
  type: 'time_on_page';
  config: { durationMs: number };
  elapsedMs: number;
}

export interface ScrolledToTriggerDebugInfo extends TriggerDebugInfoBase {
  type: 'scrolled_to';
  config:
    | { mode: 'percent'; percentage: number }
    | { mode: 'element'; selector: string; offsetPx?: number };
  currentPercentage?: number;
}

// --- Visual editor debug info ---

export interface VisualEditorDebugInfo {
  isActive: boolean;
}
