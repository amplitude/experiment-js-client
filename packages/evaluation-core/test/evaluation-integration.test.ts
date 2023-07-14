import fetch from 'unfetch';

import { EvaluationEngine, EvaluationFlag } from '../src';

const deploymentKey = 'server-NgJxxvg8OGwwBsWVXqyxQbdiflbhvugy';
const engine = new EvaluationEngine();
let flags: EvaluationFlag[];

beforeAll(async () => {
  flags = await getFlags(deploymentKey);
});

// Basic Tests

test('test off', () => {
  const user = userContext('user_id', 'device_id');
  const result = engine.evaluate(user, flags)['test-off'];
  expect(result?.key).toEqual('off');
});

test('test on', () => {
  const user = userContext('user_id', 'device_id');
  const result = engine.evaluate(user, flags)['test-on'];
  expect(result?.key).toEqual('on');
});

// Opinionated Segment Tests

test('test individual inclusions match', () => {
  // Match user ID
  let user = userContext('user_id');
  let result = engine.evaluate(user, flags)['test-individual-inclusions'];
  expect(result?.key).toEqual('on');
  expect(result?.metadata['segmentName']).toEqual('individual-inclusions');
  // Match device ID
  user = userContext(undefined, 'device_id');
  result = engine.evaluate(user, flags)['test-individual-inclusions'];
  expect(result?.key).toEqual('on');
  expect(result?.metadata['segmentName']).toEqual('individual-inclusions');
  // Doesn't match user ID
  user = userContext('not_user_id');
  result = engine.evaluate(user, flags)['test-individual-inclusions'];
  expect(result?.key).toEqual('off');
  // Doesn't match device ID
  user = userContext(undefined, 'not_device_id');
  result = engine.evaluate(user, flags)['test-individual-inclusions'];
  expect(result?.key).toEqual('off');
});

test('test flag dependencies on', () => {
  const user = userContext('user_id', 'device_id');
  const result = engine.evaluate(user, flags)['test-flag-dependencies-on'];
  expect(result?.key).toEqual('on');
});

test('test flag dependencies off', () => {
  const user = userContext('user_id', 'device_id');
  const result = engine.evaluate(user, flags)['test-flag-dependencies-off'];
  expect(result?.key).toEqual('off');
  expect(result?.metadata['segmentName']).toEqual('flag-dependencies');
});

test('test sticky bucketing', () => {
  // On
  let user = userContext('user_id', 'device_id', undefined, {
    '[Experiment] test-sticky-bucketing': 'on',
  });
  let result = engine.evaluate(user, flags)['test-sticky-bucketing'];
  expect(result?.key).toEqual('on');
  expect(result?.metadata['segmentName']).toEqual('sticky-bucketing');
  // Off
  user = userContext('user_id', 'device_id', undefined, {
    '[Experiment] test-sticky-bucketing': 'off',
  });
  result = engine.evaluate(user, flags)['test-sticky-bucketing'];
  expect(result?.key).toEqual('off');
  expect(result?.metadata['segmentName']).toEqual('All Other Users');
  // Non-variant
  user = userContext('user_id', 'device_id', undefined, {
    '[Experiment] test-sticky-bucketing': 'not-a-variant',
  });
  result = engine.evaluate(user, flags)['test-sticky-bucketing'];
  expect(result?.key).toEqual('off');
  expect(result?.metadata['segmentName']).toEqual('All Other Users');
});

// Experiment and Flag Segment Tests

test('test experiment', () => {
  const user = userContext('user_id', 'device_id');
  const result = engine.evaluate(user, flags)['test-experiment'];
  expect(result?.key).toEqual('on');
  expect(result?.metadata['experimentKey']).toEqual('exp-1');
});

test('test flag', () => {
  const user = userContext('user_id', 'device_id');
  const result = engine.evaluate(user, flags)['test-flag'];
  expect(result?.key).toEqual('on');
  expect(result?.metadata['experimentKey']).toBeUndefined();
});

