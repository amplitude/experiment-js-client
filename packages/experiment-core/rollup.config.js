import { resolve as pathResolve } from 'path';

import babel from '@rollup/plugin-babel';
import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';
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
    }),
    babel({
      babelHelpers: 'bundled',
      extensions: ['.js', '.ts'],
      exclude: ['node_modules/**'],
    }),
    replace({
      preventAssignment: true,
      define: '__amplitude__define__',
      require: '__amplitude__require__',
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
  // legacy build for field "main"
  {
    ...getCommonBrowserConfig('es6'),
    ...getOutputConfig({
      entryFileNames: 'experiment-core.umd.js',
      exports: 'named',
      format: 'umd',
    }),
    external: [],
  },

  // tree shakable build for field "module"
  {
    ...getCommonBrowserConfig('es6'),
    ...getOutputConfig({
      entryFileNames: 'experiment-core.esm.js',
      format: 'esm',
    }),
    external: ['unfetch'],
  },
];

export default configs;
