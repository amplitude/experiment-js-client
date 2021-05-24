export interface HttpClient {
  request(
    requestUrl: string,
    method: string,
    headers: Record<string, string>,
    data?: Record<string, string>,
    timeoutMillis?: number,
  ): Promise<Response>;
}
