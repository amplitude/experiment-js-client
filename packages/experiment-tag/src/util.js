export const getGlobalScope = () => {
  if (typeof globalThis !== 'undefined') {
    return globalThis;
  }
  if (typeof window !== 'undefined') {
    return window;
  }
  if (typeof self !== 'undefined') {
    return self;
  }
  if (typeof global !== 'undefined') {
    return global;
  }
  return undefined;
};

// Get URL parameters
export const getUrlParams = () => {
  const globalScope = getGlobalScope();
  const searchParams = new URLSearchParams(globalScope.location.search);
  const params = {};
  for (const [key, value] of searchParams) {
    params[key] = value;
  }
  return params;
};

export const urlWithoutParams = (url) => {
  return url.split('?')[0];
};

export // Generate a random UUID
const UUID = function (a) {
  return a // if the placeholder was passed, return
    ? // a random number from 0 to 15
      (
        a ^ // unless b is 8,
        ((Math.random() * // in which case
          16) >> // a random number from
          (a / 4))
      ) // 8 to 11
        .toString(16) // in hexadecimal
    : // or otherwise a concatenated string:
      (
        String(1e7) + // 10000000 +
        String(-1e3) + // -1000 +
        String(-4e3) + // -4000 +
        String(-8e3) + // -80000000 +
        String(-1e11)
      ) // -100000000000,
        .replace(
          // replacing
          /[018]/g, // zeroes, ones, and eights with
          UUID,
        );
};

export const getFlagToVariantsMapping = (flags) => {
  const flagToVariantMapping = {};
  // Parse the initialFlags string into a JavaScript object
  const parsedFlags = JSON.parse(flags);

  // Extract the variants array from the parsed object
  for (const flag of parsedFlags) {
    flagToVariantMapping[flag.key] = flag.variants;
  }
  return flagToVariantMapping;
};
