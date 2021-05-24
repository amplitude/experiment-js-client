import babel from '@rollup/plugin-babel';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import resolve from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';
import typescript from '@rollup/plugin-typescript';

import tsConfig from './tsconfig.json';

const browserConfig = {
  input: 'src/index.ts',
  output: {
    dir: 'dist',
    entryFileNames: 'experiment.umd.js',
    exports: 'named',
    format: 'umd',
    name: 'Experiment',
  },
  treeshake: {
    moduleSideEffects: 'no-external',
  },
  external: [],
  plugins: [
    replace({ BUILD_BROWSER: true }),
    resolve(),
    json(),
    commonjs(),
    typescript({
      declaration: true,
      declarationDir: 'dist/types',
      include: tsConfig.include,
      rootDir: '.',
    }),
    babel({
      babelHelpers: 'bundled',
      exclude: ['node_modules/**'],
    }),
  ],
};

const configs = [browserConfig];

export default configs;
