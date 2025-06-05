import { EvaluationVariant } from '@amplitude/experiment-core';
import { Variant } from '@amplitude/experiment-js-client';

export const convertEvaluationVariantToVariant = (
  evaluationVariant: EvaluationVariant,
): Variant => {
  if (!evaluationVariant) {
    return {};
  }
  let experimentKey: string | undefined = undefined;
  if (evaluationVariant.metadata) {
    if (typeof evaluationVariant.metadata['experimentKey'] === 'string') {
      experimentKey = evaluationVariant.metadata['experimentKey'];
    } else {
      experimentKey = undefined;
    }
  }
  const variant: Variant = {};
  if (evaluationVariant.key) variant.key = evaluationVariant.key;
  if (evaluationVariant.value)
    variant.value = evaluationVariant.value as string;
  if (evaluationVariant.payload) variant.payload = evaluationVariant.payload;
  if (experimentKey) variant.expKey = experimentKey;
  if (evaluationVariant.metadata) variant.metadata = evaluationVariant.metadata;
  return variant;
};
