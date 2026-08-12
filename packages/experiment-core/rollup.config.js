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
  ],
});

const getOutputConfig = (outputOptions) => ({
  output: {
    dir: 'dist',
    name: 'experiment-core',
    ...outputOptions,
  },
});

const configs = [
  {
    ...getCommonBrowserConfig('es2017'),
    ...getOutputConfig({
      entryFileNames: 'experiment-core.umd.js',
      exports: 'named',
      format: 'umd',
    }),
    external: [],
  },

  {
    ...getCommonBrowserConfig('es2017'),
    ...getOutputConfig({
      entryFileNames: 'experiment-core.esm.js',
      format: 'esm',
    }),
    external: ['unfetch'],
  },

  // build for field "es2015"
  {
    ...getCommonBrowserConfig('es2015'),
    ...getOutputConfig({
      entryFileNames: 'experiment-core.es2015.js',
      format: 'esm',
    }),
    external: ['unfetch'],
  },
];

export default configs;
