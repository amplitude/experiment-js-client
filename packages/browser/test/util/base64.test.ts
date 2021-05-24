import { stringToUtf8Array, urlSafeBase64Encode } from '../../src/util/base64';

test('stringToUtf8Array', () => {
  expect(stringToUtf8Array('My 🚀 is full of 🦎')).toEqual([
    77,
    121,
    32,
    240,
    159,
    154,
    128,
    32,
    105,
    115,
    32,
    102,
    117,
    108,
    108,
    32,
    111,
    102,
    32,
    240,
    159,
    166,
    142,
  ]);
});

test('urlSafeBase64Encode', () => {
  expect(urlSafeBase64Encode('My 🚀 is full of 🦎')).toEqual(
    'TXkg8J-agCBpcyBmdWxsIG9mIPCfpo4',
  );
});
