# Experiment Web Experimentation Javascript Snippet

## Overview

This is the Web Experimentation SDK for Amplitude Experiment. Currently, only split-URL experiments are supported.

## Generate example

To generate an example snippet with custom flag configurations:
1. Set `apiKey` (your Amplitude Project API key) and `initialFlags` in `example/build_example.js`
2. Run `yarn build` to build minified UMD `experiment-tag.umd.js` and example `script.js`

To test the snippet's behavior on web pages relevant to your experiment, the pages should:
1. Include `script.js`
2. Have the Amplitude Analytics SDK loaded (see [examples](https://github.com/amplitude/Amplitude-TypeScript/tree/main/packages/analytics-browser))

