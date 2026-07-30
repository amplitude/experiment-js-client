module.exports = [
  {
    name: 'experiment-tag-min (gzipped)',
    path: './packages/experiment-tag/dist/experiment-tag-min.js.gz',
    // Baseline ~63.9 KB gzipped on main after the consent gate and ConsentManager
    // work (WEB-165/172). Cap ~+3% (~66 KB) as a bloat guard. Rebaselined from
    // 62.2 KB / 64 KB: main had drifted to within 84 bytes of that cap, leaving
    // no room for a feature of any size.
    limit: '66 KB',
    brotli: false,
  },
];
