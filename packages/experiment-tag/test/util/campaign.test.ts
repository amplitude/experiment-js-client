import {
  type Campaign,
  CampaignParser,
  getStorageKey,
} from '@amplitude/analytics-core';
import { type ExperimentUser } from '@amplitude/experiment-js-client';

import {
  enrichUserWithCampaignData,
  persistUrlParams,
} from '../../src/util/campaign';
import { readCookieStorageSync } from '../../src/util/cookie';
import * as storageUtils from '../../src/util/storage';

jest.mock('@amplitude/analytics-core', () => ({
  Campaign: jest.fn(),
  CampaignParser: jest.fn(),
  BASE_CAMPAIGN: {},
  getStorageKey: jest.fn(),
  MKTG: 'MKTG',
}));

// Campaign resolution now reads the marketing cookie synchronously via
// readCookieStorageSync rather than the async CookieStorage.
jest.mock('../../src/util/cookie', () => ({
  readCookieStorageSync: jest.fn(),
}));

jest.mock('../../src/util/storage', () => ({
  getStorageItem: jest.fn(),
  setStorageItem: jest.fn(),
}));

describe('campaign utilities', () => {
  let mockCampaignParser: jest.Mocked<CampaignParser>;
  let mockGetStorageItem: jest.MockedFunction<
    typeof storageUtils.getStorageItem
  >;
  let mockSetStorageItem: jest.MockedFunction<
    typeof storageUtils.setStorageItem
  >;
  let mockGetStorageKey: jest.MockedFunction<typeof getStorageKey>;
  let mockReadCookieStorageSync: jest.MockedFunction<
    typeof readCookieStorageSync
  >;

  beforeEach(() => {
    jest.clearAllMocks();

    mockCampaignParser = {
      getUtmParam: jest.fn().mockReturnValue({}),
      getReferrer: jest.fn().mockReturnValue({}),
      getClickIds: jest.fn().mockReturnValue({}),
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
    mockReadCookieStorageSync = readCookieStorageSync as jest.MockedFunction<
      typeof readCookieStorageSync
    >;

    (CampaignParser as jest.Mock).mockImplementation(() => mockCampaignParser);
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

    it('should enrich user with UTM parameters from all sources with correct priority', () => {
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

      mockCampaignParser.getUtmParam.mockReturnValue(currentCampaign as any);
      mockReadCookieStorageSync.mockReturnValue(
        persistedAmplitudeCampaign as Campaign,
      );
      mockGetStorageItem.mockReturnValue(persistedExperimentCampaign);

      const result = enrichUserWithCampaignData(apiKey, baseUser);

      expect(result).toEqual({
        ...baseUser,
        persisted_url_param: {
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

    it('should preserve lower priority values when current campaign has undefined values', () => {
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

      mockCampaignParser.getUtmParam.mockReturnValue(currentCampaign as any);
      mockReadCookieStorageSync.mockReturnValue(
        persistedAmplitudeCampaign as Campaign,
      );
      mockGetStorageItem.mockReturnValue(persistedExperimentCampaign);

      const result = enrichUserWithCampaignData(apiKey, baseUser);

      expect(result.persisted_url_param).toEqual({
        utm_source: 'current_source',
        utm_medium: 'experiment_medium',
        utm_campaign: 'current_campaign',
        utm_term: 'amplitude_term',
        utm_content: 'experiment_content',
      });
    });

    it('should filter out non-UTM parameters from all sources', () => {
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

      mockCampaignParser.getUtmParam.mockReturnValue(currentCampaign as any);
      mockReadCookieStorageSync.mockReturnValue(
        persistedAmplitudeCampaign as Campaign,
      );
      mockGetStorageItem.mockReturnValue(persistedExperimentCampaign);

      const result = enrichUserWithCampaignData(apiKey, baseUser);

      expect(result.persisted_url_param).toEqual({
        utm_source: 'test_source',
        utm_medium: 'amplitude_medium',
        utm_term: 'experiment_term',
      });
    });

    it('should handle mixed undefined values across all sources', () => {
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

      mockCampaignParser.getUtmParam.mockReturnValue(currentCampaign as any);
      mockReadCookieStorageSync.mockReturnValue(
        persistedAmplitudeCampaign as Campaign,
      );
      mockGetStorageItem.mockReturnValue(persistedExperimentCampaign);

      const result = enrichUserWithCampaignData(apiKey, baseUser);

      expect(result.persisted_url_param).toEqual({
        utm_source: 'current_source',
        utm_medium: 'experiment_medium',
        utm_campaign: 'experiment_campaign',
        utm_term: 'amplitude_term',
      });
    });

    it('should handle empty campaign data gracefully', () => {
      mockCampaignParser.getUtmParam.mockReturnValue({} as any);
      mockReadCookieStorageSync.mockReturnValue(undefined);
      mockGetStorageItem.mockReturnValue(null);

      const result = enrichUserWithCampaignData(apiKey, baseUser);

      expect(result).toEqual({
        ...baseUser,
      });
      expect(mockSetStorageItem).not.toHaveBeenCalled();
    });

    it('should handle all UTM parameter types', () => {
      const fullCampaign: Partial<Campaign> = {
        utm_source: 'test_source',
        utm_medium: 'test_medium',
        utm_campaign: 'test_campaign',
        utm_term: 'test_term',
        utm_content: 'test_content',
        utm_id: 'test_id',
      };

      mockCampaignParser.getUtmParam.mockReturnValue(fullCampaign as any);
      mockReadCookieStorageSync.mockReturnValue(undefined);
      mockGetStorageItem.mockReturnValue(null);

      const result = enrichUserWithCampaignData(apiKey, baseUser);

      expect(result.persisted_url_param).toMatchObject({
        utm_source: 'test_source',
        utm_medium: 'test_medium',
        utm_campaign: 'test_campaign',
        utm_term: 'test_term',
        utm_content: 'test_content',
        utm_id: 'test_id',
      });
    });

    it('should propagate errors from campaign parsing', () => {
      mockCampaignParser.getUtmParam.mockImplementation(() => {
        throw new Error('Parse error');
      });
      mockGetStorageItem.mockReturnValue(null);

      expect(() => enrichUserWithCampaignData(apiKey, baseUser)).toThrow(
        'Parse error',
      );
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

      persistUrlParams(apiKey, campaign);

      expect(mockSetStorageItem).toHaveBeenCalledWith(
        'localStorage',
        'EXP_MKTG_test-api-k',
        campaign,
      );
    });

    it('should handle empty campaign object', () => {
      const emptyCampaign = {};

      persistUrlParams(apiKey, emptyCampaign);

      expect(mockSetStorageItem).toHaveBeenCalledWith(
        'localStorage',
        'EXP_MKTG_test-api-k',
        emptyCampaign,
      );
    });
  });

  describe('fetchCampaignData (internal function behavior)', () => {
    const apiKey = 'test-api-key';

    it('should read the current campaign and the persisted marketing cookie', () => {
      const expectedCampaign: Partial<Campaign> = { utm_source: 'test' };
      const expectedPreviousCampaign: Partial<Campaign> = {
        utm_medium: 'previous',
      };

      mockCampaignParser.getUtmParam.mockReturnValue(expectedCampaign as any);
      mockReadCookieStorageSync.mockReturnValue(
        expectedPreviousCampaign as Campaign,
      );
      mockGetStorageKey.mockReturnValue('test-storage-key');
      mockGetStorageItem.mockReturnValue(null);

      enrichUserWithCampaignData(apiKey, { user_id: 'test' });

      expect(CampaignParser).toHaveBeenCalledWith();
      expect(getStorageKey).toHaveBeenCalledWith(apiKey, 'MKTG');
      expect(mockReadCookieStorageSync).toHaveBeenCalledWith(
        'test-storage-key',
      );
    });

    it('should handle null previous campaign', () => {
      const expectedCampaign: Partial<Campaign> = { utm_source: 'test' };

      mockCampaignParser.getUtmParam.mockReturnValue(expectedCampaign as any);
      mockReadCookieStorageSync.mockReturnValue(undefined);
      mockGetStorageItem.mockReturnValue(null);

      const result = enrichUserWithCampaignData(apiKey, {
        user_id: 'test',
      });

      expect(result.persisted_url_param).toMatchObject({
        utm_source: 'test',
      });
    });
  });
});
