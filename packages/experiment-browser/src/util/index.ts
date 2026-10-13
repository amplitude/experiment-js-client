import { EvaluationFlag } from '@amplitude/experiment-core';

export const isNullOrUndefined = (value: unknown): boolean => {
  return value === null || value === undefined;
};

export const isNullUndefinedOrEmpty = (value: unknown): boolean => {
  if (isNullOrUndefined(value)) return true;
  return value && Object.keys(value).length === 0;
};

/**
 * Filters out null and undefined values from an object, returning a new object
 * with only defined values. This is useful for config merging where you want
 * defaults to take precedence over explicit null/undefined values.
 */
export const filterNullUndefined = <T extends object>(obj: T): Partial<T> => {
  if (!obj || typeof obj !== 'object') {
    return {};
  }

  const filtered: Partial<T> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (!isNullOrUndefined(value)) {
      filtered[key as keyof T] = value as T[keyof T];
    }
  }
  return filtered;
};

/**
 * Returns a string that is equal for equal groups, regardless of group type or
 * group name order. Returns undefined if there are no groups.
 */
export const groupsKey = (
  groups: Record<string, string[]> | undefined,
): string | undefined => {
  if (isNullUndefinedOrEmpty(groups)) return undefined;
  return JSON.stringify(
    Object.keys(groups)
      .sort()
      .map((groupType) => [groupType, [...groups[groupType]].sort()]),
  );
};

export const isLocalEvaluationMode = (
  flag: EvaluationFlag | undefined,
): boolean => {
  return flag?.metadata?.evaluationMode === 'local';
};

export const isRemoteEvaluationMode = (
  flag: EvaluationFlag | undefined,
): boolean => {
  return flag?.metadata?.evaluationMode === 'remote';
};
