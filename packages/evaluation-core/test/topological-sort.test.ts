import { EvaluationFlag } from '../src';
import { topologicalSort as _topologicalSort } from '../src/topological-sort';

test('empty', () => {
  // No flag keys
  {
    const flags: EvaluationFlag[] = [];
    const result = topologicalSort(flags);
    expect(result).toEqual([]);
  }
  // With flag keys
  {
    const flags: EvaluationFlag[] = [];
    const result = topologicalSort(flags, ['1']);
    expect(result).toEqual([]);
  }
});

test('single flag no dependencies', () => {
  // No flag keys
  {
    const flags: EvaluationFlag[] = [flag(1)];
    const result = topologicalSort(flags);
    expect(result).toEqual([flag(1)]);
  }
  // With flag keys
  {
    const flags: EvaluationFlag[] = [flag(1)];
    const result = topologicalSort(flags, ['1']);
    expect(result).toEqual([flag(1)]);
  }
  // With flag keys, no match
  {
    const flags: EvaluationFlag[] = [flag(1)];
    const result = topologicalSort(flags, ['999']);
    expect(result).toEqual([]);
  }
});

test('single flag with dependencies', () => {
  // No flag keys
  {
    const flags: EvaluationFlag[] = [flag(1, [2])];
    const result = topologicalSort(flags);
    expect(result).toEqual([flag(1, [2])]);
  }
  // With flag keys
  {
    const flags: EvaluationFlag[] = [flag(1, [2])];
    const result = topologicalSort(flags, ['1']);
    expect(result).toEqual([flag(1, [2])]);
  }
  // With flag keys, no match
  {
    const flags: EvaluationFlag[] = [flag(1, [2])];
    const result = topologicalSort(flags, ['999']);
    expect(result).toEqual([]);
  }
});

test('multiple flags no dependencies', () => {
  // No flag keys
  {
    const flags: EvaluationFlag[] = [flag(1), flag(2)];
    const result = topologicalSort(flags);
    expect(result).toEqual([flag(1), flag(2)]);
  }
  // With flag keys
  {
    const flags: EvaluationFlag[] = [flag(1), flag(2)];
    const result = topologicalSort(flags, ['1', '2']);
    expect(result).toEqual([flag(1), flag(2)]);
  }
  // With flag keys, no match
  {
    const flags: EvaluationFlag[] = [flag(1), flag(2)];
    const result = topologicalSort(flags, ['99', '999']);
    expect(result).toEqual([]);
  }
});

test('multiple flags with dependencies', () => {
  // No flag keys
  {
    const flags: EvaluationFlag[] = [flag(1, [2]), flag(2, [3]), flag(3)];
    const result = topologicalSort(flags);
    expect(result).toEqual([flag(3), flag(2, [3]), flag(1, [2])]);
  }
  // With flag keys
  {
    const flags: EvaluationFlag[] = [flag(1, [2]), flag(2, [3]), flag(3)];
    const result = topologicalSort(flags, ['1', '2']);
    expect(result).toEqual([flag(3), flag(2, [3]), flag(1, [2])]);
  }
  // With flag keys, no match
  {
    const flags: EvaluationFlag[] = [flag(1, [2]), flag(2, [3]), flag(3)];
    const result = topologicalSort(flags, ['99', '999']);
    expect(result).toEqual([]);
  }
});

test('single flag cycle', () => {
  // No flag keys
  {
    const flags: EvaluationFlag[] = [flag(1, [1])];
    expect(() => {
      return topologicalSort(flags);
    }).toThrow('Detected a cycle between flags 1');
  }
  // With flag keys
  {
    const flags: EvaluationFlag[] = [flag(1, [1])];
    expect(() => {
      return topologicalSort(flags, ['1']);
    }).toThrow('Detected a cycle between flags 1');
  }
  // With flag keys, no match
  {
    const flags: EvaluationFlag[] = [flag(1, [1])];
    expect(() => {
      return topologicalSort(flags, ['999']);
    }).not.toThrow();
  }
});

