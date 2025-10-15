import {
  type Campaign,
  CampaignParser,
  CookieStorage,
  getStorageKey,
} from '@amplitude/analytics-core';
import { type ExperimentUser } from '@amplitude/experiment-js-client';

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
  MKTG: 'MKTG',
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
        persisted_utm_param: {
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
        utm_medium: undefined,
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

      expect(result.persisted_utm_param).toEqual({
        utm_source: 'current_source',
        utm_medium: 'experiment_medium',
        utm_campaign: 'current_campaign',
        utm_term: 'amplitude_term',
        utm_content: 'experiment_content',
      });
    });

    it('should filter out non-UTM parameters from all sources', async () => {
      const currentCampaign: Partial<Campaign> = {
        utm_source: 'test_source',
        non_utm_param: 'should_be_filtered',
        random_field: 'also_filtered',
      };

      const persistedAmplitudeCampaign: Partial<Campaign> = {
        utm_medium: 'amplitude_medium',
        amplitude_specific: 'filtered_out',
      };

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

      expect(result.persisted_utm_param).toEqual({
        utm_source: 'test_source',
        utm_medium: 'amplitude_medium',
        utm_term: 'experiment_term',
      });
    });

    it('should handle mixed undefined values across all sources', async () => {
      const currentCampaign: Partial<Campaign> = {
        utm_source: 'current_source',
        utm_medium: undefined,
        utm_campaign: undefined,
      };

      const persistedAmplitudeCampaign: Partial<Campaign> = {
        utm_source: 'amplitude_source',
        utm_medium: undefined,
        utm_term: 'amplitude_term',
      };

      const persistedExperimentCampaign = {
        utm_medium: 'experiment_medium',
        utm_campaign: 'experiment_campaign',
        utm_content: undefined,
      };

      mockCampaignParser.parse.mockResolvedValue(currentCampaign as Campaign);
      mockCookieStorage.get.mockResolvedValue(
        persistedAmplitudeCampaign as Campaign,
      );
      mockGetStorageItem.mockReturnValue(persistedExperimentCampaign);

      const result = await enrichUserWithCampaignData(apiKey, baseUser);

      expect(result.persisted_utm_param).toEqual({
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

      expect(result).toEqual({
        ...baseUser,
      });
      expect(mockSetStorageItem).not.toHaveBeenCalled();
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

      expect(result.persisted_utm_param).toMatchObject({
        utm_source: 'test_source',
        utm_medium: 'test_medium',
        utm_campaign: 'test_campaign',
        utm_term: 'test_term',
        utm_content: 'test_content',
        utm_id: 'test_id',
      });
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

      expect(result.persisted_utm_param).toMatchObject({
        utm_source: 'test',
      });
    });
  });
});
