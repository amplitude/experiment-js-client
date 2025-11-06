import * as coreUtil from '@amplitude/experiment-core';

import {
  concatenateQueryParamsOf,
  getCookieDomain,
  getUrlParams,
  matchesUrl,
  removeQueryParams,
  urlWithoutParamsAndAnchor,
} from '../src/util/url';

// Mock the getGlobalScope function
const spyGetGlobalScope = jest.spyOn(coreUtil, 'getGlobalScope');

describe('matchesUrl', () => {
  // Existing test cases
  it('should return true if the URL matches in the array without trailing slash', () => {
    const urlArray: string[] = ['http://example.com', 'http://example.org/'];
    const urlString = 'http://example.org';

    expect(matchesUrl(urlArray, urlString)).toBe(true);
  });

  it('should return false if the URL does not match in the array', () => {
    const urlArray: string[] = ['http://example.com', 'http://example.org/'];
    const urlString = 'http://example.net';

    expect(matchesUrl(urlArray, urlString)).toBe(false);
  });

  // Additional test cases
  it('should handle URLs with different protocols', () => {
    const urlArray: string[] = ['https://example.com', 'http://example.org/'];
    const urlString = 'https://example.com';

    expect(matchesUrl(urlArray, urlString)).toBe(true);
  });

  it('should handle URLs with paths', () => {
    const urlArray: string[] = [
      'http://example.com/page',
      'http://example.org/',
    ];
    const urlString = 'http://example.com/page';

    expect(matchesUrl(urlArray, urlString)).toBe(true);
  });

  it('should handle URLs with query parameters', () => {
    const urlArray: string[] = [
      'http://example.com?param=value',
      'http://example.org/',
    ];
    const urlString = 'http://example.com?param=value';

    expect(matchesUrl(urlArray, urlString)).toBe(true);
  });

  it('should handle URLs with ports', () => {
    const urlArray: string[] = [
      'http://example.com:8080',
      'http://example.org/',
    ];
    const urlString = 'http://example.com:8080';

    expect(matchesUrl(urlArray, urlString)).toBe(true);
  });
});

describe('urlWithoutParamsAndAnchor', () => {
  // Existing test cases
  it('should return the URL without parameters and anchor', () => {
    const url = 'http://example.com/page?param1=value1&param2=value2#section';

    expect(urlWithoutParamsAndAnchor(url)).toBe('http://example.com/page');
  });

  it('should return the same URL if it does not contain parameters and anchor', () => {
    const url = 'http://example.com/page';

    expect(urlWithoutParamsAndAnchor(url)).toBe('http://example.com/page');
  });

  // Additional test cases
  it('should handle URLs with anchors', () => {
    const url = 'http://example.com/page#section';

    expect(urlWithoutParamsAndAnchor(url)).toBe('http://example.com/page');
  });
});

describe('getUrlParams', () => {
  // Existing test cases
  it('should return URL parameters as an object', () => {
    const mockGlobal = {
      location: {
        search: '?param1=value1&param2=value2',
      },
    };

    // Mock the global scope and location
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    spyGetGlobalScope.mockReturnValue(mockGlobal);

    expect(getUrlParams()).toEqual({
      param1: 'value1',
      param2: 'value2',
    });
  });

  it('should return an empty object if there are no URL parameters', () => {
    const mockGlobal = {
      location: {
        search: '',
      },
    };

    // Mock the global scope and location
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    spyGetGlobalScope.mockReturnValue(mockGlobal);

    expect(getUrlParams()).toEqual({});
  });
});

describe('concateQueryParamsOf', () => {
  it('should concatenate query params if only current url has', () => {
    expect(
      concatenateQueryParamsOf(
        'https://test.com?utm_source=testing',
        'https://test2.com',
      ),
    ).toBe('https://test2.com/?utm_source=testing');
  });

  it('should concatenate query params if only redirected url has', () => {
    expect(
      concatenateQueryParamsOf(
        'https://test.com',
        'https://test2.com?utm_source=testing',
      ),
    ).toBe('https://test2.com/?utm_source=testing');
  });

  it('should concatenate query params if both urls have', () => {
    expect(
      concatenateQueryParamsOf(
        'https://test.com?utm_medium=new_url&utm_source=testing',
        'https://test2.com?utm_source=testing2',
      ),
    ).toBe('https://test2.com/?utm_source=testing2&utm_medium=new_url');
  });

  it('should concatenate multiple query params if both urls have', () => {
    expect(
      concatenateQueryParamsOf(
        'https://test.com?utm_medium=new_url&utm_medium=new_url2&utm_source=testing',
        'https://test2.com?utm_source=testing2',
      ),
    ).toBe(
      'https://test2.com/?utm_source=testing2&utm_medium=new_url&utm_medium=new_url2',
    );
  });

  it('should not include anchors from current url', () => {
    expect(
      concatenateQueryParamsOf(
        'https://test.com?utm_medium=new_url&utm_source=testing#anchor1',
        'https://test2.com?utm_source=testing2',
      ),
    ).toBe('https://test2.com/?utm_source=testing2&utm_medium=new_url');
  });

  it('should include anchors from redirected url', () => {
    expect(
      concatenateQueryParamsOf(
        'https://test.com?utm_medium=new_url&utm_source=testing',
        'https://test2.com?utm_source=testing2#anchor2',
      ),
    ).toBe('https://test2.com/?utm_source=testing2&utm_medium=new_url#anchor2');
  });
});

