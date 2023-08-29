import { EvaluationOperator } from '../../src';
import { SemanticVersion } from '../../src/evaluation/semantic-version';

test('invalid versions', () => {
  // just major
  assertInvalidVersion('10');
  // trailing dots
  assertInvalidVersion('10.');
  assertInvalidVersion('10..');
  assertInvalidVersion('10.2.');
  assertInvalidVersion('10.2.33.');
  // trailing dots on prerelease tags are not handled because prerelease tags are considered
  // strings anyway for comparison which should be fine - e.g. "10.2.33-alpha1.2."

  // dots in the middle
  assertInvalidVersion('10..2.33');
  assertInvalidVersion('102...33');

  // invalid characters
  assertInvalidVersion('a.2.3');
  assertInvalidVersion('23!');
  assertInvalidVersion('23.#5');
  assertInvalidVersion('');
  assertInvalidVersion(undefined);

  // more numbers
  assertInvalidVersion('2.3.4.567');
  assertInvalidVersion('2.3.4.5.6.7');

  // prerelease if provided should always have major, minor, patch
  assertInvalidVersion('10.2.alpha');
  assertInvalidVersion('10.alpha');
  assertInvalidVersion('alpha-1.2.3');

  // prerelease should be separated by a hyphen after patch
  assertInvalidVersion('10.2.3alpha');
  assertInvalidVersion('10.2.3alpha-1.2.3');

  // negative numbers
  assertInvalidVersion('-10.1');
  assertInvalidVersion('10.-1');
});

test('valid versions', () => {
  assertValidVersion('100.2');
  assertValidVersion('0.102.39');
  assertValidVersion('0.0.0');

  // versions with leading 0s would be converted to int
  assertValidVersion('01.02');
  assertValidVersion('001.001100.000900');

  // prerelease tags
  assertValidVersion('10.20.30-alpha');
  assertValidVersion('10.20.30-1.x.y');
  assertValidVersion('10.20.30-aslkjd');
  assertValidVersion('10.20.30-b894');
  assertValidVersion('10.20.30-b8c9');
});

test('version comparison', () => {
  // EQUALS case
  assertVersionComparison('66.12.23', EvaluationOperator.IS, '66.12.23');
  // patch if not specified equals 0
  assertVersionComparison('5.6', EvaluationOperator.IS, '5.6.0');
  // leading 0s are not stored when parsed
  assertVersionComparison('06.007.0008', EvaluationOperator.IS, '6.7.8');
  // with pre-release
  assertVersionComparison(
    '1.23.4-b-1.x.y',
    EvaluationOperator.IS,
    '1.23.4-b-1.x.y',
  );

  // DOES NOT EQUAL case
  assertVersionComparison(
    '1.23.4-alpha-1.2',
    EvaluationOperator.IS_NOT,
    '1.23.4-alpha-1',
  );
  // trailing 0s aren't stripped
  assertVersionComparison('1.2.300', EvaluationOperator.IS_NOT, '1.2.3');
  assertVersionComparison('1.20.3', EvaluationOperator.IS_NOT, '1.2.3');

  // LESS THAN case
  // patch of .1 makes it greater
  assertVersionComparison(
    '50.2',
    EvaluationOperator.VERSION_LESS_THAN,
    '50.2.1',
  );
  // minor 9 > minor 20
  assertVersionComparison(
    '20.9',
    EvaluationOperator.VERSION_LESS_THAN,
    '20.20',
  );
  // same version with pre-release should be lesser
  assertVersionComparison(
    '20.9.4-alpha1',
    EvaluationOperator.VERSION_LESS_THAN,
    '20.9.4',
  );
  // compare prerelease as strings
  assertVersionComparison(
    '20.9.4-a-1.2.3',
    EvaluationOperator.VERSION_LESS_THAN,
    '20.9.4-a-1.3',
  );
  // since prerelease is compared as strings a1.23 < a1.5 because 2 < 5
  assertVersionComparison(
    '20.9.4-a1.23',
    EvaluationOperator.VERSION_LESS_THAN,
    '20.9.4-a1.5',
  );

  // GREATER THAN case
  assertVersionComparison(
    '12.30.2',
    EvaluationOperator.VERSION_GREATER_THAN,
    '12.4.1',
  );
  // 100 > 1
  assertVersionComparison(
    '7.100',
    EvaluationOperator.VERSION_GREATER_THAN,
    '7.1',
  );
  // 10 > 9
  assertVersionComparison(
    '7.10',
    EvaluationOperator.VERSION_GREATER_THAN,
    '7.9',
  );
  // converts to 7.10.20 > 7.9.1
  assertVersionComparison(
    '07.010.0020',
    EvaluationOperator.VERSION_GREATER_THAN,
    '7.009.1',
  );
  // patch comparison comes first
  assertVersionComparison(
    '20.5.6-b1.2.x',
    EvaluationOperator.VERSION_GREATER_THAN,
    '20.5.5',
  );
});

const assertInvalidVersion = (version: string | undefined): void => {
  expect(SemanticVersion.parse(version)).toBeUndefined();
};
const assertValidVersion = (version: string): void => {
  expect(SemanticVersion.parse(version)).not.toBeUndefined();
};

const assertVersionComparison = (v1: string, op: string, v2: string): void => {
  const sv1 = SemanticVersion.parse(v1);
  const sv2 = SemanticVersion.parse(v2);
  expect(sv1).not.toBeUndefined();
  expect(sv2).not.toBeUndefined();
  if (!sv1 || !sv2) return;
  if (op === EvaluationOperator.IS) {
    expect(sv1.compareTo(sv2)).toEqual(0);
  } else if (op === EvaluationOperator.IS_NOT) {
    expect(sv1.compareTo(sv2)).not.toEqual(0);
  } else if (op === EvaluationOperator.VERSION_LESS_THAN) {
    expect(sv1.compareTo(sv2)).toBeLessThan(0);
  } else if (op === EvaluationOperator.VERSION_GREATER_THAN) {
    expect(sv1.compareTo(sv2)).toBeGreaterThan(0);
  }
};
