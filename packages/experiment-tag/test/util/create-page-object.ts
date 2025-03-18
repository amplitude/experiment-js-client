import { MessageType } from 'src/message-bus';

const DUMMY_TRUE_CONDITION = [
  {
    op: 'is',
    selector: [],
    values: ['(none)'],
  },
];

const DUMMY_FALSE_CONDITION = [
  {
    op: 'is not',
    selector: [],
    values: ['(none)'],
  },
];

export const createPageObject = (
  name: string,
  triggerType: MessageType,
  triggerProperties?: Record<string, unknown>,
  urlContains?: string,
) => {
  let conditions: any[] = [DUMMY_TRUE_CONDITION];
  if (triggerType === 'url_change') {
    conditions = [
      // page targeting conditions should be in same array to be "AND"
      // DUMMY_TRUE_CONDITION,
      [
        {
          op: 'regex match',
          selector: ['context', 'page', 'url'],
          values: [`.*${urlContains}.*`],
        },
      ],
    ];
  }
  return {
    [name]: {
      conditions: conditions,
      trigger: {
        type: triggerType,
        properties: {
          ...triggerProperties,
        },
      },
    },
  };
};
