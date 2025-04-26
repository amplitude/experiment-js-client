export const sleep = async (millis: number) =>
  new Promise((r) => {
    setTimeout(r, millis);
  });
