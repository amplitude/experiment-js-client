import fetch from 'unfetch';

import {
  EvaluationEngine,
  HttpClient,
  HttpRequest,
  HttpResponse,
  SdkEvaluationApi,
  SdkFlagApi,
} from '../../src';

const deployment = 'server-WLbml1ljiGiKlXyrmO2fbgN463RrGt0Q';
const flagKey = 'cashback-offers-sort';
const user = {
  user_id: '13809501',
};

test('test', async () => {
  const api = new SdkEvaluationApi(
    deployment,
    'http://localhost:3034',
    new FetchHttpClient(),
  );
  const variants = await api.getVariants(user, {
    flagKeys: [flagKey],
    trackingOption: 'read-only',
  });
  // eslint-disable-next-line no-console
  console.log(variants);
});

test('get flag', async () => {
  const api = new SdkFlagApi(
    deployment,
    'http://localhost:3034',
    new FetchHttpClient(),
  );
  const flag = (await api.getFlags())[flagKey];
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(flag, null, 2));

  const result = new EvaluationEngine().evaluate(
    {
      user: user,
    },
    [flag],
  );
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(result, null, 2));
});

class FetchHttpClient implements HttpClient {
  async request(request: HttpRequest): Promise<HttpResponse> {
    const response = await fetch(request.requestUrl, {
      method: request.method,
      headers: request.headers,
      body: request.body,
    });
    return {
      status: response.status,
      body: await response.text(),
    };
  }
}
