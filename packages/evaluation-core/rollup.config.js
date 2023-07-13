import { resolve as pathResolve } from 'path';

import babel from '@rollup/plugin-babel';
import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';

const getCommonBrowserConfig = (target) => ({
  input: 'src/index.ts',
  treeshake: {
    moduleSideEffects: 'no-external',
  },
  plugins: [
    resolve(),
    commonjs(),
    typescript({
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
  ],
});

const getOutputConfig = (outputOptions) => ({
  output: {
    dir: 'dist',
    name: 'evaluation-core',
    ...outputOptions,
  },
});

const configs = [
  // legacy build for field "main" - ie8, umd, es5 syntax
  {
    ...getCommonBrowserConfig('es5'),
    ...getOutputConfig({
      entryFileNames: 'evaluation-core.umd.js',
      exports: 'named',
      format: 'umd',
    }),
    external: [],
  },

  // tree shakable build for field "module" - ie8, esm, es5 syntax
  {
    ...getCommonBrowserConfig('es5'),
    ...getOutputConfig({
      entryFileNames: 'evaluation-core.esm.js',
      format: 'esm',
    }),
    external: [],
  },

  // modern build for field "es2015" - not ie, esm, es2015 syntax
  {
    ...getCommonBrowserConfig('es2015'),
    ...getOutputConfig({
      entryFileNames: 'evaluation-core.es2015.js',
      format: 'esm',
    }),
    external: [],
  },
];

export default configs;
