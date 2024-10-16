import * as coreUtil from '@amplitude/experiment-core';
import {
  concatenateQueryParamsOf,
  getUrlParams,
  urlWithoutParamsAndAnchor,
} from 'src/util';

// Mock the getGlobalScope function
const spyGetGlobalScope = jest.spyOn(coreUtil, 'getGlobalScope');

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

afterAll(() => {
  // Restore the original getGlobalScope function after all tests
  spyGetGlobalScope.mockRestore();
});
