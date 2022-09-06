import { isEqual } from 'src/util/equals';

describe('isEqual', () => {
  test('isEqual, one null on non-null, is false', () => {
    const actual = isEqual('non-null', null);
    expect(actual).toEqual(false);
  });

  test('isEqual, two null, is true', () => {
    const actual = isEqual(null, null);
    expect(actual).toEqual(true);
  });

  test('isEqual, two non-null equals, is true', () => {
    const actual = isEqual('non-null', 'non-null');
    expect(actual).toEqual(true);
  });
});
