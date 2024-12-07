import { EvaluationVariant, getGlobalScope } from '@amplitude/experiment-core';

import { ExperimentUser } from '../types/user';
import { Variant } from '../types/variant';

export const convertUserToContext = (
  user: ExperimentUser | undefined,
): Record<string, unknown> => {
  if (!user) {
    return {};
  }
  const context: Record<string, unknown> = { user: user };
  // add page context
  const globalScope = getGlobalScope();
  if (globalScope) {
    context.page = {
      url: globalScope.location.href,
    };
  }
  const groups: Record<string, Record<string, unknown>> = {};
  if (!user.groups) {
    return context;
  }
  for (const groupType of Object.keys(user.groups)) {
    const groupNames = user.groups[groupType];
    if (groupNames.length > 0 && groupNames[0]) {
      const groupName = groupNames[0];
      const groupNameMap: Record<string, unknown> = {
        group_name: groupName,
      };
      // Check for group properties
      const groupProperties = user.group_properties?.[groupType]?.[groupName];
      if (groupProperties && Object.keys(groupProperties).length > 0) {
        groupNameMap['group_properties'] = groupProperties;
      }
      groups[groupType] = groupNameMap;
    }
  }
  if (Object.keys(groups).length > 0) {
    context['groups'] = groups;
  }
  delete context.user['groups'];
  delete context.user['group_properties'];
  return context;
};

export const convertVariant = (value: string | Variant): Variant => {
  if (value === null || value === undefined) {
    return {};
  }
  if (typeof value == 'string') {
    return {
      key: value,
      value: value,
    };
  } else {
    return value;
  }
};

export const convertEvaluationVariantToVariant = (
  evaluationVariant: EvaluationVariant,
): Variant => {
  if (!evaluationVariant) {
    return {};
  }
  let experimentKey = undefined;
  if (evaluationVariant.metadata) {
    experimentKey = evaluationVariant.metadata['experimentKey'];
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
