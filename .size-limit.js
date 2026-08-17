module.exports = [
  {
    name: 'experiment-tag-min (gzipped)',
    path: './packages/experiment-tag/dist/experiment-tag-min.js.gz',
    // Baseline ~65.6 KB gzipped on web/fix-previous-url-on-pushstate after
    // consent (#357-#359) + SPA redirect fix (WEB-228). Cap ~+3.5% (~68 KB).
    // Temporary rebaseline so the absolute page-load budget gate works again;
    // follow-up: reclaim bytes (namespace-import / optional-feature split)
    // rather than raising this again.
    limit: '68 KB',
    brotli: false,
  },
];
