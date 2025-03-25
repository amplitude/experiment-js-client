import { join, resolve as pathResolve } from 'path';

import tsConfig from '@amplitude/experiment-js-client/tsconfig.json';
import babel from '@rollup/plugin-babel';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import resolve from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';
import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';
import analyze from 'rollup-plugin-analyzer';
import license from 'rollup-plugin-license';

import * as packageJson from './package.json';

const getCommonBrowserConfig = (target) => ({
  input: 'src/script.ts',
  treeshake: {
    moduleSideEffects: 'no-external',
  },
  plugins: [
    replace({
      preventAssignment: true,
      BUILD_BROWSER: true,
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
    }),
    resolve(),
    json(),
    commonjs(),
    typescript({
      ...(target === 'es2015'
        ? { target: 'es2015', downlevelIteration: true }
        : { downlevelIteration: true }),
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
    license({
      thirdParty: {
        output: join(__dirname, 'dist', 'LICENSES'),
      },
    }),
  ],
});

const getOutputConfig = (outputOptions) => ({
  output: {
    dir: 'dist',
    name: 'Experiment-Tag',
    banner: `/* ${packageJson.name} v${packageJson.version} - For license info see https://unpkg.com/@amplitude/experiment-tag@${packageJson.version}/LICENSES */`,
    ...outputOptions,
  },
});

const configs = [
  // legacy build for field "main" - ie8, umd, es5 syntax
  {
    ...getCommonBrowserConfig('es5'),
    ...getOutputConfig({
      entryFileNames: 'experiment-tag.umd.js',
      exports: 'named',
      format: 'umd',
    }),
    plugins: [
      ...getCommonBrowserConfig('es5').plugins,
      terser({
        format: {
          // Don't remove semver comment
          comments:
            /@amplitude\/.* v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?/,
        },
      }), // Apply terser plugin for minification
    ],
    external: [],
  },
];

export default configs;
