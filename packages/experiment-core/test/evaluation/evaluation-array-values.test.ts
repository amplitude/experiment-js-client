import {
  EvaluationEngine,
  EvaluationFlag,
  EvaluationOperator,
} from '../../src';

const engine = new EvaluationEngine();

const flagWithCondition = (op: string, values: string[]): EvaluationFlag[] => {
  return [
    {
      key: 'test-flag',
      variants: { on: { key: 'on' }, off: { key: 'off' } },
      segments: [
        {
          conditions: [
            [
              {
                selector: ['context', 'user', 'user_properties', 'test_prop'],
                op,
                values,
              },
            ],
          ],
          variant: 'on',
        },
      ],
    },
  ];
};

const contextWithProp = (value: unknown): Record<string, unknown> => ({
  user: { user_properties: { test_prop: value } },
});

const evaluate = (
  propValue: unknown,
  op: string,
  values: string[],
): string | undefined => {
  const flags = flagWithCondition(op, values);
  const context = contextWithProp(propValue);
  return engine.evaluate(context, flags)['test-flag']?.key;
};

const assertMatch = (propValue: unknown, op: string, values: string[]) => {
  expect(evaluate(propValue, op, values)).toEqual('on');
};

const assertNoMatch = (propValue: unknown, op: string, values: string[]) => {
  expect(evaluate(propValue, op, values)).toBeUndefined();
};

// Scalar values still work with non-set operators

test('scalar string IS match', () => {
  assertMatch('hello', EvaluationOperator.IS, ['hello']);
});

test('scalar string CONTAINS match', () => {
  assertMatch('hello', EvaluationOperator.CONTAINS, ['ell']);
});

test('scalar string GREATER_THAN match', () => {
  assertMatch('2', EvaluationOperator.GREATER_THAN, ['1']);
});

test('scalar string IS no match', () => {
  assertNoMatch('world', EvaluationOperator.IS, ['hello']);
});

test('non-string scalar GREATER_THAN', () => {
  assertMatch(42, EvaluationOperator.GREATER_THAN, ['1']);
});

test('non-string scalar IS', () => {
  assertMatch(true, EvaluationOperator.IS, ['true']);
});

// JSON array strings with set operators (existing behavior)

test('JSON array string + set operator', () => {
  assertMatch('["a","b"]', EvaluationOperator.SET_CONTAINS, ['a']);
});

// JSON array strings with non-set operators (new behavior)

test('JSON array string + non-set operator', () => {
  assertMatch('["a","b"]', EvaluationOperator.IS, ['a']);
});

// Native arrays with set operators (existing behavior)

test('collection + set operator', () => {
  assertMatch(['a', 'b'], EvaluationOperator.SET_CONTAINS, ['a']);
});

// Native arrays with non-set operators (new behavior)

test('collection + non-set operator', () => {
  assertMatch(['a', 'b'], EvaluationOperator.IS, ['a']);
});

// Edge cases

test('malformed JSON array falls through to scalar match', () => {
  assertMatch('[broken', EvaluationOperator.IS, ['[broken']);
});

test('empty JSON array + set operator', () => {
  assertNoMatch('[]', EvaluationOperator.SET_CONTAINS, ['a']);
});

test('leading whitespace not parsed as array', () => {
  assertMatch(' ["a"]', EvaluationOperator.IS, [' ["a"]']);
});

test('leading whitespace not parsed as array (set)', () => {
  assertNoMatch(' ["a"]', EvaluationOperator.SET_CONTAINS, ['a']);
});
