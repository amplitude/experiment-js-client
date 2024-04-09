const fs = require('fs');
const apiKey = 'a6dd847b9d2f03c816d4f3f8458cdc1d';
const initialFlags = `[
  {
    "key": "test",
    "metadata": {
      "deployed": true,
      "evaluationMode": "local",
      "experimentKey": "exp-1",
      "flagType": "experiment",
      "flagVersion": 20,
      "urlMatch": [
        "http://localhost:63342/experiment-js-client/packages/experiment-tag/example/control.html/"
      ]
    },
    "segments": [
      {
        "metadata": {
          "segmentName": "All Other Users"
        },
        "variant": "treatment"
      }
    ],
    "variants": {
      "control": {
        "key": "control",
        "payload": [
          {
            "action": "redirect",
            "data": {
              "url": "http://localhost:63342/experiment-js-client/packages/experiment-tag/example/control.html"
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
              "url": "http://localhost:63342/experiment-js-client/packages/experiment-tag/example/treatment.html"
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
