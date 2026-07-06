module.exports = [
  {
    name: 'experiment-tag-min (gzipped)',
    path: './packages/experiment-tag/dist/experiment-tag-min.js.gz',
    // Baseline ~62.2 KB gzipped on main after the cross-subdomain RTBT session
    // + relay uuid work (WEB-108/129/149). Cap ~+3% (~64 KB) as a bloat guard.
    limit: '64 KB',
    brotli: false,
  },
];