test('two flag cycle', () => {
  // No flag keys
  {
    const flags: EvaluationFlag[] = [flag(1, [2]), flag(2, [1])];
    expect(() => {
      return topologicalSort(flags);
    }).toThrow('Detected a cycle between flags 1,2');
  }
  // With flag keys
  {
    const flags: EvaluationFlag[] = [flag(1, [2]), flag(2, [1])];
    expect(() => {
      return topologicalSort(flags, ['2']);
    }).toThrow('Detected a cycle between flags 2,1');
  }
  // With flag keys, no match
  {
    const flags: EvaluationFlag[] = [flag(1, [2]), flag(2, [1])];
    expect(() => {
      return topologicalSort(flags, ['999']);
    }).not.toThrow();
  }
});

test('multiple flags complex cycle', () => {
  const flags = [
    flag(3, [1, 2]),
    flag(1),
    flag(4, [21, 3]),
    flag(2),
    flag(5, [3]),
    flag(6),
    flag(7),
    flag(8, [9]),
    flag(9),
    flag(20, [4]),
    flag(21, [20]),
  ];
  expect(() => {
    return topologicalSort(flags);
  }).toThrow('Detected a cycle between flags 4,21,20');
});

test('complex no cycle, starting with leaf', () => {
  const flags = [
    flag(1, [6, 3]),
    flag(2, [8, 5, 3, 1]),
    flag(3, [6, 5]),
    flag(4, [8, 7]),
    flag(5, [10, 7]),
    flag(7, [8]),
    flag(6, [7, 4]),
    flag(8),
    flag(9, [10, 7, 5]),
    flag(10, [7]),
    flag(20),
    flag(21, [20]),
    flag(30),
  ];
  const result = topologicalSort(flags);
  expect(result).toEqual([
    flag(8),
    flag(7, [8]),
    flag(4, [8, 7]),
    flag(6, [7, 4]),
    flag(10, [7]),
    flag(5, [10, 7]),
    flag(3, [6, 5]),
    flag(1, [6, 3]),
    flag(2, [8, 5, 3, 1]),
    flag(9, [10, 7, 5]),
    flag(20),
    flag(21, [20]),
    flag(30),
  ]);
});

test('complex no cycle, starting with middle', () => {
  const flags = [
    flag(6, [7, 4]),
    flag(1, [6, 3]),
    flag(2, [8, 5, 3, 1]),
    flag(3, [6, 5]),
    flag(4, [8, 7]),
    flag(5, [10, 7]),
    flag(7, [8]),
    flag(8),
    flag(9, [10, 7, 5]),
    flag(10, [7]),
    flag(20),
    flag(21, [20]),
    flag(30),
  ];
  const result = topologicalSort(flags);
  expect(result).toEqual([
    flag(8),
    flag(7, [8]),
    flag(4, [8, 7]),
    flag(6, [7, 4]),
    flag(10, [7]),
    flag(5, [10, 7]),
    flag(3, [6, 5]),
    flag(1, [6, 3]),
    flag(2, [8, 5, 3, 1]),
    flag(9, [10, 7, 5]),
    flag(20),
    flag(21, [20]),
    flag(30),
  ]);
});

test('complex no cycle, starting with root', () => {
  const flags = [
    flag(8),
    flag(1, [6, 3]),
    flag(2, [8, 5, 3, 1]),
    flag(3, [6, 5]),
    flag(4, [8, 7]),
    flag(5, [10, 7]),
    flag(7, [8]),
    flag(6, [7, 4]),
    flag(9, [10, 7, 5]),
    flag(10, [7]),
    flag(20),
    flag(21, [20]),
    flag(30),
  ];
  const result = topologicalSort(flags);
  expect(result).toEqual([
    flag(8),
    flag(7, [8]),
    flag(4, [8, 7]),
    flag(6, [7, 4]),
    flag(10, [7]),
    flag(5, [10, 7]),
    flag(3, [6, 5]),
    flag(1, [6, 3]),
    flag(2, [8, 5, 3, 1]),
    flag(9, [10, 7, 5]),
    flag(20),
    flag(21, [20]),
    flag(30),
  ]);
});

const topologicalSort = (
  flags: EvaluationFlag[],
  flagKeys?: string[],
): EvaluationFlag[] => {
  const flagsMap = flags.reduce((map: Record<string, EvaluationFlag>, flag) => {
    map[flag.key] = flag;
    return map;
  }, {});
  return _topologicalSort(flagsMap, flagKeys);
};

const flag = (key: number, dependencies?: number[]): EvaluationFlag => {
  return {
    key: String(key),
    variants: {},
    segments: [],
    dependencies: dependencies?.map((i) => String(i)),
  };
};
