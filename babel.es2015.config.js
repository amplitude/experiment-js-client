'use strict';

module.exports = {
  presets: [
    [
      '@babel/preset-env',
      {
        targets: {
          browsers: ['chrome 10'],
        },
      },
    ],
    '@babel/preset-typescript',
  ],
};
