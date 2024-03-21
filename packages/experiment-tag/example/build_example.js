const fs = require('fs');
const apiKey = 'client-DvWljIjiiuqLbyjqdvBaLFfEBrAvGuA3';
const initialFlags = `[
  {
    "key": "test",
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
        "metadata": {
          "segmentName": "All Other Users"
        },
        "variant": "off"
      }
    ],
    "variants": {
      "off": {
        "key": "off",
        "value": "off",
        "payload": [
          {
            "action": "redirect",
            "data": {
              "url": "http://localhost:63342/experiment-js-client/packages/experiment-tag/example/index.html"
            }
          }
        ],
        "metadata": {
          "default": true
        }
      },
      "on": {
        "key": "on",
        "value": "on",
        "payload": [
          {
            "action": "redirect",
            "data": {
              "url": "http://localhost:63342/experiment-js-client/packages/experiment-tag/example/index2.html"
            }
          }
        ],
        "metadata": {}
      }
    }
  },
  {
    "key": "tim-test-redesign",
    "metadata": {
      "deployed": true,
      "evaluationMode": "remote",
      "experimentKey": "exp-1",
      "flagType": "experiment",
      "flagVersion": 32
    },
    "segments": [
      {
        "metadata": {
          "segmentName": "default"
        },
        "variant": "off"
      }
    ],
    "variants": {
      "control": {
        "key": "control",
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
        "value": "treatment"
      }
    }
  }
]`.replace(/\n\s*/g, '');

fs.readFile('dist/experiment-tag.umd.js', 'utf8', (err, data) => {
  if (err) {
    console.error('Error reading file:', err);
    return;
  }

  // Perform string replacements
  const modifiedData = data
    .replace(/EXPERIMENT_TAG_API_KEY/g, apiKey)
    .replace(/"EXPERIMENT_TAG_INITIAL_FLAGS"/g, `'${initialFlags}'`);

  // Write the modified content to a new file
  fs.writeFile('example/script.js', modifiedData, 'utf8', (err) => {
    if (err) {
      console.error('Error writing file:', err);
      return;
    }
    console.log('File successfully written!');
  });
});
