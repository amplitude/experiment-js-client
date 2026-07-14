# Experiment Web Experimentation Javascript Snippet

## Overview

This is the Web Experimentation SDK for Amplitude Experiment.

## Generate example

To generate an example snippet with custom flag configurations:
1. Set `apiKey` (your Amplitude Project API key), `initialFlags` and `serverZone` in `example/build_example.js`
2. Run `yarn build` to build minified UMD `experiment-tag.umd.js` and example `script.js`

To test the snippet's behavior on web pages relevant to your experiment, the pages should:
1. Include `script.js`
2. Have the Amplitude Analytics SDK loaded (see [examples](https://github.com/amplitude/Amplitude-TypeScript/tree/main/packages/analytics-browser))

## Cookie consent

The script can be gated on end-user consent so that no experiment storage
(cookies / localStorage / sessionStorage), evaluation, variant application,
impression tracking, or cross-subdomain relay happens before the user agrees.
Consent is opt-in: without `consentOptions.consentRequired`, behavior is
unchanged.

### States

| Status | Behavior |
| --- | --- |
| `granted` | The script runs normally (evaluate flags, apply variants, track impressions, persist identity/session). |
| `pending` | The script does **not** run. No client is constructed, so there is no storage access, evaluation, variant application, tracking, or relay. |
| `rejected` | The script does **not** run. |

> **Flicker on grant:** when consent moves from `pending` to `granted`, the
> script starts fresh at that moment, so the user may briefly see the original
> page before variants apply. A future version runs experiments in-memory
> during `pending` to remove this flicker; the configuration below does not
> change.

### Setup

Set the initial status before the script loads:

```html
<script>
  window.experimentConfig = {
    consentOptions: {
      consentRequired: true,     // default false — feature off, behavior unchanged
      consentStatus: 'pending',  // 'granted' | 'pending' | 'rejected' (default 'pending')
    },
  };
</script>
```

Then tell the script when the user decides, from your CMP callback:

```js
// OneTrust
function OptanonWrapper() {
  const consented = OnetrustActiveGroups.includes('C0002'); // your targeting/perf group
  window.webExperiment.setConsentStatus(consented ? 'granted' : 'rejected');
}

// Cookiebot
window.addEventListener('CookiebotOnAccept', function () {
  window.webExperiment.setConsentStatus('granted');
});
window.addEventListener('CookiebotOnDecline', function () {
  window.webExperiment.setConsentStatus('rejected');
});
```

`setConsentStatus` is available on `window.webExperiment` immediately (before the
client finishes loading), so it is safe to call from a CMP callback that resolves
early.

### Pairing with the Amplitude Analytics SDK

For unified-script deployments, the Analytics SDK has its own consent controls
(deferred initialization, `identityStorage: 'none'`, `optOut`). Configure both so
analytics and experimentation honor the same decision — see
[Analytics cookies & consent management](https://amplitude.com/docs/sdks/analytics/browser/cookies-and-consent-management).

### Limitations (v0)

- A user who never resolves the consent banner gets no experiments and fires no
  impressions.
- Revoking consent mid-session (`granted → rejected`) is "reload to reset" — the
  already-running client is not torn down until the next page load.

