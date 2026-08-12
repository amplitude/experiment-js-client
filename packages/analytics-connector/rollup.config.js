import { resolve as pathResolve } from 'path';

import babel from '@rollup/plugin-babel';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import resolve from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';
import typescript from '@rollup/plugin-typescript';
import analyze from 'rollup-plugin-analyzer';

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
      tsconfig: './tsconfig.build.json',
      ...(target === 'es2015' ? { target: 'es2015' } : {}),
    }),
    babel({
      configFile:
        target === 'es2015'
          ? pathResolve(__dirname, '../..', 'babel.es2015.config.js')
          : undefined,
      babelHelpers: 'bundled',
      exclude: ['node_modules/**'],
    }),
    analyze({
      summaryOnly: true,
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
  {
    ...getCommonBrowserConfig('es2017'),
    ...getOutputConfig({
      entryFileNames: 'analytics-connector.umd.js',
      exports: 'named',
      format: 'umd',
    }),
    external: [],
  },

  {
    ...getCommonBrowserConfig('es2017'),
    ...getOutputConfig({
      entryFileNames: 'analytics-connector.esm.js',
      format: 'esm',
    }),
    external: [],
  },

  // build for es2015
  {
    ...getCommonBrowserConfig('es2015'),
    ...getOutputConfig({
      entryFileNames: 'analytics-connector.es2015.js',
      format: 'esm',
    }),
    external: [],
  },
];

export default configs;
