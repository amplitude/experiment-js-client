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

const getCommonBrowserConfig = () => ({
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
    banner: `/* ${packageJson.name} v${packageJson.version} - For license info see https://app.unpkg.com/@amplitude/experiment-js-client@${packageJson.version}/files/LICENSE */`,
    ...outputOptions,
  },
});

const configs = [
  // legacy build for field "main"
  {
    ...getCommonBrowserConfig(),
    ...getOutputConfig({
      entryFileNames: 'experiment.umd.js',
      exports: 'named',
      format: 'umd',
    }),
    external: [],
  },

  // tree shakable build for field "module"
  {
    ...getCommonBrowserConfig(),
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

  {
    ...getCommonBrowserConfig(),
    ...getOutputConfig({
      entryFileNames: 'experiment-browser.min.js',
      exports: 'named',
      format: 'umd',
    }),
    plugins: [
      ...getCommonBrowserConfig().plugins,
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
