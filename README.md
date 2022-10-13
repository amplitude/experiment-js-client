<p align="center">
  <a href="https://amplitude.com" target="_blank" align="center">
    <img src="https://static.amplitude.com/lightning/46c85bfd91905de8047f1ee65c7c93d6fa9ee6ea/static/media/amplitude-logo-with-text.4fb9e463.svg" width="280">
  </a>
  <br />
</p>


# Experiment Browser SDK

## Overview

This is the JavaScript client (web browser) SDK for Experiment, Amplitude's
experimentation and feature management platform.

## Getting Started

Refer to the [Javascript SDK Developer Documentation](https://www.docs.developers.amplitude.com/experiment/sdks/javascript-sdk/) to get started.

## Examples

This repo contains various example applications for getting familiar with the 
SDK usage. Each example has two applications, one with a basic example, and 
another with an example for integrating with the amplitude analytics SDK.

 * Script Tag (HTML)
   * [Basic Example](https://github.com/amplitude/experiment-js-client/tree/main/examples/html-app/basic)
   * [Amplitude Analytics SDK Integration](https://github.com/amplitude/experiment-js-client/tree/main/examples/html-app/amplitude-integration)

## Browser Compatibility

This SDK works with all major browsers and IE10+. The SDK does make use of
Promises, so if you are targeting a browser that does not have native support
for Promise (for example, IE), you should include a polyfill for Promise, (for
example, [es6-promise](https://github.com/stefanpenner/es6-promise)).
