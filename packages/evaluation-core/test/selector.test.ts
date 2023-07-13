import { select } from '../src/select';

const primitiveObject = {
  null: null,
  string: 'value',
  number: 13,
  boolean: true,
};
const nestedObject = {
  ...primitiveObject,
  object: primitiveObject,
};

test('test selector evaluation context types', () => {
  const context = nestedObject;
  expect(select(context, ['does', 'not', 'exist'])).toBeUndefined();
  expect(select(context, ['null'])).toBeUndefined();
  expect(select(context, ['string'])).toEqual('value');
  expect(select(context, ['number'])).toEqual(13);
  expect(select(context, ['boolean'])).toEqual(true);
  expect(select(context, ['object'])).toEqual(primitiveObject);
  expect(select(context, ['object', 'does', 'not', 'exist'])).toBeUndefined();
  expect(select(context, ['object', 'null'])).toBeUndefined();
  expect(select(context, ['object', 'string'])).toEqual('value');
  expect(select(context, ['object', 'number'])).toEqual(13);
  expect(select(context, ['object', 'boolean'])).toEqual(true);
});