// Conditional Logic Tests

test('test multiple conditions and values', () => {
  // All match
  let user = userContext('user_id', 'device_id', undefined, {
    'key-1': 'value-1',
    'key-2': 'value-2',
    'key-3': 'value-3',
  });
  let result = engine.evaluate(user, flags)[
    'test-multiple-conditions-and-values'
  ];
  expect(result?.key).toEqual('on');
  // Some match
  user = userContext('user_id', 'device_id', undefined, {
    'key-1': 'value-1',
    'key-2': 'value-2',
  });
  result = engine.evaluate(user, flags)['test-multiple-conditions-and-values'];
  expect(result?.key).toEqual('off');
});

// Conditional Property Targeting Tests

test('test amplitude property targeting', () => {
  const user = userContext('user_id');
  const result = engine.evaluate(user, flags)[
    'test-amplitude-property-targeting'
  ];
  expect(result?.key).toEqual('on');
});

test('test group name targeting', () => {
  const user = groupContext('org name', 'amplitude');
  const result = engine.evaluate(user, flags)['test-group-name-targeting'];
  expect(result?.key).toEqual('on');
});

test('test group property targeting', () => {
  const user = groupContext('org name', 'amplitude', {
    'org plan': 'enterprise2',
  });
  const result = engine.evaluate(user, flags)['test-group-property-targeting'];
  expect(result?.key).toEqual('on');
});

// Bucketing Tests

test('test amplitude id bucketing', () => {
  const user = userContext(undefined, undefined, '1234567890');
  const result = engine.evaluate(user, flags)['test-amplitude-id-bucketing'];
  expect(result?.key).toEqual('on');
});

test('test user id bucketing', () => {
  const user = userContext('user_id');
  const result = engine.evaluate(user, flags)['test-user-id-bucketing'];
  expect(result?.key).toEqual('on');
});

test('test device id bucketing', () => {
  const user = userContext(undefined, 'device_id');
  const result = engine.evaluate(user, flags)['test-device-id-bucketing'];
  expect(result?.key).toEqual('on');
});

test('test custom user property bucketing', () => {
  const user = userContext(undefined, undefined, undefined, { key: 'value' });
  const result = engine.evaluate(user, flags)[
    'test-custom-user-property-bucketing'
  ];
  expect(result?.key).toEqual('on');
});

test('test group name bucketing', () => {
  const user = groupContext('org name', 'amplitude');
  const result = engine.evaluate(user, flags)['test-group-name-bucketing'];
  expect(result?.key).toEqual('on');
});

test('test group property bucketing', () => {
  const user = groupContext('org name', 'amplitude', {
    'org plan': 'enterprise2',
  });
  const result = engine.evaluate(user, flags)['test-group-name-bucketing'];
  expect(result?.key).toEqual('on');
});

// Bucketing Allocation Tests

test('test 1 percent allocation', () => {
  let on = 0;
  for (let i = 0; i < 10000; i++) {
    const user = userContext(undefined, `${i + 1}`);
    const result = engine.evaluate(user, flags)['test-1-percent-allocation'];
    if (result?.key === 'on') {
      on++;
    }
  }
  expect(on).toEqual(107);
});

test('test 50 percent allocation', () => {
  let on = 0;
  for (let i = 0; i < 10000; i++) {
    const user = userContext(undefined, `${i + 1}`);
    const result = engine.evaluate(user, flags)['test-50-percent-allocation'];
    if (result?.key === 'on') {
      on++;
    }
  }
  expect(on).toEqual(5009);
});

test('test 99 percent allocation', () => {
  let on = 0;
  for (let i = 0; i < 10000; i++) {
    const user = userContext(undefined, `${i + 1}`);
    const result = engine.evaluate(user, flags)['test-99-percent-allocation'];
    if (result?.key === 'on') {
      on++;
    }
  }
  expect(on).toEqual(9900);
});

