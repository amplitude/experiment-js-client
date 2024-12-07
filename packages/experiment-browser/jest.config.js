/* eslint-disable @typescript-eslint/no-var-requires */
const { pathsToModuleNameMapper } = require('ts-jest');

const package = require('./package');
const { compilerOptions } = require('./tsconfig.test.json');

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  displayName: package.name,
  rootDir: '.',
  moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths, {
    prefix: '<rootDir>/',
  }),
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: './tsconfig.test.json' }],
  },
  testTimeout: 10 * 1000,
};
