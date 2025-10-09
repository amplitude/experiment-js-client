import {
  Campaign,
  CampaignParser,
  CookieStorage,
  getStorageKey,
  MKTG,
} from '@amplitude/analytics-core';
import { ExperimentUser } from '@amplitude/experiment-js-client';

import {
  enrichUserWithCampaignData,
  persistUrlUtmParams,
} from '../../src/util/campaign';
import * as storageUtils from '../../src/util/storage';

jest.mock('@amplitude/analytics-core', () => ({
  Campaign: jest.fn(),
  CampaignParser: jest.fn(),
  CookieStorage: jest.fn(),
  getStorageKey: jest.fn(),
  MKTG: MKTG,
}));

jest.mock('../../src/util/storage', () => ({
  getStorageItem: jest.fn(),
  setStorageItem: jest.fn(),
}));

describe('campaign utilities', () => {
  let mockCampaignParser: jest.Mocked<CampaignParser>;
  let mockCookieStorage: jest.Mocked<CookieStorage<Campaign>>;
  let mockGetStorageItem: jest.MockedFunction<
    typeof storageUtils.getStorageItem
  >;
  let mockSetStorageItem: jest.MockedFunction<
    typeof storageUtils.setStorageItem
  >;
  let mockGetStorageKey: jest.MockedFunction<typeof getStorageKey>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockCampaignParser = {
      parse: jest.fn(),
    } as any;

    mockCookieStorage = {
      get: jest.fn(),
      set: jest.fn(),
    } as any;

    mockGetStorageItem = storageUtils.getStorageItem as jest.MockedFunction<
      typeof storageUtils.getStorageItem
    >;
    mockSetStorageItem = storageUtils.setStorageItem as jest.MockedFunction<
      typeof storageUtils.setStorageItem
    >;
    mockGetStorageKey = getStorageKey as jest.MockedFunction<
      typeof getStorageKey
    >;

    (CampaignParser as jest.Mock).mockImplementation(() => mockCampaignParser);
    (CookieStorage as unknown as jest.Mock).mockImplementation(
      () => mockCookieStorage,
    );
  });

  describe('enrichUserWithCampaignData', () => {
    const apiKey = 'test-api-key-1234567890';
    const baseUser: ExperimentUser = {
      user_id: 'test-user',
      device_id: 'test-device',
      user_properties: {
        existing_prop: 'existing_value',
      },
    };

    beforeEach(() => {
      mockGetStorageKey.mockReturnValue('AMP_MKTG_test-api-k');
    });

    it('should enrich user with UTM parameters from all sources with correct priority', async () => {
      const currentCampaign: Partial<Campaign> = {
        utm_source: 'current_source',
        utm_medium: 'current_medium',
        utm_campaign: 'current_campaign',
      };

      const persistedAmplitudeCampaign: Partial<Campaign> = {
        utm_source: 'amplitude_source',
        utm_medium: 'amplitude_medium',
        utm_term: 'amplitude_term',
        utm_content: 'amplitude_content',
      };

      const persistedExperimentCampaign = {
        utm_source: 'experiment_source',
        utm_term: 'experiment_term',
        utm_id: 'experiment_id',
      };

      mockCampaignParser.parse.mockResolvedValue(currentCampaign as Campaign);
      mockCookieStorage.get.mockResolvedValue(
        persistedAmplitudeCampaign as Campaign,
      );
      mockGetStorageItem.mockReturnValue(persistedExperimentCampaign);

      const result = await enrichUserWithCampaignData(apiKey, baseUser);

      expect(result).toEqual({
        ...baseUser,
        user_properties: {
          ...baseUser.user_properties,
          utm_source: 'current_source',
          utm_medium: 'current_medium',
          utm_campaign: 'current_campaign',
          utm_term: 'experiment_term',
          utm_content: 'amplitude_content',
          utm_id: 'experiment_id',
        },
      });

      expect(mockGetStorageItem).toHaveBeenCalledWith(
        'localStorage',
        'EXP_MKTG_test-api-k',
      );
      expect(mockSetStorageItem).toHaveBeenCalledWith(
        'localStorage',
        'EXP_MKTG_test-api-k',
        {
          utm_source: 'current_source',
          utm_medium: 'current_medium',
          utm_campaign: 'current_campaign',
          utm_term: 'experiment_term',
          utm_content: 'amplitude_content',
          utm_id: 'experiment_id',
        },
      );
    });

    it('should preserve lower priority values when current campaign has undefined values', async () => {
      const currentCampaign: Partial<Campaign> = {
        utm_source: 'current_source',
        utm_medium: undefined as any,
        utm_campaign: 'current_campaign',
      };

      const persistedAmplitudeCampaign: Partial<Campaign> = {
        utm_source: 'amplitude_source',
        utm_medium: 'amplitude_medium',
        utm_term: 'amplitude_term',
      };

      const persistedExperimentCampaign = {
        utm_medium: 'experiment_medium',
        utm_content: 'experiment_content',
      };

      mockCampaignParser.parse.mockResolvedValue(currentCampaign as Campaign);
      mockCookieStorage.get.mockResolvedValue(
        persistedAmplitudeCampaign as Campaign,
      );
      mockGetStorageItem.mockReturnValue(persistedExperimentCampaign);

      const result = await enrichUserWithCampaignData(apiKey, baseUser);

      expect(result.user_properties).toEqual({
        ...baseUser.user_properties,
        utm_source: 'current_source',
        utm_medium: 'experiment_medium',
        utm_campaign: 'current_campaign',
        utm_term: 'amplitude_term',
        utm_content: 'experiment_content',
      });
    });

    it('should filter out undefined values and preserve lower priority values', async () => {
      const currentCampaign: Partial<Campaign> = {
        utm_source: 'current_source',
        utm_medium: undefined as any,
        utm_campaign: 'current_campaign',
      };

      const persistedExperimentCampaign = {
        utm_source: 'experiment_source',
        utm_medium: 'experiment_medium',
        utm_term: 'experiment_term',
      };

      mockCampaignParser.parse.mockResolvedValue(currentCampaign as Campaign);
      mockCookieStorage.get.mockResolvedValue(undefined);
      mockGetStorageItem.mockReturnValue(persistedExperimentCampaign);

      const result = await enrichUserWithCampaignData(apiKey, baseUser);

      expect(result.user_properties).toEqual({
        ...baseUser.user_properties,
        utm_source: 'current_source',
        utm_medium: 'experiment_medium',
        utm_campaign: 'current_campaign',
        utm_term: 'experiment_term',
      });
    });

    it('should filter out non-UTM parameters from all sources', async () => {
      const currentCampaign: Partial<Campaign> = {
        utm_source: 'test_source',
        non_utm_param: 'should_be_filtered',
        random_field: 'also_filtered',
      } as any;

      const persistedAmplitudeCampaign: Partial<Campaign> = {
        utm_medium: 'amplitude_medium',
        amplitude_specific: 'filtered_out',
      } as any;

      const persistedExperimentCampaign = {
        utm_term: 'experiment_term',
        experiment_data: 'filtered_out',
      };

      mockCampaignParser.parse.mockResolvedValue(currentCampaign as Campaign);
      mockCookieStorage.get.mockResolvedValue(
        persistedAmplitudeCampaign as Campaign,
      );
      mockGetStorageItem.mockReturnValue(persistedExperimentCampaign);

      const result = await enrichUserWithCampaignData(apiKey, baseUser);

      expect(result.user_properties).toEqual({
        ...baseUser.user_properties,
        utm_source: 'test_source',
        utm_medium: 'amplitude_medium',
        utm_term: 'experiment_term',
      });
    });

    it('should handle mixed undefined values across all sources', async () => {
      const currentCampaign: Partial<Campaign> = {
        utm_source: 'current_source',
        utm_medium: undefined as any,
        utm_campaign: undefined as any,
      };

      const persistedAmplitudeCampaign: Partial<Campaign> = {
        utm_source: 'amplitude_source',
        utm_medium: undefined as any,
        utm_term: 'amplitude_term',
      };

      const persistedExperimentCampaign = {
        utm_medium: 'experiment_medium',
        utm_campaign: 'experiment_campaign',
        utm_content: undefined as any,
      };

      mockCampaignParser.parse.mockResolvedValue(currentCampaign as Campaign);
      mockCookieStorage.get.mockResolvedValue(
        persistedAmplitudeCampaign as Campaign,
      );
      mockGetStorageItem.mockReturnValue(persistedExperimentCampaign);

      const result = await enrichUserWithCampaignData(apiKey, baseUser);

      expect(result.user_properties).toEqual({
        ...baseUser.user_properties,
        utm_source: 'current_source',
        utm_medium: 'experiment_medium',
        utm_campaign: 'experiment_campaign',
        utm_term: 'amplitude_term',
      });
    });

    it('should handle empty campaign data gracefully', async () => {
      mockCampaignParser.parse.mockResolvedValue({} as Campaign);
      mockCookieStorage.get.mockResolvedValue(undefined);
      mockGetStorageItem.mockReturnValue(null);

      const result = await enrichUserWithCampaignData(apiKey, baseUser);

      expect(result).toEqual(baseUser);
      expect(mockSetStorageItem).toHaveBeenCalledWith(
        'localStorage',
        'EXP_MKTG_test-api-k',
        {},
      );
    });

    it('should handle user without existing user_properties', async () => {
      const userWithoutProps: ExperimentUser = {
        user_id: 'test-user',
        device_id: 'test-device',
      };

      const currentCampaign: Partial<Campaign> = {
        utm_source: 'test_source',
      };

      mockCampaignParser.parse.mockResolvedValue(currentCampaign as Campaign);
      mockCookieStorage.get.mockResolvedValue(undefined);
      mockGetStorageItem.mockReturnValue(null);

      const result = await enrichUserWithCampaignData(apiKey, userWithoutProps);

      expect(result).toEqual({
        ...userWithoutProps,
        user_properties: {
          utm_source: 'test_source',
        },
      });
    });

    it('should handle all UTM parameter types', async () => {
      const fullCampaign: Partial<Campaign> = {
        utm_source: 'test_source',
        utm_medium: 'test_medium',
        utm_campaign: 'test_campaign',
        utm_term: 'test_term',
        utm_content: 'test_content',
        utm_id: 'test_id',
      };

      mockCampaignParser.parse.mockResolvedValue(fullCampaign as Campaign);
      mockCookieStorage.get.mockResolvedValue(undefined);
      mockGetStorageItem.mockReturnValue(null);

      const result = await enrichUserWithCampaignData(apiKey, baseUser);

      expect(result.user_properties).toMatchObject({
        utm_source: 'test_source',
        utm_medium: 'test_medium',
        utm_campaign: 'test_campaign',
        utm_term: 'test_term',
        utm_content: 'test_content',
        utm_id: 'test_id',
      });
    });

    it('should generate correct storage key from API key', async () => {
      const longApiKey =
        'very-long-api-key-that-should-be-truncated-1234567890';

      mockCampaignParser.parse.mockResolvedValue({} as Campaign);
      mockCookieStorage.get.mockResolvedValue(undefined);
      mockGetStorageItem.mockReturnValue(null);

      await enrichUserWithCampaignData(longApiKey, baseUser);

      expect(mockGetStorageItem).toHaveBeenCalledWith(
        'localStorage',
        'EXP_MKTG_very-long-',
      );
    });

    it('should handle async errors gracefully', async () => {
      mockCampaignParser.parse.mockRejectedValue(new Error('Parse error'));
      mockCookieStorage.get.mockRejectedValue(new Error('Storage error'));
      mockGetStorageItem.mockReturnValue(null);

      await expect(
        enrichUserWithCampaignData(apiKey, baseUser),
      ).rejects.toThrow();
    });
  });

  describe('persistUrlUtmParams', () => {
    const apiKey = 'test-api-key-1234567890';

    it('should persist UTM parameters to localStorage with correct key', () => {
      const campaign = {
        utm_source: 'test_source',
        utm_medium: 'test_medium',
        utm_campaign: 'test_campaign',
      };

      persistUrlUtmParams(apiKey, campaign);

      expect(mockSetStorageItem).toHaveBeenCalledWith(
        'localStorage',
        'EXP_MKTG_test-api-k',
        campaign,
      );
    });

    it('should handle empty campaign object', () => {
      const emptyCampaign = {};

      persistUrlUtmParams(apiKey, emptyCampaign);

      expect(mockSetStorageItem).toHaveBeenCalledWith(
        'localStorage',
        'EXP_MKTG_test-api-k',
        emptyCampaign,
      );
    });

    it('should generate correct storage key for different API keys', () => {
      const shortApiKey = 'short';
      const longApiKey = 'very-long-api-key-that-exceeds-ten-characters';

      persistUrlUtmParams(shortApiKey, {});
      expect(mockSetStorageItem).toHaveBeenCalledWith(
        'localStorage',
        'EXP_MKTG_short',
        {},
      );

      persistUrlUtmParams(longApiKey, {});
      expect(mockSetStorageItem).toHaveBeenCalledWith(
        'localStorage',
        'EXP_MKTG_very-long-',
        {},
      );
    });

    it('should persist non-UTM parameters if provided', () => {
      const campaignWithNonUtm = {
        utm_source: 'test_source',
        custom_param: 'custom_value',
        another_param: 'another_value',
      };

      persistUrlUtmParams(apiKey, campaignWithNonUtm);

      expect(mockSetStorageItem).toHaveBeenCalledWith(
        'localStorage',
        'EXP_MKTG_test-api-k',
        campaignWithNonUtm,
      );
    });
  });

  describe('fetchCampaignData (internal function behavior)', () => {
    const apiKey = 'test-api-key';

    it('should call CampaignParser and CookieStorage correctly', async () => {
      const expectedCampaign: Partial<Campaign> = { utm_source: 'test' };
      const expectedPreviousCampaign: Partial<Campaign> = {
        utm_medium: 'previous',
      };

      mockCampaignParser.parse.mockResolvedValue(expectedCampaign as Campaign);
      mockCookieStorage.get.mockResolvedValue(
        expectedPreviousCampaign as Campaign,
      );
      mockGetStorageKey.mockReturnValue('test-storage-key');
      mockGetStorageItem.mockReturnValue(null);

      await enrichUserWithCampaignData(apiKey, { user_id: 'test' });

      expect(CampaignParser).toHaveBeenCalledWith();
      expect(mockCampaignParser.parse).toHaveBeenCalledWith();
      expect(CookieStorage).toHaveBeenCalledWith();
      expect(getStorageKey).toHaveBeenCalledWith(apiKey, 'MKTG');
      expect(mockCookieStorage.get).toHaveBeenCalledWith('test-storage-key');
    });

    it('should handle null previous campaign', async () => {
      const expectedCampaign: Partial<Campaign> = { utm_source: 'test' };

      mockCampaignParser.parse.mockResolvedValue(expectedCampaign as Campaign);
      mockCookieStorage.get.mockResolvedValue(undefined);
      mockGetStorageItem.mockReturnValue(null);

      const result = await enrichUserWithCampaignData(apiKey, {
        user_id: 'test',
      });

      expect(result.user_properties).toMatchObject({
        utm_source: 'test',
      });
    });
  });

  describe('integration tests', () => {
    it('should work end-to-end with realistic campaign data and filtering', async () => {
      const apiKey = 'prod-api-key-1234567890';
      const user: ExperimentUser = {
        user_id: 'user123',
        device_id: 'device456',
        user_properties: {
          existing_prop: 'value',
        },
      };

      const urlCampaign: Partial<Campaign> = {
        utm_source: 'google',
        utm_medium: 'cpc',
        utm_campaign: 'summer_sale',
        utm_term: undefined as any,
        referrer: 'google.com',
      } as any;

      const amplitudeCampaign: Partial<Campaign> = {
        utm_source: 'facebook',
        utm_medium: 'social',
        utm_term: 'shoes',
        utm_content: 'ad_variant_a',
        session_id: '12345',
      } as any;

      const experimentCampaign = {
        utm_term: 'sneakers',
        utm_id: 'exp_123',
        utm_content: undefined as any,
        internal_flag: true,
      };

      mockCampaignParser.parse.mockResolvedValue(urlCampaign as Campaign);
      mockCookieStorage.get.mockResolvedValue(amplitudeCampaign as Campaign);
      mockGetStorageItem.mockReturnValue(experimentCampaign);
      mockGetStorageKey.mockReturnValue('AMP_MKTG_prod-api-k');

      const result = await enrichUserWithCampaignData(apiKey, user);

      expect(result).toEqual({
        user_id: 'user123',
        device_id: 'device456',
        user_properties: {
          existing_prop: 'value',
          utm_source: 'google',
          utm_medium: 'cpc',
          utm_campaign: 'summer_sale',
          utm_term: 'sneakers',
          utm_content: 'ad_variant_a',
          utm_id: 'exp_123',
        },
      });

      expect(mockSetStorageItem).toHaveBeenCalledWith(
        'localStorage',
        'EXP_MKTG_prod-api-k',
        {
          utm_source: 'google',
          utm_medium: 'cpc',
          utm_campaign: 'summer_sale',
          utm_term: 'sneakers',
          utm_content: 'ad_variant_a',
          utm_id: 'exp_123',
        },
      );
    });
  });
});
