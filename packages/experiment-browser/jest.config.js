/* eslint-disable @typescript-eslint/no-var-requires */
const { pathsToModuleNameMapper } = require('ts-jest');
const dotenv = require('dotenv');

const package = require('./package');
const { compilerOptions } = require('./tsconfig.test.json');

dotenv.config({path: process.env['ENVIRONMENT'] ? '.env.' + process.env['ENVIRONMENT'] : '.env'});
const MANAGEMENT_API_SERVER_URL = process.env['MANAGEMENT_API_SERVER_URL'] || 'https://experiment.amplitude.com';

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
  // Remove this once management-api has CORS properly configured.
  testEnvironmentOptions: {
    url: MANAGEMENT_API_SERVER_URL,
  },
};