describe('removeQueryParams', () => {
  describe('standard URLs', () => {
    it('should remove single query parameter from standard URL', () => {
      const url = 'https://example.com/page?param1=value1&param2=value2';
      const paramsToRemove = ['param1'];

      expect(removeQueryParams(url, paramsToRemove)).toBe(
        'https://example.com/page?param2=value2',
      );
    });

    it('should remove multiple query parameters from standard URL', () => {
      const url =
        'https://example.com/page?param1=value1&param2=value2&param3=value3';
      const paramsToRemove = ['param1', 'param3'];

      expect(removeQueryParams(url, paramsToRemove)).toBe(
        'https://example.com/page?param2=value2',
      );
    });

    it('should remove all query parameters from standard URL', () => {
      const url = 'https://example.com/page?param1=value1&param2=value2';
      const paramsToRemove = ['param1', 'param2'];

      expect(removeQueryParams(url, paramsToRemove)).toBe(
        'https://example.com/page',
      );
    });

    it('should handle URL with no query parameters', () => {
      const url = 'https://example.com/page';
      const paramsToRemove = ['param1'];

      expect(removeQueryParams(url, paramsToRemove)).toBe(
        'https://example.com/page',
      );
    });

    it('should handle URL with hash but no hash-based routing', () => {
      const url = 'https://example.com/page?param1=value1#section';
      const paramsToRemove = ['param1'];

      expect(removeQueryParams(url, paramsToRemove)).toBe(
        'https://example.com/page#section',
      );
    });

    it('should handle URL with hash fragment (not hash-based routing)', () => {
      const url = 'https://example.com/page?param1=value1#section';
      const paramsToRemove = ['param1'];

      expect(removeQueryParams(url, paramsToRemove)).toBe(
        'https://example.com/page#section',
      );
    });
  });

  describe('hash-based routing URLs', () => {
    it('should remove single query parameter from hash-based route', () => {
      const url = 'https://example.com/#/page?param1=value1&param2=value2';
      const paramsToRemove = ['param1'];

      expect(removeQueryParams(url, paramsToRemove)).toBe(
        'https://example.com/#/page?param2=value2',
      );
    });

    it('should remove multiple query parameters from hash-based route', () => {
      const url =
        'https://example.com/#/page?param1=value1&param2=value2&param3=value3';
      const paramsToRemove = ['param1', 'param3'];

      expect(removeQueryParams(url, paramsToRemove)).toBe(
        'https://example.com/#/page?param2=value2',
      );
    });

    it('should remove all query parameters from hash-based route', () => {
      const url = 'https://example.com/#/page?param1=value1&param2=value2';
      const paramsToRemove = ['param1', 'param2'];

      expect(removeQueryParams(url, paramsToRemove)).toBe(
        'https://example.com/#/page',
      );
    });

    it('should handle hash-based route with no query parameters', () => {
      const url = 'https://example.com/#/page';
      const paramsToRemove = ['param1'];

      expect(removeQueryParams(url, paramsToRemove)).toBe(
        'https://example.com/#/page',
      );
    });

    it('should handle hash-based route with nested path', () => {
      const url = 'https://example.com/#/users/123?param1=value1&param2=value2';
      const paramsToRemove = ['param1'];

      expect(removeQueryParams(url, paramsToRemove)).toBe(
        'https://example.com/#/users/123?param2=value2',
      );
    });

    it('should handle hash-based route with complex path and multiple params', () => {
      const url =
        'https://example.com/#/dashboard/settings?theme=dark&lang=en&debug=true';
      const paramsToRemove = ['theme', 'debug'];

      expect(removeQueryParams(url, paramsToRemove)).toBe(
        'https://example.com/#/dashboard/settings?lang=en',
      );
    });

    it('should handle hash-based route with trailing slash', () => {
      const url = 'https://example.com/#/page/?param1=value1&param2=value2';
      const paramsToRemove = ['param1'];

      expect(removeQueryParams(url, paramsToRemove)).toBe(
        'https://example.com/#/page/?param2=value2',
      );
    });
  });

  describe('edge cases', () => {
    it('should handle empty paramsToRemove array', () => {
      const url = 'https://example.com/page?param1=value1';
      const paramsToRemove: string[] = [];

      expect(removeQueryParams(url, paramsToRemove)).toBe(
        'https://example.com/page?param1=value1',
      );
    });

    it('should handle non-existent parameters', () => {
      const url = 'https://example.com/page?param1=value1';
      const paramsToRemove = ['nonexistent'];

      expect(removeQueryParams(url, paramsToRemove)).toBe(
        'https://example.com/page?param1=value1',
      );
    });

    it('should handle hash-based route with non-existent parameters', () => {
      const url = 'https://example.com/#/page?param1=value1';
      const paramsToRemove = ['nonexistent'];

      expect(removeQueryParams(url, paramsToRemove)).toBe(
        'https://example.com/#/page?param1=value1',
      );
    });

    it('should handle URL with only hash fragment (not hash-based routing)', () => {
      const url = 'https://example.com/page?param1=value1#section';
      const paramsToRemove = ['param1'];

      expect(removeQueryParams(url, paramsToRemove)).toBe(
        'https://example.com/page#section',
      );
    });

    it('should handle URL with hash but content does not start with slash', () => {
      const url = 'https://example.com/page?param1=value1#section';
      const paramsToRemove = ['param1'];

      expect(removeQueryParams(url, paramsToRemove)).toBe(
        'https://example.com/page#section',
      );
    });
  });
});