// Bucketing Distribution Tests

test('test 1 percent distribution', () => {
  let control = 0;
  let treatment = 0;
  for (let i = 0; i < 10000; i++) {
    const user = userContext(undefined, `${i + 1}`);
    const result = engine.evaluate(user, flags)['test-1-percent-distribution'];
    if (result?.key === 'control') {
      control++;
    } else if (result?.key === 'treatment') {
      treatment++;
    }
  }
  expect(control).toEqual(106);
  expect(treatment).toEqual(9894);
});

test('test 50 percent distribution', () => {
  let control = 0;
  let treatment = 0;
  for (let i = 0; i < 10000; i++) {
    const user = userContext(undefined, `${i + 1}`);
    const result = engine.evaluate(user, flags)['test-50-percent-distribution'];
    if (result?.key === 'control') {
      control++;
    } else if (result?.key === 'treatment') {
      treatment++;
    }
  }
  expect(control).toEqual(4990);
  expect(treatment).toEqual(5010);
});

test('test 99 percent distribution', () => {
  let control = 0;
  let treatment = 0;
  for (let i = 0; i < 10000; i++) {
    const user = userContext(undefined, `${i + 1}`);
    const result = engine.evaluate(user, flags)['test-99-percent-distribution'];
    if (result?.key === 'control') {
      control++;
    } else if (result?.key === 'treatment') {
      treatment++;
    }
  }
  expect(control).toEqual(9909);
  expect(treatment).toEqual(91);
});

test('test multiple distributions', () => {
  let a = 0;
  let b = 0;
  let c = 0;
  let d = 0;
  for (let i = 0; i < 10000; i++) {
    const user = userContext(undefined, `${i + 1}`);
    const result = engine.evaluate(user, flags)['test-multiple-distributions'];
    if (result?.key === 'a') {
      a++;
    } else if (result?.key === 'b') {
      b++;
    } else if (result?.key === 'c') {
      c++;
    } else if (result?.key === 'd') {
      d++;
    }
  }
  expect(a).toEqual(2444);
  expect(b).toEqual(2634);
  expect(c).toEqual(2447);
  expect(d).toEqual(2475);
});

// Operator Tests

test('test is', () => {
  const user = userContext(undefined, undefined, undefined, {
    key: 'value',
  });
  const result = engine.evaluate(user, flags)['test-is'];
  expect(result?.key).toEqual('on');
});

test('test is not', () => {
  const user = userContext(undefined, undefined, undefined, {
    key: 'value',
  });
  const result = engine.evaluate(user, flags)['test-is-not'];
  expect(result?.key).toEqual('on');
});

test('test contains', () => {
  const user = userContext(undefined, undefined, undefined, {
    key: 'value',
  });
  const result = engine.evaluate(user, flags)['test-contains'];
  expect(result?.key).toEqual('on');
});

test('test does not contain', () => {
  const user = userContext(undefined, undefined, undefined, {
    key: 'value',
  });
  const result = engine.evaluate(user, flags)['test-does-not-contain'];
  expect(result?.key).toEqual('on');
});

test('test less', () => {
  const user = userContext(undefined, undefined, undefined, {
    key: '-1',
  });
  const result = engine.evaluate(user, flags)['test-less'];
  expect(result?.key).toEqual('on');
});

test('test less or equal', () => {
  const user = userContext(undefined, undefined, undefined, {
    key: '0',
  });
  const result = engine.evaluate(user, flags)['test-less-or-equal'];
  expect(result?.key).toEqual('on');
});

test('test greater', () => {
  const user = userContext(undefined, undefined, undefined, {
    key: '1',
  });
  const result = engine.evaluate(user, flags)['test-greater'];
  expect(result?.key).toEqual('on');
});

test('test greater or equal', () => {
  const user = userContext(undefined, undefined, undefined, {
    key: '0',
  });
  const result = engine.evaluate(user, flags)['test-greater-or-equal'];
  expect(result?.key).toEqual('on');
});

