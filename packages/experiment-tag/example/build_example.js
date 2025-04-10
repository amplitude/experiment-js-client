const fs = require('fs');
const apiKey = 'a6dd847b9d2f03c816d4f3f8458cdc1d';
const serverZone = 'US';
const initialFlags = [
  {
    key: 'test',
    metadata: {
      deployed: true,
      evaluationMode: 'local',
      flagType: 'experiment',
      flagVersion: 1,
      deliveryMethod: 'web',
    },
    segments: [
      // {
      //   conditions: [
      //     [
      //       {
      //         op: 'regex does not match',
      //         selector: ['context', 'page', 'url'],
      //         values: ['.*dynamic.*'],
      //       },
      //     ],
      //   ],
      //   metadata: {
      //     segmentName: 'Page not targeted',
      //     trackExposure: false,
      //   },
      //   variant: 'off',
      // },
      {
        metadata: {
          segmentName: 'All Other Users',
        },
        variant: 'treatment',
      },
    ],
    variants: {
      control: {
        key: 'control',
        payload: [],
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
              mutations: [
                {
                  action: 'append',
                  attribute: 'style',
                  metadata: {
                    type: 'color',
                    value: 'rgba(37, 54, 175, 1)',
                    scope: ['A'],
                  },
                  selector:
                    'body > div.min-h-screen > main > div.container.mx-auto.px-5 > h2 > a',
                  value: ';color:rgba(37, 54, 175, 1) !important',
                },
                {
                  action: 'set',
                  attribute: 'html',
                  metadata: {
                    type: 'text',
                    value: 'tim test web remote - DYNAMIC',
                    scope: ['B'],
                  },
                  selector:
                    'body > div.min-h-screen > main > div.container.mx-auto.px-5 > h2 > a',
                  value: 'tim test web remote - DYNAMIC',
                },
              ],
            },
          },
        ],
        value: 'treatment',
      },
    },
  },
  // {
  //   key: 'test-2',
  //   metadata: {
  //     deployed: true,
  //     evaluationMode: 'local',
  //     flagType: 'experiment',
  //     flagVersion: 1,
  //     deliveryMethod: 'web',
  //   },
  //   segments: [
  //     {
  //       conditions: [
  //         [
  //           {
  //             op: 'regex does not match',
  //             selector: ['context', 'page', 'url'],
  //             values: ['.*hello.*'],
  //           },
  //         ],
  //       ],
  //       metadata: {
  //         segmentName: 'Page not targeted',
  //         trackExposure: false,
  //       },
  //       variant: 'off',
  //     },
  //     {
  //       metadata: {
  //         segmentName: 'All Other Users',
  //       },
  //       variant: 'treatment',
  //     },
  //   ],
  //   variants: {
  //     control: {
  //       key: 'control',
  //       payload: [],
  //       value: 'control',
  //     },
  //     off: {
  //       key: 'off',
  //       metadata: {
  //         default: true,
  //       },
  //     },
  //     treatment: {
  //       key: 'treatment',
  //       payload: [
  //         {
  //           action: 'mutate',
  //           data: {
  //             mutations: [
  //               {
  //                 action: 'append',
  //                 attribute: 'style',
  //                 metadata: {
  //                   type: 'color',
  //                   value: 'rgba(37, 54, 175, 1)',
  //                 },
  //                 selector: '.hidden .text-xl',
  //                 value: ';color:rgba(37, 54, 175, 1) !important',
  //               },
  //               {
  //                 action: 'set',
  //                 attribute: 'html',
  //                 metadata: {
  //                   type: 'text',
  //                   value: 'tim test web remote - HELLO',
  //                 },
  //                 selector: '.hidden .text-xl',
  //                 value: 'tim test web remote - HELLO',
  //               },
  //             ],
  //           },
  //         },
  //       ],
  //       value: 'treatment',
  //     },
  //   },
  // },
];

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
// dummy page object used for testing
const pageObjects = {
  test: {
    A: {
      conditions: [
        // page targeting conditions should be in same array to be "AND"
        // DUMMY_TRUE_CONDITION,
        [
          {
            op: 'regex match',
            selector: ['context', 'page', 'url'],
            values: ['.*hello.*'],
          },
        ],
      ],
      trigger_type: 'url_change',
      trigger_value: {
        selector:
          'body > div.min-h-screen > main > div.container.mx-auto.px-5 > h2 > a',
      },
    },
    B: {
      conditions: [
        // DUMMY_TRUE_CONDITION,
        // page targeting conditions should be in same array to be "AND"
        [
          {
            op: 'regex match',
            selector: ['context', 'page', 'url'],
            values: ['.*dynamic.*'],
          },
        ],
      ],
      trigger_type: 'url_change',
      trigger_value: {
        selector:
          'body > div.min-h-screen > main > div.container.mx-auto.px-5 > h2 > a',
      },
    },
    C: {
      conditions: [
        // page targeting conditions should be in same array to be "AND"
        // [
        //   {
        //     op: 'regex match',
        //     selector: ['context', 'page', 'url'],
        //     values: ['.*localhost.*'],
        //   },
        // ],
        DUMMY_TRUE_CONDITION,
      ],
      trigger_type: 'url_change',
      trigger_value: {
        selector:
          'body > div.min-h-screen > main > div.container.mx-auto.px-5 > h2 > a',
      },
    },
  },
};

fs.readFile('dist/experiment-tag.umd.js', 'utf8', (err, data) => {
  if (err) {
    console.error('Error reading file:', err);
    return;
  }

  // Perform string replacements
  const modifiedData = data
    .replace(/{{DEPLOYMENT_KEY}}/g, apiKey)
    .replace(/"{{INITIAL_FLAGS}}"/g, `'${JSON.stringify(initialFlags)}'`)
    .replace(/"{{PAGE_OBJECTS}}"/g, `'${JSON.stringify(pageObjects)}'`)
    .replace(/"{{SERVER_ZONE}}"/g, `${JSON.stringify(serverZone)}`);

  // Write the modified content to a new file
  fs.writeFile('example/script.js', modifiedData, 'utf8', (err) => {
    if (err) {
      console.error('Error writing file:', err);
      return;
    }
    console.log('File successfully written!');
  });
});
