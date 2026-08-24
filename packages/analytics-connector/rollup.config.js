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
    }),
    babel({
      babelHelpers: 'bundled',
      extensions: ['.js', '.ts'],
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
  // legacy build for field "main"
  {
    ...getCommonBrowserConfig('es6'),
    ...getOutputConfig({
      entryFileNames: 'analytics-connector.umd.js',
      exports: 'named',
      format: 'umd',
    }),
    external: [],
  },

  // tree shakable build for field "module"
  {
    ...getCommonBrowserConfig('es6'),
    ...getOutputConfig({
      entryFileNames: 'analytics-connector.esm.js',
      format: 'esm',
    }),
    external: [],
  },
];

export default configs;
