import { resolve as pathResolve } from 'path';

import babel from '@rollup/plugin-babel';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import resolve from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';
import typescript from '@rollup/plugin-typescript';

import tsConfig from './tsconfig.json';

const getCommonBrowserConfig = (target) => ({
  input: 'src/index.ts',
  treeshake: {
    moduleSideEffects: 'no-external',
  },
  plugins: [
    replace({
      preventAssignment: true,
      BUILD_BROWSER: true,
    }),
    resolve(),
    json(),
    commonjs(),
    typescript({
      target: target,
      declaration: true,
      declarationDir: 'dist/types',
      include: tsConfig.include,
      rootDir: '.',
    }),
    babel({
      configFile: pathResolve(
        __dirname,
        '../..',
        target === 'es2015' ? 'babel.es2015.config.js' : 'babel.config.js',
      ),
      babelHelpers: 'bundled',
      exclude: ['node_modules/**'],
    }),
  ],
});

const getOutputConfig = (outputOptions) => ({
  output: {
    dir: 'dist',
    name: 'Experiment',
    ...outputOptions,
  },
});

const configs = [
  // legacy build for field "main" - ie8, umd, es5 syntax
  {
    ...getCommonBrowserConfig('es5'),
    ...getOutputConfig({
      entryFileNames: 'analyticsConnector.umd.js',
      exports: 'named',
      format: 'umd',
    }),
    external: [],
  },

  // tree shakable build for field "module" - ie8, esm, es5 syntax
  {
    ...getCommonBrowserConfig('es5'),
    ...getOutputConfig({
      entryFileNames: 'analyticsConnector.esm.js',
      format: 'esm',
    }),
    external: ['@amplitude/ua-parser-js'],
  },

  // modern build for field "es2015" - not ie, esm, es2015 syntax
  {
    ...getCommonBrowserConfig('es2015'),
    ...getOutputConfig({
      entryFileNames: 'analyticsConnector.es2015.js',
      format: 'esm',
    }),
    external: ['@amplitude/ua-parser-js'],
  },
];

export default configs;
