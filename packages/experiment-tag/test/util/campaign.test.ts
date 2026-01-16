import {
  type Campaign,
  CampaignParser,
  CookieStorage,
  getStorageKey,
} from '@amplitude/analytics-core';
import * as coreUtil from '@amplitude/experiment-core';
import { type ExperimentUser } from '@amplitude/experiment-js-client';

import { ConsentAwareStorage } from '../../src/storage/consent-aware-storage';
import { ConsentStatus } from '../../src/types';
import {
  enrichUserWithCampaignData,
  persistUrlParams,
} from '../../src/util/campaign';

const spyGetGlobalScope = jest.spyOn(coreUtil, 'getGlobalScope');

jest.mock('@amplitude/analytics-core', () => ({
  Campaign: jest.fn(),
  CampaignParser: jest.fn(),
  CookieStorage: jest.fn(),
  getStorageKey: jest.fn(),
  MKTG: 'MKTG',
}));

const MockCampaignParser = CampaignParser as jest.MockedClass<
  typeof CampaignParser
>;
const MockCookieStorage = CookieStorage as jest.MockedClass<
  typeof CookieStorage
>;

describe('campaign utilities', () => {
  let mockGlobal: any;
  let storage: ConsentAwareStorage;
  let mockCampaignParser: jest.Mocked<CampaignParser>;
  let mockCookieStorage: jest.Mocked<CookieStorage<Campaign>>;
  let mockGetStorageKey: jest.MockedFunction<typeof getStorageKey>;

  const createStorageMock = () => {
    let store: Record<string, string> = {};
    return {
      getItem: jest.fn((key: string) => store[key] || null),
      setItem: jest.fn((key: string, value: string) => {
        store[key] = value;
      }),
      removeItem: jest.fn((key: string) => {
        delete store[key];
      }),
      clear: jest.fn(() => {
        store = {};
      }),
      length: jest.fn(() => Object.keys(store).length),
      key: jest.fn((index: number) => Object.keys(store)[index] || null),
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockGlobal = {
      localStorage: createStorageMock(),
      sessionStorage: createStorageMock(),
    };
    spyGetGlobalScope.mockReturnValue(mockGlobal);

    storage = new ConsentAwareStorage(ConsentStatus.GRANTED);

    mockCampaignParser = {
      parse: jest.fn(),
    } as any;

    mockCookieStorage = {
      get: jest.fn(),
      set: jest.fn(),
    } as any;

    mockGetStorageKey = getStorageKey as jest.MockedFunction<
      typeof getStorageKey
    >;

    MockCampaignParser.mockImplementation(() => mockCampaignParser);
    MockCookieStorage.mockImplementation(() => mockCookieStorage);
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
      storage.setItem(
        'localStorage',
        'EXP_MKTG_test-api-k',
        persistedExperimentCampaign,
      );

      const result = await enrichUserWithCampaignData(
        apiKey,
        baseUser,
        storage,
      );

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

      expect(storage.getItem('localStorage', 'EXP_MKTG_test-api-k')).toEqual({
        utm_source: 'current_source',
        utm_medium: 'current_medium',
        utm_campaign: 'current_campaign',
        utm_term: 'experiment_term',
        utm_content: 'amplitude_content',
        utm_id: 'experiment_id',
      });
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
      storage.setItem(
        'localStorage',
        'EXP_MKTG_test-api-k',
        persistedExperimentCampaign,
      );

      const result = await enrichUserWithCampaignData(
        apiKey,
        baseUser,
        storage,
      );

      expect(result.persisted_url_param).toEqual({
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
      storage.setItem(
        'localStorage',
        'EXP_MKTG_test-api-k',
        persistedExperimentCampaign,
      );

      const result = await enrichUserWithCampaignData(
        apiKey,
        baseUser,
        storage,
      );

      expect(result.persisted_url_param).toEqual({
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
      storage.setItem(
        'localStorage',
        'EXP_MKTG_test-api-k',
        persistedExperimentCampaign,
      );

      const result = await enrichUserWithCampaignData(
        apiKey,
        baseUser,
        storage,
      );

      expect(result.persisted_url_param).toEqual({
        utm_source: 'current_source',
        utm_medium: 'experiment_medium',
        utm_campaign: 'experiment_campaign',
        utm_term: 'amplitude_term',
      });
    });

    it('should handle empty campaign data gracefully', async () => {
      mockCampaignParser.parse.mockResolvedValue({} as Campaign);
      mockCookieStorage.get.mockResolvedValue(undefined);

      const result = await enrichUserWithCampaignData(
        apiKey,
        baseUser,
        storage,
      );

      expect(result).toEqual({
        ...baseUser,
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

      const result = await enrichUserWithCampaignData(
        apiKey,
        baseUser,
        storage,
      );

      expect(result.persisted_url_param).toMatchObject({
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

      await expect(
        enrichUserWithCampaignData(apiKey, baseUser, storage),
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

      persistUrlParams(apiKey, campaign, storage);

      expect(storage.getItem('localStorage', 'EXP_MKTG_test-api-k')).toEqual(
        campaign,
      );
    });

    it('should handle empty campaign object', () => {
      const emptyCampaign = {};

      persistUrlParams(apiKey, emptyCampaign, storage);

      expect(storage.getItem('localStorage', 'EXP_MKTG_test-api-k')).toEqual(
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

      await enrichUserWithCampaignData(apiKey, { user_id: 'test' }, storage);

      expect(MockCampaignParser).toHaveBeenCalledWith();
      expect(mockCampaignParser.parse).toHaveBeenCalledWith();
      expect(MockCookieStorage).toHaveBeenCalledWith();
      expect(getStorageKey).toHaveBeenCalledWith(apiKey, 'MKTG');
      expect(mockCookieStorage.get).toHaveBeenCalledWith('test-storage-key');
    });

    it('should handle null previous campaign', async () => {
      const expectedCampaign: Partial<Campaign> = { utm_source: 'test' };

      mockCampaignParser.parse.mockResolvedValue(expectedCampaign as Campaign);
      mockCookieStorage.get.mockResolvedValue(undefined);

      const result = await enrichUserWithCampaignData(
        apiKey,
        {
          user_id: 'test',
        },
        storage,
      );

      expect(result.persisted_url_param).toMatchObject({
        utm_source: 'test',
      });
    });
  });
});
