module.exports = [
  {
    name: 'experiment-tag-min (gzipped)',
    path: './packages/experiment-tag/dist/experiment-tag-min.js.gz',
    // Baseline ~66.5 KB gzipped after the consent features merged on main
    // (#357-#359: clear-data on denial, in-memory storage hold, impression
    // buffering). Cap ~+2% (~68 KB) as a bloat guard. Rebaselined from 66 KB:
    // those PRs each passed individually against their own branches, but
    // their combination on main exceeds the old cap, failing every new PR.
    limit: '68 KB',
    brotli: false,
  },
];
