import * as base64 from 'base64-js';

export const stringToUtf8Array = (s: string): Array<number> => {
  const utf8 = unescape(encodeURIComponent(s));
  const arr = [];
  for (let i = 0; i < utf8.length; i++) {
    arr.push(utf8.charCodeAt(i));
  }
  return arr;
};

export const urlSafeBase64Encode = (s: string): string => {
  const base64encoded = base64.fromByteArray(stringToUtf8Array(s));
  return base64encoded
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
};
