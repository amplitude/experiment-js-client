describe('VariantsStreamUpdater tests', () => {
  it('connect success and receive data', async () => {});
  it('connect error throws', async () => {});
  it('connect success then stream error', async () => {});
});
describe('VariantsFetchUpdater tests', () => {
  it('fetches variant', async () => {});
  it('first fetch failed would retry but does not throw', async () => {});
  it('all fetches fails does nothing', async () => {});
});
describe('RetryAndFallbackWrapperUpdater tests', () => {
  it('main start success, no fallback start, wrapper start success', async () => {});
  it('main start failed, fallback start success, wrapper start success', async () => {});
  it('main start failed, fallback start failed, wrapper start fail', async () => {});
  it('main start success, then failed, fallback starts, main retry success, fallback stopped', async () => {});
  it('main start success, then failed, fallback start failed, fallback retry success, main retry success, fallback stopped', async () => {});
  it('main start success, then failed, fallback start failed, main retry success, fallback stopped retrying', async () => {});
});
