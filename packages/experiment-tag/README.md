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
| `pending` | The script does **not** run. No client is constructed, so there is no storage access, evaluation, variant application, tracking, or relay. `pending → granted` starts the script. |
| `rejected` | The script does **not** run. **Terminal for the page load** — a later `granted` is ignored until the next reload. |

In v0, `pending` and `rejected` are identical at the moment they are set (nothing
runs). They differ in what can happen next: from `pending` a later `granted`
starts the script, while `rejected` latches the gate closed so a later `granted`
does nothing until the page reloads.

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
  window.webExperiment?.setConsentStatus?.(consented ? 'granted' : 'rejected');
}

// Cookiebot
window.addEventListener('CookiebotOnAccept', function () {
  window.webExperiment?.setConsentStatus?.('granted');
});
window.addEventListener('CookiebotOnDecline', function () {
  window.webExperiment?.setConsentStatus?.('rejected');
});
```

**Load order matters.** `setConsentStatus` lives on `window.webExperiment`, which
is created when the experiment tag runs `initialize()` — not before the tag has
loaded at all. It is available before the client is fully constructed (that's why
a grant can be recorded early), but a CMP that fires _before_ the tag loads will
find `window.webExperiment` undefined. Two ways to stay safe:

- **Preferred (race-free):** set the initial decision declaratively in
  `window.experimentConfig.consentOptions.consentStatus` above, and load the
  experiment tag as early as possible (before or alongside the CMP). Then the tag
  reads the correct status on load and no early runtime call is needed.
- **Runtime calls:** guard them with optional chaining
  (`window.webExperiment?.setConsentStatus?.(...)`, as shown) so a call that fires
  before the tag loads is a no-op rather than a `TypeError`. Pair this with the
  declarative initial status so consent is never lost.

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
- `rejected` is terminal for the page load: if a user declines and then changes
  their mind in the same page load (`rejected → granted`), the script does not
  start until the next reload.

