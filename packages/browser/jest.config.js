/* eslint-disable @typescript-eslint/no-var-requires */
const { pathsToModuleNameMapper } = require('ts-jest/utils');

const package = require('./package');
const { compilerOptions } = require('./tsconfig.test.json');

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  displayName: package.name,
  name: package.name,
  rootDir: '.',
  moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths, {
    prefix: '<rootDir>/',
  }),
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/tsconfig.test.json',
    },
  },
};
