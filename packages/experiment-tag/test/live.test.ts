import { initializeExperiment } from 'src/experiment';

import { createMutateFlag } from './util/create-flag';

describe('live', () => {
  test('live remote', async () => {
    const initialRemote = JSON.stringify([
      createMutateFlag('tim-test-web-remote', 'control', [], [], [], 'remote'),
    ]);
    // Test that the flag is live and the treatment is returned
    await initializeExperiment(
      'client-DvWljIjiiuqLbyjqdvBaLFfEBrAvGuA3',
      initialRemote,
      {
        flagsServerUrl: 'http://localhost:3034',
      },
    );
  });
});
