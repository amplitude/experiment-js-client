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
    'plugin:import/recommended',
    'prettier',
    'prettier/@typescript-eslint',
  ],
  settings: {
    'import/resolver': {
      typescript: {
        alwaysTryTypes: true,
        project: ['packages/*/tsconfig.json', 'packages/*/tsconfig.test.json'],
      },
    },
  },
  rules: {
    'no-console': ['error', { allow: ['warn', 'error', 'debug'] }],

    // eslint-plugin-import
    'import/no-extraneous-dependencies': [
      'error',
      {
        optionalDependencies: false,
        devDependencies: [
          '**/*.test.ts',
          '**/*.spec.ts',
          '**/test/**/*.ts',
          '**/jest.setup.ts',
        ],
      },
    ],
    'import/no-unresolved': 'off',
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
      files: [
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/test/**/*.ts',
        '**/jest.setup.ts',
      ],
      rules: {
        'no-restricted-globals': 'off',
        'import/no-unresolved': 'off',
        'import/named': 'off',
        'import/no-extraneous-dependencies': 'off',
      },
    },
    {
      files: ['**/rollup.config.js', '**/jest.config.js'],
      rules: {
        'import/no-extraneous-dependencies': 'off',
      },
    },
  ],
};
