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

  test('isEqual, user objects with null user ids, is true', () => {
    const actual = isEqual({ user_id: null }, { user_id: null });
    expect(actual).toEqual(true);
  });

  test('isEqual, empty objects, true', () => {
    const actual = isEqual({}, {});
    expect(actual).toEqual(true);
  });

  test('isEqual, undefined, true', () => {
    const actual = isEqual(undefined, undefined);
    expect(actual).toEqual(true);
  });

  test('isEqual, undefined and null, true', () => {
    const actual = isEqual(undefined, null);
    expect(actual).toEqual(true);
  });

  test('isEqual, undefined and string, false', () => {
    const actual = isEqual(undefined, 'string');
    expect(actual).toEqual(false);
  });
});
