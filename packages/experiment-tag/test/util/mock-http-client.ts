// interfaces copied frm experiment-browser

interface SimpleResponse {
  status: number;
  body: string;
}

interface HttpClient {
  request(
    requestUrl: string,
    method: string,
    headers: Record<string, string>,
    data: string,
    timeoutMillis?: number,
  ): Promise<SimpleResponse>;
}

export class MockHttpClient implements HttpClient {
  private response: SimpleResponse;

  constructor(responseBody: string, status = 200) {
    this.response = {
      status,
      body: responseBody,
    };
  }

  request(
    requestUrl: string,
    method: string,
    headers: Record<string, string>,
    data: string,
    timeoutMillis?: number,
  ): Promise<SimpleResponse> {
    return Promise.resolve(this.response);
  }
}