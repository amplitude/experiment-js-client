import { Base64 } from 'js-base64';

import { SdkEvaluationApi } from '../../src';

const VARIANTS = {
  'flag-1': { key: 'on', value: 'on' },
};
const USER = { user_id: 'test-user' };

const getMockHttpClient = () => {
  return {
    request: jest.fn().mockResolvedValue({
      status: 200,
      body: JSON.stringify(VARIANTS),
    }),
  };
};

describe('Evaluation API', () => {
  it('should get variants', async () => {
    const mockHttpClient = getMockHttpClient();
    const evaluationApi = new SdkEvaluationApi(
      'test-deployment-key',
      'https://server.url.amplitude.com',
      mockHttpClient,
    );

    const variants = await evaluationApi.getVariants(USER);

    expect(variants).toEqual(VARIANTS);
    expect(mockHttpClient.request).toHaveBeenCalledWith({
      requestUrl: 'https://server.url.amplitude.com/sdk/v2/vardata?v=0',
      method: 'GET',
      headers: {
        Authorization: 'Api-Key test-deployment-key',
        'X-Amp-Exp-User': Base64.encodeURL(JSON.stringify(USER)),
      },
    });
  });

  it('should get variants with options', async () => {
    const mockHttpClient = getMockHttpClient();
    const evaluationApi = new SdkEvaluationApi(
      'test-deployment-key',
      'https://server.url.amplitude.com',
      mockHttpClient,
    );

    const variants = await evaluationApi.getVariants(USER, {
      flagKeys: ['flag-1'],
      trackingOption: 'no-track',
      exposureTrackingOption: 'no-track',
      deliveryMethod: 'web',
      evaluationMode: 'local',
      timeoutMillis: 1000,
    });

    expect(variants).toEqual(VARIANTS);
    expect(mockHttpClient.request).toHaveBeenCalledWith({
      requestUrl:
        'https://server.url.amplitude.com/sdk/v2/vardata?v=0&eval_mode=local&delivery_method=web',
      method: 'GET',
      headers: {
        Authorization: 'Api-Key test-deployment-key',
        'X-Amp-Exp-User': Base64.encodeURL(JSON.stringify(USER)),
        'X-Amp-Exp-Flag-Keys': Base64.encodeURL(JSON.stringify(['flag-1'])),
        'X-Amp-Exp-Track': 'no-track',
        'X-Amp-Exp-Exposure-Track': 'no-track',
      },
      timeoutMillis: 1000,
    });
  });
});
