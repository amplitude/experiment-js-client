'use strict';

module.exports = {
  presets: [
    [
      '@babel/preset-env',
      {
        targets: {
          browsers: ['ie >= 8'],
        },
      },
    ],
    '@babel/preset-typescript',
  ],
};
