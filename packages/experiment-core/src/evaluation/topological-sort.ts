import { EvaluationFlag } from './flag';

export const topologicalSort = (
  flags: Record<string, EvaluationFlag>,
  flagKeys?: string[],
): EvaluationFlag[] => {
  const available: Record<string, EvaluationFlag> = { ...flags };
  const result: EvaluationFlag[] = [];
  const startingKeys = flagKeys || Object.keys(available);
  for (const flagKey of startingKeys) {
    const traversal = parentTraversal(flagKey, available);
    if (traversal) {
      result.push(...traversal);
    }
  }
  return result;
};

const parentTraversal = (
  flagKey: string,
  available: Record<string, EvaluationFlag>,
  path: string[] = [],
): EvaluationFlag[] | undefined => {
  const flag = available[flagKey];
  if (!flag) {
    return undefined;
  } else if (!flag.dependencies || flag.dependencies.length === 0) {
    delete available[flag.key];
    return [flag];
  }
  path.push(flag.key);
  const result: EvaluationFlag[] = [];
  for (const parentKey of flag.dependencies) {
    if (path.some((p) => p === parentKey)) {
      throw Error(`Detected a cycle between flags ${path}`);
    }
    const traversal = parentTraversal(parentKey, available, path);
    if (traversal) {
      result.push(...traversal);
    }
  }
  result.push(flag);
  path.pop();
  delete available[flag.key];
  return result;
};
