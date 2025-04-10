import { EvaluationCondition } from '@amplitude/experiment-core';

import { MessageType } from './message-bus';

export type ApplyVariantsOptions = {
  /**
   * A list of flag keys to apply.
   */
  flagKeys?: string[];
};

export type RevertVariantsOptions = {
  /**
   * A list of flag keys to revert.
   */
  flagKeys?: string[];
};

export type PreviewVariantsOptions = {
  /**
   * A map of flag keys to variant keys to be previewed.
   */
  keyToVariant?: Record<string, string>;
};

export type PageObject = {
  conditions?: EvaluationCondition[][];
  trigger_type: MessageType;
  trigger_value: Record<string, unknown>;
};

export type PageObjects = Record<string, Record<string, PageObject>>;
