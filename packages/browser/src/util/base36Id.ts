import { randomString } from './randomstring';

const base36Chars = 'abcdefghijklmnopqrstuvwxyz0123456789';

const ID_LENGTH = 25;

const base36Id = (): string => {
  return randomString(ID_LENGTH, base36Chars);
};

export { base36Id };