test('test version less', () => {
  const user = userContext(undefined, undefined, undefined, {
    version: '1.9.0',
  });
  const result = engine.evaluate(user, flags)['test-version-less'];
  expect(result?.key).toEqual('on');
});

test('test version less or equal', () => {
  const user = userContext(undefined, undefined, undefined, {
    version: '1.10.0',
  });
  const result = engine.evaluate(user, flags)['test-version-less-or-equal'];
  expect(result?.key).toEqual('on');
});

test('test version greater', () => {
  const user = userContext(undefined, undefined, undefined, {
    version: '1.10.0',
  });
  const result = engine.evaluate(user, flags)['test-version-greater'];
  expect(result?.key).toEqual('on');
});

test('test version greater or equal', () => {
  const user = userContext(undefined, undefined, undefined, {
    version: '1.9.0',
  });
  const result = engine.evaluate(user, flags)['test-version-greater-or-equal'];
  expect(result?.key).toEqual('on');
});

test('test set is', () => {
  const user = userContext(undefined, undefined, undefined, {
    key: ['1', '2', '3'],
  });
  const result = engine.evaluate(user, flags)['test-set-is'];
  expect(result?.key).toEqual('on');
});

test('test set is not', () => {
  const user = userContext(undefined, undefined, undefined, {
    key: ['1', '2'],
  });
  const result = engine.evaluate(user, flags)['test-set-is-not'];
  expect(result?.key).toEqual('on');
});

test('test set contains', () => {
  const user = userContext(undefined, undefined, undefined, {
    key: ['1', '2'],
  });
  const result = engine.evaluate(user, flags)['test-set-contains'];
  expect(result?.key).toEqual('on');
});

test('test set does not contain', () => {
  const user = userContext(undefined, undefined, undefined, {
    key: ['1', '2', '4'],
  });
  const result = engine.evaluate(user, flags)['test-set-does-not-contain'];
  expect(result?.key).toEqual('on');
});

test('test glob match', () => {
  const user = userContext(undefined, undefined, undefined, {
    key: '/path/1/2/3/end',
  });
  const result = engine.evaluate(user, flags)['test-glob-match'];
  expect(result?.key).toEqual('on');
});

test('test glob does not match', () => {
  const user = userContext(undefined, undefined, undefined, {
    key: '/path/1/2/3',
  });
  const result = engine.evaluate(user, flags)['test-glob-does-not-match'];
  expect(result?.key).toEqual('on');
});

const userContext = (
  userId?: string,
  deviceId?: string,
  amplitudeId?: string,
  userProperties?: Record<string, unknown>,
): Record<string, unknown> => {
  const context = { user: {} };
  if (userId) context.user['user_id'] = userId;
  if (deviceId) context.user['device_id'] = deviceId;
  if (amplitudeId) context.user['amplitude_id'] = amplitudeId;
  if (userProperties) context.user['user_properties'] = userProperties;
  return context;
};

const groupContext = (
  groupType: string,
  groupName: string,
  groupProperties?: Record<string, unknown>,
): Record<string, unknown> => {
  return {
    groups: {
      [`${groupType}`]: {
        group_name: groupName,
        group_properties: groupProperties,
      },
    },
  };
};

const getFlags = async (deploymentKey: string): Promise<EvaluationFlag[]> => {
  // TODO use prod url once skylab-api is deployed
  // const serverUrl = 'https://api.lab.amplitude.com';
  const serverUrl = 'http://localhost:3034';
  const response = await fetch(`${serverUrl}/sdk/v2/flags?eval_mode=remote`, {
    method: 'GET',
    headers: {
      Authorization: `Api-Key ${deploymentKey}`,
    },
  });
  if (response.status != 200) throw Error(`Response error ${response.status}`);
  return JSON.parse(await response.text()) as EvaluationFlag[];
};
