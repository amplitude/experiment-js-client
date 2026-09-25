describe('preview config HTTP requests', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.resetModules();
  });

  it('bypasses the browser HTTP cache', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      status: 200,
      text: async () => '{}',
    });
    globalThis.fetch = fetchMock;
    jest.resetModules();
    const { HttpClient } = await import('../../src/preview/http');

    await HttpClient.request(
      'https://api.lab.amplitude.com/web/v1/configs',
      'GET',
      {},
      null,
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.lab.amplitude.com/web/v1/configs',
      expect.objectContaining({ cache: 'no-store' }),
    );
  });
});
