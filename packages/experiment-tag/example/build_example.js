const fs = require('fs');
const apiKey = 'API_KEY';
const serverZone = 'SERVER_ZONE';
const initialFlags = [
  {
    key: 'test',
    metadata: {
      deployed: true,
      evaluationMode: 'remote',
      flagType: 'experiment',
      flagVersion: 1,
      deliveryMethod: 'web',
    },
    segments: [
      {
        conditions: [
          [
            {
              op: 'regex does not match',
              selector: ['context', 'page', 'url'],
              values: ['.*test-page-1.*'],
            },
          ],
        ],
        metadata: {
          segmentName: 'Page not targeted',
          trackExposure: false,
        },
        variant: 'off',
      },
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
                  },
                  selector: '.hidden .text-xl',
                  value: ';color:rgba(37, 54, 175, 1) !important',
                },
                {
                  action: 'set',
                  attribute: 'html',
                  metadata: {
                    type: 'text',
                    value: 'test-1 value',
                  },
                  selector: '.hidden .text-xl',
                  value: 'test-1 value',
                },
              ],
            },
          },
        ],
        value: 'treatment',
      },
    },
  },
  {
    key: 'test-2',
    metadata: {
      deployed: true,
      evaluationMode: 'local',
      flagType: 'experiment',
      flagVersion: 1,
      deliveryMethod: 'web',
    },
    segments: [
      {
        conditions: [
          [
            {
              op: 'regex does not match',
              selector: ['context', 'page', 'url'],
              values: ['.*test-page-2.*'],
            },
          ],
        ],
        metadata: {
          segmentName: 'Page not targeted',
          trackExposure: false,
        },
        variant: 'off',
      },
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
                  },
                  selector: '.hidden .text-xl',
                  value: ';color:rgba(37, 54, 175, 1) !important',
                },
                {
                  action: 'set',
                  attribute: 'html',
                  metadata: {
                    type: 'text',
                    value: 'test-2 value',
                  },
                  selector: '.hidden .text-xl',
                  value: 'test-2 value',
                },
              ],
            },
          },
        ],
        value: 'treatment',
      },
    },
  },
];

fs.readFile('dist/experiment-tag-min.js', 'utf8', (err, data) => {
  if (err) {
    console.error('Error reading file:', err);
    return;
  }

  // Perform string replacements
  const modifiedData = data
    .replace(/{{DEPLOYMENT_KEY}}/g, apiKey)
    .replace(/"{{INITIAL_FLAGS}}"/g, `'${JSON.stringify(initialFlags)}'`)
    .replace(/{{SERVER_ZONE}}/g, serverZone);

  // Write the modified content to a new file
  fs.writeFile('example/script.js', modifiedData, 'utf8', (err) => {
    if (err) {
      console.error('Error writing file:', err);
      return;
    }
    console.log('File successfully written!');
  });
});
