export interface SimpleResponse {
  status: number;
  body: string;
}

export interface HttpClient {
  request(
    requestUrl: string,
    method: string,
    headers: Record<string, string>,
    data: string,
    timeoutMillis?: number,
  ): Promise<SimpleResponse>;
}
