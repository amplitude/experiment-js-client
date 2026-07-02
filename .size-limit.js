module.exports = [
  {
    name: 'experiment-tag-min (gzipped)',
    path: './packages/experiment-tag/dist/experiment-tag-min.js.gz',
    // Baseline ~60.1 KB gzipped on main (61500 B). Cap ~+3% (~62 KB).
    limit: '62 KB',
    brotli: false,
  },
];
