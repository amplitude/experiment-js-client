# Experiment Web Experimentation Javascript Snippet

## Overview

This is the Web Experimentation SDK for Amplitude Experiment.

## Cookie Consent Configuration

To run the script with respect to cookie consent, you can pass in the `consentOptions` in the `config` object.

```js
window.experimentConfig = {
  consentOptions: {
    status: 0, // 0: rejected, 1: granted, 2: pending
  },
};
```

If the consent status is `REJECTED`, the script will not be executed. 
If the consent status is `PENDING`, the script will be executed but the data will not be persisted in the browser's local storage. 
If the consent status is `GRANTED`, the script will be executed and the data will be persisted in the browser's local storage.

To update the consent status, you can call the `setConsentStatus` method on the `webExperiment` object.

```js
webExperiment.setConsentStatus(ConsentStatus.GRANTED);
```
