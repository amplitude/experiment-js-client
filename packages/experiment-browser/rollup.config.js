import { resolve as pathResolve } from 'path';

import babel from '@rollup/plugin-babel';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import resolve from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';
import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';
import analyze from 'rollup-plugin-analyzer';
import gzip from 'rollup-plugin-gzip';

import * as packageJson from './package.json';
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
      define: '__amplitude__define__',
      require: '__amplitude__require__',
    }),
    resolve(),
    json(),
    commonjs(),
    typescript({
      ...(target === 'es2015' ? { target: 'es2015' } : {}),
      declaration: true,
      declarationDir: 'dist/types',
      include: tsConfig.include,
      rootDir: '.',
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
    banner: `/* ${packageJson.name} v${packageJson.version} - For license info see https://app.unpkg.com/@amplitude/experiment-js-client@${packageJson.version}/files/LICENSE */`,
    ...outputOptions,
  },
});

const configs = [
  // legacy build for field "main" - ie8, umd, es5 syntax
  {
    ...getCommonBrowserConfig('es5'),
    ...getOutputConfig({
      entryFileNames: 'experiment.umd.js',
      exports: 'named',
      format: 'umd',
    }),
    external: [],
  },

  // tree shakable build for field "module" - ie8, esm, es5 syntax
  {
    ...getCommonBrowserConfig('es5'),
    ...getOutputConfig({
      entryFileNames: 'experiment.esm.js',
      format: 'esm',
    }),
    external: [
      '@amplitude/ua-parser-js',
      '@amplitude/analytics-connector',
      '@amplitude/experiment-core',
    ],
  },

  // modern build for field "es2015" - not ie, esm, es2015 syntax
  {
    ...getCommonBrowserConfig('es2015'),
    ...getOutputConfig({
      entryFileNames: 'experiment.es2015.js',
      format: 'esm',
    }),
    external: [
      '@amplitude/ua-parser-js',
      '@amplitude/analytics-connector',
      '@amplitude/experiment-core',
    ],
  },
  {
    ...getCommonBrowserConfig('es5'),
    ...getOutputConfig({
      entryFileNames: 'experiment-browser.min.js',
      exports: 'named',
      format: 'umd',
    }),
    plugins: [
      ...getCommonBrowserConfig('es5').plugins,
      terser({
        format: {
          comments:
            /@amplitude\/.* v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?/,
        },
      }),
      gzip(),
    ],
    external: [],
  },
];

export default configs;
