import { EvaluationFlag } from '@amplitude/experiment-core';

export const isNullOrUndefined = (value: unknown): boolean => {
  return value === null || value === undefined;
};

export const isNullUndefinedOrEmpty = (value: unknown): boolean => {
  if (isNullOrUndefined(value)) return true;
  return value && Object.keys(value).length === 0;
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
