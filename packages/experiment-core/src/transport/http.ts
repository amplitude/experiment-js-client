export type HttpRequest = {
  requestUrl: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
  timeoutMillis?: number;
};

export type HttpResponse = {
  status: number;
  body: string;
};

export interface HttpClient {
  request(request: HttpRequest): Promise<HttpResponse>;
}