describe('getCookieDomain', () => {
  describe('regular domains', () => {
    it('should return root domain with leading dot for standard domain', () => {
      expect(getCookieDomain('https://example.com')).toBe('.example.com');
    });

    it('should return root domain with leading dot for subdomain', () => {
      expect(getCookieDomain('https://subdomain.example.com')).toBe(
        '.example.com',
      );
    });

    it('should return root domain with leading dot for multiple subdomains', () => {
      expect(getCookieDomain('https://sub1.sub2.example.com')).toBe(
        '.example.com',
      );
    });

    it('should handle domain with path and query parameters', () => {
      expect(
        getCookieDomain('https://subdomain.example.com/path?param=value'),
      ).toBe('.example.com');
    });

    it('should handle domain with port', () => {
      expect(getCookieDomain('https://subdomain.example.com:3000')).toBe(
        '.example.com',
      );
    });
  });

  describe('localhost', () => {
    it('should return .localhost for localhost', () => {
      expect(getCookieDomain('http://localhost')).toBe('.localhost');
      expect(getCookieDomain('http://localhost:3000')).toBe('.localhost');
    });

    it('should return .localhost for subdomains of localhost', () => {
      expect(getCookieDomain('http://app.localhost')).toBe('.localhost');
      expect(getCookieDomain('http://app.localhost:3000')).toBe('.localhost');
      expect(getCookieDomain('http://sub1.sub2.localhost')).toBe('.localhost');
    });
  });

  describe('public suffix domains', () => {
    it('should return full hostname with leading dot for vercel.app subdomain', () => {
      expect(getCookieDomain('https://myapp.vercel.app')).toBe(
        '.myapp.vercel.app',
      );
    });

    it('should return full hostname with leading dot for netlify.app subdomain', () => {
      expect(getCookieDomain('https://myapp.netlify.app')).toBe(
        '.myapp.netlify.app',
      );
    });

    it('should return full hostname with leading dot for pages.dev subdomain', () => {
      expect(getCookieDomain('https://myapp.pages.dev')).toBe(
        '.myapp.pages.dev',
      );
    });

    it('should return full hostname with leading dot for nested public suffix subdomains', () => {
      expect(getCookieDomain('https://feature-branch.myapp.vercel.app')).toBe(
        '.feature-branch.myapp.vercel.app',
      );
      expect(getCookieDomain('https://preview.myapp.netlify.app')).toBe(
        '.preview.myapp.netlify.app',
      );
      expect(getCookieDomain('https://staging.myapp.pages.dev')).toBe(
        '.staging.myapp.pages.dev',
      );
    });
  });

  describe('edge cases', () => {
    it('should return undefined for invalid URL', () => {
      expect(getCookieDomain('not-a-valid-url')).toBeUndefined();
      expect(getCookieDomain('')).toBeUndefined();
    });

    it('should handle two-part domain', () => {
      expect(getCookieDomain('https://example.co')).toBe('.example.co');
    });

    it('should handle three-part top-level domain', () => {
      expect(getCookieDomain('https://example.co.uk')).toBe('.co.uk');
      expect(getCookieDomain('https://subdomain.example.co.uk')).toBe('.co.uk');
    });
  });
});

afterAll(() => {
  // Restore the original getGlobalScope function after all tests
  spyGetGlobalScope.mockRestore();
});
