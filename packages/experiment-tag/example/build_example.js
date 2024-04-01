const fs = require('fs');
const apiKey = 'client-DvWljIjiiuqLbyjqdvBaLFfEBrAvGuA3';
const initialFlags = `[
  {
    "key": "peter-test-default-1",
    "metadata": {
      "deployed": true,
      "evaluationMode": "local",
      "experimentKey": "exp-1",
      "flagType": "experiment",
      "flagVersion": 20,
      "urlMatch": [
        "http://localhost:63342/experiment-js-client/packages/experiment-tag/example/index.html/"
      ]
    },
    "segments": [
          {
            metadata: {
              segmentName: 'All Other Users',
            },
            variant: treatment,
          },
        ],
    "variants": {
      "control": {
        "key": "control",
        "payload": [
          {
            "action": "redirect",
            "data": {
              "url": "http://localhost:63342/experiment-js-client/packages/experiment-tag/example/index.html"
            }
          }
        ],
        "value": "control"
      },
      "off": {
        "key": "off",
        "metadata": {
          "default": true
        }
      },
      "treatment": {
        "key": "treatment",
        "payload": [
          {
            "action": "redirect",
            "data": {
              "url": "http://localhost:63342/experiment-js-client/packages/experiment-tag/example/index2.html"
            }
          }
        ],
        "value": "treatment"
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
