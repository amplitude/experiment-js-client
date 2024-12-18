export const createRedirectFlag = (
  flagKey = 'test',
  variant: 'treatment' | 'control' | 'off',
  treatmentUrl: string,
  controlUrl: string | undefined = undefined,
  segments: any[] = [],
  evaluationMode = 'local',
) => {
  const controlPayload = controlUrl
    ? [
        {
          action: 'redirect',
          data: {
            url: controlUrl,
          },
        },
      ]
    : [];
  return {
    key: flagKey,
    metadata: {
      deployed: true,
      evaluationMode: evaluationMode,
      flagType: 'experiment',
      deliveryMethod: 'web',
    },
    segments: [
      ...segments,
      {
        metadata: {
          segmentName: 'All Other Users',
        },
        variant: variant,
      },
    ],
    variants: {
      control: {
        key: 'control',
        payload: controlPayload,
        value: 'control',
      },
      off: {
        key: 'off',
        metadata: {
          default: true,
        },
      },
      treatment: {
        key: 'treatment',
        payload: [
          {
            action: 'redirect',
            data: {
              url: treatmentUrl,
            },
          },
        ],
        value: 'treatment',
      },
    },
  };
};

export const createMutateFlag = (
  flagKey = 'test',
  variant: 'treatment' | 'control' | 'off',
  treatmentMutations: any[] = [],
  controlMutations: any[] = [],
  segments: any[] = [],
  evaluationMode = 'local',
) => {
  return {
    key: flagKey,
    metadata: {
      deployed: true,
      evaluationMode: evaluationMode,
      flagType: 'experiment',
      deliveryMethod: 'web',
    },
    segments: [
      ...segments,
      {
        metadata: {
          segmentName: 'All Other Users',
        },
        variant: variant,
      },
    ],
    variants: {
      control: {
        key: 'control',
        payload: [
          {
            action: 'mutate',
            data: {
              mutations: controlMutations,
            },
          },
        ],
        value: 'control',
      },
      off: {
        key: 'off',
        metadata: {
          default: true,
        },
      },
      treatment: {
        key: 'treatment',
        payload: [
          {
            action: 'mutate',
            data: {
              mutations: treatmentMutations,
            },
          },
        ],
        value: 'treatment',
      },
    },
  };
};
