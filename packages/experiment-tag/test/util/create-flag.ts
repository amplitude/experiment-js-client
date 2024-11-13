export const createRedirectFlag = (
  flagKey = 'test',
  variant: string,
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