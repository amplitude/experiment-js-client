import { stringToUtf8ByteArray } from './utils';

const C1_32 = -0x3361d2af;
const C2_32 = 0x1b873593;
const R1_32 = 15;
const R2_32 = 13;
const M_32 = 5;
const N_32 = -0x19ab949c;

export const hash32x86 = (input: string, seed = 0): number => {
  const data = stringToUtf8ByteArray(input);
  const length = data.length;
  const nBlocks = length >> 2;
  let hash = seed;

  // body
  for (let i = 0; i < nBlocks; i++) {
    const index = i << 2;
    const k = readIntLe(data, index);
    hash = mix32(k, hash);
  }

  // tail
  const index = nBlocks << 2;
  let k1 = 0;
  switch (length - index) {
    case 3:
      k1 ^= data[index + 2] << 16;
      k1 ^= data[index + 1] << 8;
      k1 ^= data[index];
      k1 = Math.imul(k1, C1_32);
      k1 = rotateLeft(k1, R1_32);
      k1 = Math.imul(k1, C2_32);
      hash ^= k1;
      break;
    case 2:
      k1 ^= data[index + 1] << 8;
      k1 ^= data[index];
      k1 = Math.imul(k1, C1_32);
      k1 = rotateLeft(k1, R1_32);
      k1 = Math.imul(k1, C2_32);
      hash ^= k1;
      break;
    case 1:
      k1 ^= data[index];
      k1 = Math.imul(k1, C1_32);
      k1 = rotateLeft(k1, R1_32);
      k1 = Math.imul(k1, C2_32);
      hash ^= k1;
      break;
  }
  hash ^= length;
  return fmix32(hash) >>> 0;
};

export const mix32 = (k: number, hash: number): number => {
  let kResult = k;
  let hashResult = hash;
  kResult = Math.imul(kResult, C1_32);
  kResult = rotateLeft(kResult, R1_32);
  kResult = Math.imul(kResult, C2_32);
  hashResult ^= kResult;
  hashResult = rotateLeft(hashResult, R2_32);
  hashResult = Math.imul(hashResult, M_32);
  return (hashResult + N_32) | 0;
};

export const fmix32 = (hash: number): number => {
  let hashResult = hash;
  hashResult ^= hashResult >>> 16;
  hashResult = Math.imul(hashResult, -0x7a143595);
  hashResult ^= hashResult >>> 13;
  hashResult = Math.imul(hashResult, -0x3d4d51cb);
  hashResult ^= hashResult >>> 16;
  return hashResult;
};

export const rotateLeft = (x: number, n: number, width = 32): number => {
  if (n > width) n = n % width;
  const mask = (0xffffffff << (width - n)) >>> 0;
  const r = (((x & mask) >>> 0) >>> (width - n)) >>> 0;
  return ((x << n) | r) >>> 0;
};

export const readIntLe = (data: Uint8Array, index = 0): number => {
  const n =
    (data[index] << 24) |
    (data[index + 1] << 16) |
    (data[index + 2] << 8) |
    data[index + 3];
  return reverseBytes(n);
};

export const reverseBytes = (n: number): number => {
  return (
    ((n & -0x1000000) >>> 24) |
    ((n & 0x00ff0000) >>> 8) |
    ((n & 0x0000ff00) << 8) |
    ((n & 0x000000ff) << 24)
  );
};
