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
  parserOptions: {
    ecmaVersion: 2018,
    project: 'packages/*/tsconfig.json',
    sourceType: 'module',
    tsconfigRootDir: __dirname,
  },
  plugins: ['@typescript-eslint', 'jest', 'import', 'prettier'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'plugin:jest/recommended',
    'plugin:import/recommended',
    'prettier',
    'prettier/@typescript-eslint',
  ],
  settings: {
    'import/resolver': {
      typescript: {
        alwaysTryTypes: true,
        project: 'packages/*/tsconfig.json',
      },
    },
  },
  rules: {
    'no-console': ['error', { allow: ['warn', 'error', 'debug'] }],

    '@typescript-eslint/no-unused-vars': [
      'error',
      { vars: 'all', args: 'none', ignoreRestSiblings: true },
    ],
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/require-await': 'off', // noisy; async without await is intentional in many callbacks
    '@typescript-eslint/no-unsafe-assignment': 'off', // legacy any-heavy SDK; experiment-core strict tsc catches real type errors
    '@typescript-eslint/no-unsafe-call': 'off',
    '@typescript-eslint/no-unsafe-member-access': 'off',
    '@typescript-eslint/no-unsafe-argument': 'off',
    '@typescript-eslint/no-unsafe-return': 'off',

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
        '@typescript-eslint/no-unsafe-assignment': 'off',
        '@typescript-eslint/no-unsafe-call': 'off',
        '@typescript-eslint/no-unsafe-member-access': 'off',
        '@typescript-eslint/no-unsafe-argument': 'off',
        '@typescript-eslint/no-unsafe-return': 'off',
        '@typescript-eslint/unbound-method': 'off', // jest mock/spy method references
        '@typescript-eslint/await-thenable': 'off',
        '@typescript-eslint/restrict-template-expressions': 'off',
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
