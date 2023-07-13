export type EvaluationFlag = {
  key: string;
  variants: Record<string, EvaluationVariant>;
  segments: EvaluationSegment[];
  dependencies?: string[];
  metadata?: Record<string, any>;
};

export type EvaluationVariant = {
  key: string;
  value?: any;
  payload?: Record<string, any>;
  metadata?: Record<string, any>;
};

export type EvaluationSegment = {
  bucket?: EvaluationBucket;
  conditions?: EvaluationCondition[][];
  defaultVariant?: string;
  metadata?: Record<string, any>;
};

export type EvaluationBucket = {
  selector: string[];
  salt: string;
  allocations: EvaluationAllocation[];
};

export type EvaluationCondition = {
  selector: string[];
  op: string;
  values: string[];
};

export type EvaluationAllocation = {
  range: number[];
  distributions: EvaluationDistribution[];
};

export type EvaluationDistribution = {
  variant: string;
  range: number[];
};

export const EvaluationOperator = {
  IS: 'is',
  IS_NOT: 'is not',
  CONTAINS: 'contains',
  DOES_NOT_CONTAIN: 'does not contain',
  LESS_THAN: 'less',
  LESS_THAN_EQUALS: 'less or equal',
  GREATER_THAN: 'greater',
  GREATER_THAN_EQUALS: 'greater or equal',
  VERSION_LESS_THAN: 'version less',
  VERSION_LESS_THAN_EQUALS: 'version less or equal',
  VERSION_GREATER_THAN: 'version greater',
  VERSION_GREATER_THAN_EQUALS: 'version greater or equal',
  SET_IS: 'set is',
  SET_IS_NOT: 'set is not',
  SET_CONTAINS: 'set contains',
  SET_DOES_NOT_CONTAIN: 'set does not contain',
  SET_CONTAINS_ANY: 'set contains any',
  REGEX_MATCH: 'regex match',
  REGEX_DOES_NOT_MATCH: 'regex does not match',
};
