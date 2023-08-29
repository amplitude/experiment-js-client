import { transformVariantFromStorage } from '../src/storage/cache';

describe('transformVariantFromStorage', () => {
  test('v0 variant transformation', () => {
    const storedVariant = 'on';
    expect(transformVariantFromStorage(storedVariant)).toEqual({
      key: 'on',
      value: 'on',
    });
  });
  test('v1 variant transformation', () => {
    const storedVariant = {
      value: 'on',
    };
    expect(transformVariantFromStorage(storedVariant)).toEqual({
      key: 'on',
      value: 'on',
    });
  });
  test('v1 variant transformation, with payload', () => {
    const storedVariant = {
      value: 'on',
      payload: { k: 'v' },
    };
    expect(transformVariantFromStorage(storedVariant)).toEqual({
      key: 'on',
      value: 'on',
      payload: { k: 'v' },
    });
  });
  test('v1 variant transformation, with payload and experiment key', () => {
    const storedVariant = {
      value: 'on',
      payload: { k: 'v' },
      expKey: 'exp-1',
    };
    expect(transformVariantFromStorage(storedVariant)).toEqual({
      key: 'on',
      value: 'on',
      payload: { k: 'v' },
      expKey: 'exp-1',
      metadata: {
        experimentKey: 'exp-1',
      },
    });
  });
  test('v2 variant transformation', () => {
    const storedVariant = {
      key: 'treatment',
      value: 'on',
    };
    expect(transformVariantFromStorage(storedVariant)).toEqual({
      key: 'treatment',
      value: 'on',
    });
  });
  test('v2 variant transformation, with payload', () => {
    const storedVariant = {
      key: 'treatment',
      value: 'on',
      payload: { k: 'v' },
    };
    expect(transformVariantFromStorage(storedVariant)).toEqual({
      key: 'treatment',
      value: 'on',
      payload: { k: 'v' },
    });
  });
  test('v2 variant transformation, with payload and experiment key', () => {
    const storedVariant = {
      key: 'treatment',
      value: 'on',
      payload: { k: 'v' },
      expKey: 'exp-1',
    };
    expect(transformVariantFromStorage(storedVariant)).toEqual({
      key: 'treatment',
      value: 'on',
      payload: { k: 'v' },
      expKey: 'exp-1',
      metadata: {
        experimentKey: 'exp-1',
      },
    });
  });
  test('v2 variant transformation, with payload and experiment key metadata', () => {
    const storedVariant = {
      key: 'treatment',
      value: 'on',
      payload: { k: 'v' },
      metadata: {
        experimentKey: 'exp-1',
      },
    };
    expect(transformVariantFromStorage(storedVariant)).toEqual({
      key: 'treatment',
      value: 'on',
      payload: { k: 'v' },
      expKey: 'exp-1',
      metadata: {
        experimentKey: 'exp-1',
      },
    });
  });
});
