export const clearAllCookies = () => {
  const cookies = document.cookie.split(';');

  for (const cookie of cookies) {
    const cookieName = cookie.split('=')[0].trim();
    document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  }
};

export const sleep = async (millis: number): Promise<void> => {
  return new Promise((resolve) => {
    setTimeout(resolve, millis);
  });
};
