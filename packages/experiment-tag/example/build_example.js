const fs = require('fs');
const apiKey = 'client-DvWljIjiiuqLbyjqdvBaLFfEBrAvGuA3';
const initialFlags = `[
  {
    "key": "split-url-test",
    "metadata": {
      "evaluationMode": "local",
      "flagType": "experiment",
      "flagVersion": 1,
      "urlMatch": [
        "http://localhost:63342/experiment-js-client/packages/experiment-tag/example/index.html"
      ]
    },
    "segments": [
      {
        "bucket": {
          "allocations": [
            {
              "distributions": [
                {
                  "range": [0, 429497],
                  "variant": "control"
                },
                {
                  "range": [429496, 42949673],
                  "variant": "treatment"
                }
              ],
              "range": [0, 100]
            }
          ],
          "salt": "r1wFYK2v",
          "selector": ["context", "user", "device_id"]
        },
        "metadata": {
          "segmentName": "All Other Users"
        },
        "variant": "off"
      }
    ],
    "variants": {
      "control": {
        "key": "control",
        "value": "control",
        "payload": [
          {
            "action": "redirect",
            "data": {
              "url": "http://localhost:63342/experiment-js-client/packages/experiment-tag/example/index.html"
            }
          }
        ]
      },
      "off": {
        "key": "off",
        "metadata": {
          "default": true
        }
      },
      "treatment": {
        "key": "treatment",
        "value": "treatment",
        "payload": [
          {
            "action": "redirect",
            "data": {
              "url": "http://localhost:63342/experiment-js-client/packages/experiment-tag/example/index2.html"
            }
          }
        ]
      }
    }
  }
]
`.replace(/\n\s*/g, '');

fs.readFile('dist/experiment-tag.umd.js', 'utf8', (err, data) => {
  if (err) {
    console.error('Error reading file:', err);
    return;
  }

  // Perform string replacements
  const modifiedData = data
    .replace(/{{DEPLOYMENT_KEY}}/g, apiKey)
    .replace(/"{{INITIAL_FLAGS}}"/g, `'${initialFlags}'`);

  // Write the modified content to a new file
  fs.writeFile('example/script.js', modifiedData, 'utf8', (err) => {
    if (err) {
      console.error('Error writing file:', err);
      return;
    }
    console.log('File successfully written!');
  });
});
