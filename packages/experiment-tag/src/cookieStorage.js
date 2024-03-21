import { getGlobalScope } from './util';

export class CookieStorage {
  constructor(options) {
    this.options = { ...(options || {}) };
    this.globalScope = getGlobalScope();
  }

  isEnabled() {
    /* istanbul ignore if */
    if (!this.globalScope) {
      return false;
    }

    CookieStorage.testValue = String(Date.now());
    const testStorage = new CookieStorage(this.options);
    const testKey = 'EXP_TEST';
    try {
      testStorage.set(testKey, CookieStorage.testValue);
      const value = testStorage.get(testKey);
      return value === CookieStorage.testValue;
    } catch {
      /* istanbul ignore next */
      return false;
    } finally {
      testStorage.remove(testKey);
    }
  }

  get(key) {
    let value = this.getRaw(key);
    if (!value) {
      return undefined;
    }
    try {
      try {
        value = decodeURIComponent(atob(value));
      } catch {
        // value not encoded
      }
      return JSON.parse(value);
    } catch {
      /* istanbul ignore next */
      return undefined;
    }
  }

  getRaw(key) {
    const cookie = this.globalScope?.document?.cookie.split('; ') ?? [];
    const match = cookie.find((c) => c.indexOf(key + '=') === 0);
    if (!match) {
      return undefined;
    }
    return match.substring(key.length + 1);
  }

  set(key, value) {
    try {
      const expirationDays = this.options.expirationDays ?? 0;
      const expires = value !== null ? expirationDays : -1;
      let expireDate;
      if (expires) {
        const date = new Date();
        date.setTime(date.getTime() + expires * 24 * 60 * 60 * 1000);
        expireDate = date;
      }
      let str = `${key}=${btoa(encodeURIComponent(JSON.stringify(value)))}`;
      if (expireDate) {
        str += `; expires=${expireDate.toUTCString()}`;
      }
      str += '; path=/';
      if (this.options.domain) {
        str += `; domain=${this.options.domain}`;
      }
      if (this.options.secure) {
        str += '; Secure';
      }
      if (this.options.sameSite) {
        str += `; SameSite=${this.options.sameSite}`;
      }
      if (this.globalScope) {
        this.globalScope.document.cookie = str;
      }
    } catch {
      //
    }
  }

  remove(key) {
    this.set(key, null);
  }
}
