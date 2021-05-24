const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export const randomString = (
  length: number,
  alphabet: string = CHARS,
): string => {
  let str = '';
  for (let i = 0; i < length; ++i) {
    str += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  }
  return str;
};
