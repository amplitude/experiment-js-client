import { EvaluationFlag, EvaluationSegment } from '@amplitude/experiment-core';

export const createRedirectFlag = (
  flagKey = 'test',
  variant: 'treatment' | 'control' | 'off',
  treatmentUrl: string,
  controlUrl: string | undefined = undefined,
  pageScope: Record<string, string[]> = {},
  segments: EvaluationSegment[] = [],
  evaluationMode: 'local' | 'remote' = 'local',
): EvaluationFlag => {
  const controlPayload = controlUrl
    ? [
        {
          action: 'redirect',
          data: {
            url: controlUrl,
          },
        },
      ]
    : undefined;
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
              metadata: {
                scope: pageScope['treatment'],
              },
            },
          },
        ],
        value: 'treatment',
      },
    },
  };
};

export const createFlag = (
  flagKey = 'test',
  variant: 'treatment' | 'control' | 'off',
  evaluationMode: 'local' | 'remote' = 'local',
  blockingEvaluation = true,
  metadata: Record<string, any> = {},
): EvaluationFlag => {
  return createMutateFlag(
    flagKey,
    variant,
    [],
    [],
    evaluationMode,
    blockingEvaluation,
    metadata,
  );
};

export const createMutateFlag = (
  flagKey = 'test',
  variant: 'treatment' | 'control' | 'off',
  treatmentMutations: any[] = [],
  segments: any[] = [],
  evaluationMode: 'local' | 'remote' = 'local',
  blockingEvaluation = true,
  metadata: Record<string, any> = {},
): EvaluationFlag => {
  return {
    key: flagKey,
    metadata: {
      deployed: true,
      evaluationMode: evaluationMode,
      flagType: 'experiment',
      deliveryMethod: 'web',
      blockingEvaluation: evaluationMode === 'remote' && blockingEvaluation,
      ...metadata,
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
        payload: undefined,
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
