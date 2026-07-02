'use strict';

module.exports = {
  root: true,
  env: {
    browser: true,
    es6: true,
    jest: true,
    node: true,
  },
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'jest', 'import', 'prettier'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:jest/recommended',
    'prettier',
    'prettier/@typescript-eslint',
  ],
  rules: {
    'no-console': ['error', { allow: ['warn', 'error', 'debug'] }],

    // eslint-plugin-import
    'import/order': [
      'error',
      { 'newlines-between': 'always', alphabetize: { order: 'asc' } },
    ],

    // eslint-plugin-prettier
    'prettier/prettier': 'error',

    // eslint-plugin-jest
    'jest/expect-expect': [
      'warn',
      {
        assertFunctionNames: [
          'expect',
          'assertMatch',
          'assertNoMatch',
          'assertInvalidVersion',
          'assertValidVersion',
          'assertVersionComparison',
        ],
      },
    ],
    'jest/no-conditional-expect': 'off',

    'no-restricted-globals': [
      'error',
      {
        name: 'globalThis',
        message:
          'Unsafe access to `globalThis`. Use getGlobalScope() from @amplitude/experiment-core instead.',
      },
      {
        name: 'window',
        message:
          'Unsafe access to `window`. Use getGlobalScope() from @amplitude/experiment-core instead.',
      },
      {
        name: 'self',
        message:
          'Unsafe access to `self`. Use getGlobalScope() from @amplitude/experiment-core instead.',
      },
    ],
  },
  overrides: [
    {
      files: ['**/*.test.ts', '**/*.spec.ts'],
      rules: {
        'no-restricted-globals': 'off',
      },
    },
  ],
};
