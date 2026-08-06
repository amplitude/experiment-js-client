module.exports = [
  {
    name: 'experiment-tag-min (gzipped)',
    path: './packages/experiment-tag/dist/experiment-tag-min.js.gz',
    // Baseline ~63.5 KB gzipped after consent gate / ConsentManager / clear-data
    // (WEB-165/172) and the adoptedStyleSheets fallback (WEB-221). Cap ~+3%
    // (~66 KB) as a bloat guard. Rebaselined from 62.2 KB / 64 KB: main had
    // drifted to within ~0.7 KB of that cap, so any intentional bugfix was
    // failing the gate.
    limit: '66 KB',
    brotli: false,
  },
];
