# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [0.20.0](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-tag@0.19.1...@amplitude/experiment-tag@0.20.0) (2026-04-10)


### Bug Fixes

* Behavioral Targeting schema update ([#300](https://github.com/amplitude/experiment-js-client/issues/300)) ([e271736](https://github.com/amplitude/experiment-js-client/commit/e271736caba63568e054275675ac85aae08c181b))
* **experiment-tag:** load overlay after shell is built in mobile mode ([#304](https://github.com/amplitude/experiment-js-client/issues/304)) ([dc818b6](https://github.com/amplitude/experiment-js-client/commit/dc818b60f0109a980e0ea34da57aa42871d197e9))


### Features

* add per-segment evaluation traces to debug API ([#294](https://github.com/amplitude/experiment-js-client/issues/294)) ([51fcb09](https://github.com/amplitude/experiment-js-client/commit/51fcb09e5569b9065d8a6969f1c61935c3992c48))





## [0.19.1](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-tag@0.19.0...@amplitude/experiment-tag@0.19.1) (2026-04-02)


### Bug Fixes

* **experiment-tag:** load overlay script immediately instead of deferring to window.load ([#299](https://github.com/amplitude/experiment-js-client/issues/299)) ([89bbc1a](https://github.com/amplitude/experiment-js-client/commit/89bbc1a4bc4de7a22b54190682dc6a8eb7682f5a))





# [0.19.0](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-tag@0.18.1...@amplitude/experiment-tag@0.19.0) (2026-04-02)


### Bug Fixes

* sync iframe URL and target iframe document for triggers in mobile mode ([#297](https://github.com/amplitude/experiment-js-client/issues/297)) ([d0fe3be](https://github.com/amplitude/experiment-js-client/commit/d0fe3bef5bc1d570da6351f4f7092165551ec14e))


### Features

* BehavioralTargetingManager, EventStorage and BehavioralTargetingEvaluator ([#262](https://github.com/amplitude/experiment-js-client/issues/262)) ([1159067](https://github.com/amplitude/experiment-js-client/commit/115906751c0bb1fafc4bbe9683767b1a2ad8fb06))





## [0.18.1](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-tag@0.18.0...@amplitude/experiment-tag@0.18.1) (2026-03-26)


### Bug Fixes

* prevent scripts from inserting elements into shell body after do… ([#295](https://github.com/amplitude/experiment-js-client/issues/295)) ([95cbe10](https://github.com/amplitude/experiment-js-client/commit/95cbe103a36b87c538e494073e470d149b3e1026))





# [0.18.0](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-tag@0.17.1...@amplitude/experiment-tag@0.18.0) (2026-03-23)


### Features

* don't minify in dev mode and allow earlier WebExperiment to override ([#289](https://github.com/amplitude/experiment-js-client/issues/289)) ([af46363](https://github.com/amplitude/experiment-js-client/commit/af46363ec0988f9f80575d174abb8877c4d9a12c))
* **experiment-tag:** add debug state API with activation check and subscriber ([#288](https://github.com/amplitude/experiment-js-client/issues/288)) ([43f0b72](https://github.com/amplitude/experiment-js-client/commit/43f0b72825c56cee227d6d97462274132e6f1418))
* **experiment-tag:** add page object trigger debug info and manual test page ([#291](https://github.com/amplitude/experiment-js-client/issues/291)) ([8106448](https://github.com/amplitude/experiment-js-client/commit/8106448bf54bcae47a8ff321ae7bc9180fcdbaef))





## [0.17.1](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-tag@0.17.0...@amplitude/experiment-tag@0.17.1) (2026-03-20)


### Bug Fixes

* stricter check for mobile mode ([#293](https://github.com/amplitude/experiment-js-client/issues/293)) ([ee87833](https://github.com/amplitude/experiment-js-client/commit/ee87833ddfc7839a2196d6706d1a5e6eb6ee51cb))





# [0.17.0](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-tag@0.16.0...@amplitude/experiment-tag@0.17.0) (2026-03-19)


### Bug Fixes

* expose full dom-mutator API on ampDomMutator ([#287](https://github.com/amplitude/experiment-js-client/issues/287)) ([c1bed9f](https://github.com/amplitude/experiment-js-client/commit/c1bed9f4936ddea531bef0a44a9a80033c49aab8))
* remove subscription dedupe for pageChangeSubscribers ([70bbd35](https://github.com/amplitude/experiment-js-client/commit/70bbd35abcef622ebd80f4b1cfe5747ed830607b))
* Replace instanceOf checks with type casting when deduping multiple initializations ([#286](https://github.com/amplitude/experiment-js-client/issues/286)) ([b46f504](https://github.com/amplitude/experiment-js-client/commit/b46f504c758b4b841b2123fd103809ffa6842e49))


### Features

* site as shell ([#261](https://github.com/amplitude/experiment-js-client/issues/261)) ([5da84e8](https://github.com/amplitude/experiment-js-client/commit/5da84e8fc2a1cf5c4b807aab0c50e90b4e897336))





# [0.16.0](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-tag@0.15.3...@amplitude/experiment-tag@0.16.0) (2026-03-11)


### Features

* support new page triggers ([#241](https://github.com/amplitude/experiment-js-client/issues/241)) ([5f77967](https://github.com/amplitude/experiment-js-client/commit/5f7796718577d885532ff3e822c85e4cd29cfafb))





## [0.15.3](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-tag@0.15.2...@amplitude/experiment-tag@0.15.3) (2026-03-10)


### Bug Fixes

* handle inserting widgets into html mutations ([#263](https://github.com/amplitude/experiment-js-client/issues/263)) ([c8390d1](https://github.com/amplitude/experiment-js-client/commit/c8390d17f39b283120181f9845d54403987294d4))





## [0.15.2](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-tag@0.15.1...@amplitude/experiment-tag@0.15.2) (2026-03-06)

**Note:** Version bump only for package @amplitude/experiment-tag





## [0.15.1](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-tag@0.15.0...@amplitude/experiment-tag@0.15.1) (2026-03-03)

**Note:** Version bump only for package @amplitude/experiment-tag





# [0.15.0](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-tag@0.14.3...@amplitude/experiment-tag@0.15.0) (2026-02-11)


### Bug Fixes

* revert hash-based routing logic, VISUAL_EDITOR param will always be appended to base url ([#250](https://github.com/amplitude/experiment-js-client/issues/250)) ([02b34bd](https://github.com/amplitude/experiment-js-client/commit/02b34bd24d4c7c2e6245127bf19e22c90e8e65f1))


### Features

* add loading indicator ([#257](https://github.com/amplitude/experiment-js-client/issues/257)) ([a6ab126](https://github.com/amplitude/experiment-js-client/commit/a6ab1266493d987c68b46233794a5ce59bfb417d))





## [0.14.3](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-tag@0.14.2...@amplitude/experiment-tag@0.14.3) (2026-01-24)

**Note:** Version bump only for package @amplitude/experiment-tag





## [0.14.2](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-tag@0.14.1...@amplitude/experiment-tag@0.14.2) (2026-01-22)

**Note:** Version bump only for package @amplitude/experiment-tag





## [0.14.1](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-tag@0.14.0...@amplitude/experiment-tag@0.14.1) (2026-01-15)


### Bug Fixes

* proper scope checking for handleInject ([#252](https://github.com/amplitude/experiment-js-client/issues/252)) ([a306c9c](https://github.com/amplitude/experiment-js-client/commit/a306c9c468f2032a6459e88c65875bd227b7160d))





# [0.14.0](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-tag@0.12.0...@amplitude/experiment-tag@0.14.0) (2025-11-24)


### Features

* add new insertElement() function for SPA widgets ([#240](https://github.com/amplitude/experiment-js-client/issues/240)) ([00b9a3d](https://github.com/amplitude/experiment-js-client/commit/00b9a3da7c68b46253f8650c0ec489a8354571da))





# [0.13.0](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-tag@0.12.0...@amplitude/experiment-tag@0.13.0) (2025-11-20)


### Features

* add new insertElement() function for SPA widgets ([#240](https://github.com/amplitude/experiment-js-client/issues/240)) ([00b9a3d](https://github.com/amplitude/experiment-js-client/commit/00b9a3da7c68b46253f8650c0ec489a8354571da))





# [0.12.0](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-tag@0.11.2...@amplitude/experiment-tag@0.12.0) (2025-11-14)


### Features

* add setTracksAssignment ([#224](https://github.com/amplitude/experiment-js-client/issues/224)) ([79e230b](https://github.com/amplitude/experiment-js-client/commit/79e230bbcf5716eaba998f21235c7ee7be08c418))





## [0.11.2](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-tag@0.11.1...@amplitude/experiment-tag@0.11.2) (2025-11-06)

**Note:** Version bump only for package @amplitude/experiment-tag





## [0.11.1](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-tag@0.11.0...@amplitude/experiment-tag@0.11.1) (2025-11-03)


### Bug Fixes

* previewVariants should fire impression events ([#235](https://github.com/amplitude/experiment-js-client/issues/235)) ([2b08845](https://github.com/amplitude/experiment-js-client/commit/2b08845936c5828c62e6333054122ad3d464d5e2))





# [0.11.0](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-tag@0.10.0...@amplitude/experiment-tag@0.11.0) (2025-10-22)


### Features

* support persistent UTM targeting ([#226](https://github.com/amplitude/experiment-js-client/issues/226)) ([504f95b](https://github.com/amplitude/experiment-js-client/commit/504f95b7942f2871aeece9cd90d4842ff7822f88))





# [0.10.0](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-tag@0.9.5...@amplitude/experiment-tag@0.10.0) (2025-10-01)


### Features

* support Amplitude Event Explorer functionality and fetch latest configs for preview mode ([#215](https://github.com/amplitude/experiment-js-client/issues/215)) ([10253ac](https://github.com/amplitude/experiment-js-client/commit/10253ac84fb9c5aa0ea7f765fddccc2d263d71ea))





## [0.9.5](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-tag@0.9.4...@amplitude/experiment-tag@0.9.5) (2025-09-26)

**Note:** Version bump only for package @amplitude/experiment-tag





## [0.9.4](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-tag@0.9.3...@amplitude/experiment-tag@0.9.4) (2025-09-16)


### Bug Fixes

* update removeQueryParams to support hash-based routing ([#213](https://github.com/amplitude/experiment-js-client/issues/213)) ([275709e](https://github.com/amplitude/experiment-js-client/commit/275709eadb8de18790b2f57dcca33cae43b1deeb))
* Update web experiment build format to IIFE  ([#210](https://github.com/amplitude/experiment-js-client/issues/210)) ([74702f5](https://github.com/amplitude/experiment-js-client/commit/74702f58e7a01dc8c83d30ff221df095762830f0))





## [0.9.3](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-tag@0.9.2...@amplitude/experiment-tag@0.9.3) (2025-08-29)


### Bug Fixes

* inject preview modal on applyVariants ([#209](https://github.com/amplitude/experiment-js-client/issues/209)) ([8348f68](https://github.com/amplitude/experiment-js-client/commit/8348f6874c61470d4f2f8270541c94c197a594dd))





## [0.9.2](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-tag@0.9.1...@amplitude/experiment-tag@0.9.2) (2025-08-28)


### Bug Fixes

* expire marketing cookie after session ([#208](https://github.com/amplitude/experiment-js-client/issues/208)) ([6bb8558](https://github.com/amplitude/experiment-js-client/commit/6bb85581030bb1130e83ca15e62d068bece9be43))





## [0.9.1](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-tag@0.9.0...@amplitude/experiment-tag@0.9.1) (2025-08-28)


### Bug Fixes

* add patch to removeChild to address hydration errors ([#207](https://github.com/amplitude/experiment-js-client/issues/207)) ([531d2f3](https://github.com/amplitude/experiment-js-client/commit/531d2f380e85849de498b016182ba11ff53bd249))
* display modal during experiment preview mode ([6576834](https://github.com/amplitude/experiment-js-client/commit/657683437357cf32df24f509b947bc9c84034f12))
* set marketing cookie on landing page before redirect ([#206](https://github.com/amplitude/experiment-js-client/issues/206)) ([cd2190a](https://github.com/amplitude/experiment-js-client/commit/cd2190ac34913ee411d5a2df6d553248158c214d))
* Support preview mode persistence for MPAs ([#204](https://github.com/amplitude/experiment-js-client/issues/204)) ([14c35ee](https://github.com/amplitude/experiment-js-client/commit/14c35ee612c45f66b46bf0e1b0ff518ca4cdfa27))





# [0.9.0](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-tag@0.8.2...@amplitude/experiment-tag@0.9.0) (2025-08-11)


### Features

* Support visual editor mode for multi-page apps ([#198](https://github.com/amplitude/experiment-js-client/issues/198)) ([fb4310b](https://github.com/amplitude/experiment-js-client/commit/fb4310bd862fd9aadc917b84d390cb4bba9a39ca))





## [0.8.2](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-tag@0.8.1...@amplitude/experiment-tag@0.8.2) (2025-08-06)

**Note:** Version bump only for package @amplitude/experiment-tag





## [0.8.1](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-tag@0.8.0...@amplitude/experiment-tag@0.8.1) (2025-07-28)

**Note:** Version bump only for package @amplitude/experiment-tag





# [0.8.0](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-tag@0.7.6...@amplitude/experiment-tag@0.8.0) (2025-07-16)


### Features

* Web Experiment - refactor script for package ([#195](https://github.com/amplitude/experiment-js-client/issues/195)) ([c3fbf68](https://github.com/amplitude/experiment-js-client/commit/c3fbf68425d8710099a561d3ccdadb846089ab1f))





## [0.7.6](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-tag@0.7.5...@amplitude/experiment-tag@0.7.6) (2025-07-09)


### Bug Fixes

* check current url equal to redirection url before tracking redirect impression ([#194](https://github.com/amplitude/experiment-js-client/issues/194)) ([b76957e](https://github.com/amplitude/experiment-js-client/commit/b76957e06c00c9c271ecd174f66ca8a4d2fe7a4b))





## [0.7.5](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-tag@0.7.4...@amplitude/experiment-tag@0.7.5) (2025-07-01)


### Bug Fixes

* url-redirect impression events fired on redirected page ([#193](https://github.com/amplitude/experiment-js-client/issues/193)) ([a80ac61](https://github.com/amplitude/experiment-js-client/commit/a80ac612290c065f0a4ab877c2f02c2ba0c227c6))





## [0.7.4](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-tag@0.7.3...@amplitude/experiment-tag@0.7.4) (2025-06-27)


### Bug Fixes

* set isRunning after Visual Editor initializes ([#192](https://github.com/amplitude/experiment-js-client/issues/192)) ([54bdf79](https://github.com/amplitude/experiment-js-client/commit/54bdf79d89d06189add106a3e4e36bd214bd5932))





## [0.7.3](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-tag@0.7.2...@amplitude/experiment-tag@0.7.3) (2025-06-26)


### Bug Fixes

* always track impression if there is active variant action on page, revert stale variant actions ([#189](https://github.com/amplitude/experiment-js-client/issues/189)) ([0e91294](https://github.com/amplitude/experiment-js-client/commit/0e91294328909f693dc61ded479414ba0a25fcd1))





## [0.7.2](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-tag@0.7.1...@amplitude/experiment-tag@0.7.2) (2025-06-26)


### Bug Fixes

* always track control impression when on active page ([#191](https://github.com/amplitude/experiment-js-client/issues/191)) ([f22267c](https://github.com/amplitude/experiment-js-client/commit/f22267cde1c04cd50b19a24f2224750045c87c5f))





## [0.7.1](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-tag@0.7.0...@amplitude/experiment-tag@0.7.1) (2025-06-24)


### Bug Fixes

* scoping for control impression event actions ([#190](https://github.com/amplitude/experiment-js-client/issues/190)) ([9024e90](https://github.com/amplitude/experiment-js-client/commit/9024e905c20f20c1aa669eefb091c13d455e5870))
* Web Experiment - Control variant condition ([#188](https://github.com/amplitude/experiment-js-client/issues/188)) ([3b32839](https://github.com/amplitude/experiment-js-client/commit/3b3283943448da3e58c03fa4ebc32aa77ad38b47))





# [0.7.0](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-tag@0.6.3...@amplitude/experiment-tag@0.7.0) (2025-06-23)


### Features

* add throwOnError configuration option ([#187](https://github.com/amplitude/experiment-js-client/issues/187)) ([00761aa](https://github.com/amplitude/experiment-js-client/commit/00761aa122c4f5da30af914a82543635bfd25208))





## [0.6.3](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-tag@0.6.2...@amplitude/experiment-tag@0.6.3) (2025-05-15)


### Bug Fixes

* add nonce ([#183](https://github.com/amplitude/experiment-js-client/issues/183)) ([53cd69e](https://github.com/amplitude/experiment-js-client/commit/53cd69e5101458aadecc75048f8dbafdcd5ba20f))





## [0.6.2](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-tag@0.6.1...@amplitude/experiment-tag@0.6.2) (2025-05-07)


### Bug Fixes

* track control impressions on targeted pages ([#181](https://github.com/amplitude/experiment-js-client/issues/181)) ([0910310](https://github.com/amplitude/experiment-js-client/commit/0910310f3d74a72e471a443982e7184e54301fa2))





## [0.6.1](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-tag@0.6.0...@amplitude/experiment-tag@0.6.1) (2025-05-06)

**Note:** Version bump only for package @amplitude/experiment-tag





# [0.6.0](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-tag@0.5.5...@amplitude/experiment-tag@0.6.0) (2025-05-01)


### Features

* Support web experiment page view objects ([#165](https://github.com/amplitude/experiment-js-client/issues/165)) ([2da40e2](https://github.com/amplitude/experiment-js-client/commit/2da40e2ab7395abc92e6644c8ac99a27ba3f007b))





## [0.5.5](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-tag@0.5.4...@amplitude/experiment-tag@0.5.5) (2025-04-02)


### Bug Fixes

* update experiment tag packaging; export types ([#174](https://github.com/amplitude/experiment-js-client/issues/174)) ([1850ec7](https://github.com/amplitude/experiment-js-client/commit/1850ec74a7eeb362535c036d36eac243630110a0))





## [0.5.4](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-tag@0.5.3...@amplitude/experiment-tag@0.5.4) (2025-04-01)


### Bug Fixes

* dont re-add plugin; remove integration timout error log ([#173](https://github.com/amplitude/experiment-js-client/issues/173)) ([9490d83](https://github.com/amplitude/experiment-js-client/commit/9490d83bd66735aab515957d2e666f58fcf5dbad))





## [0.5.3](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-tag@0.5.2...@amplitude/experiment-tag@0.5.3) (2025-03-27)


### Bug Fixes

* remove dommutator patch; add license info to script ([#170](https://github.com/amplitude/experiment-js-client/issues/170)) ([442c309](https://github.com/amplitude/experiment-js-client/commit/442c309d4124b9f7674df1aec67f5b1558a27e0f))
* use main branch patch of dm ([#171](https://github.com/amplitude/experiment-js-client/issues/171)) ([8326540](https://github.com/amplitude/experiment-js-client/commit/8326540c8b7bc626982c5fcdd8acea42ccddb497))





## [0.5.2](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-tag@0.5.1...@amplitude/experiment-tag@0.5.2) (2025-03-19)


### Bug Fixes

* change integration timeout to 100ms ([#164](https://github.com/amplitude/experiment-js-client/issues/164)) ([25e6367](https://github.com/amplitude/experiment-js-client/commit/25e63675342b3db46d1eba6a7a1509aef3009d33))
* Web experiment variant action deduplication ([#166](https://github.com/amplitude/experiment-js-client/issues/166)) ([df23202](https://github.com/amplitude/experiment-js-client/commit/df232027aa0db64cddb3067bc543243cfcf036ec))





## [0.5.1](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-tag@0.5.0...@amplitude/experiment-tag@0.5.1) (2025-03-13)

**Note:** Version bump only for package @amplitude/experiment-tag





# [0.5.0](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-tag@0.4.1...@amplitude/experiment-tag@0.5.0) (2025-03-11)


### Bug Fixes

* store remote flags in session storage for reuse within session ([#162](https://github.com/amplitude/experiment-js-client/issues/162)) ([ef19343](https://github.com/amplitude/experiment-js-client/commit/ef19343f89303889dc616176d545f5fb9a525e59))


### Features

* WebExperiment class ([#152](https://github.com/amplitude/experiment-js-client/issues/152)) ([468fa3a](https://github.com/amplitude/experiment-js-client/commit/468fa3aed52739e049fdb67bc159de7a8aa94e0f))





## [0.4.1](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-tag@0.4.0...@amplitude/experiment-tag@0.4.1) (2025-03-01)

**Note:** Version bump only for package @amplitude/experiment-tag





# [0.4.0](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-tag@0.3.1...@amplitude/experiment-tag@0.4.0) (2025-02-14)


### Bug Fixes

* Web Experiment - only apply antiflicker for active experiments on page ([#155](https://github.com/amplitude/experiment-js-client/issues/155)) ([5d6f5d1](https://github.com/amplitude/experiment-js-client/commit/5d6f5d16f2e88ac60166f80053ecc34b13285081))


### Features

* migrate to use web_exp_id for web experiment device_id bucketing ([#154](https://github.com/amplitude/experiment-js-client/issues/154)) ([6c7c3ba](https://github.com/amplitude/experiment-js-client/commit/6c7c3bacebe3f8c6077f5d2532d5a06259e374bf))
* Web experiment remote evaluation ([#138](https://github.com/amplitude/experiment-js-client/issues/138)) ([d7c167f](https://github.com/amplitude/experiment-js-client/commit/d7c167f2df625bd15b6a2af2c2cb01a5e1ccc108))





## [0.3.1](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-tag@0.3.0...@amplitude/experiment-tag@0.3.1) (2024-12-27)

**Note:** Version bump only for package @amplitude/experiment-tag





# [0.3.0](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-tag@0.2.7...@amplitude/experiment-tag@0.3.0) (2024-12-23)


### Bug Fixes

* Add patch dom mutator ([#146](https://github.com/amplitude/experiment-js-client/issues/146)) ([a1afcfa](https://github.com/amplitude/experiment-js-client/commit/a1afcfa2161ba75d8756800e153b180adce36d8a))


### Features

* add feature experiment support in web script ([#140](https://github.com/amplitude/experiment-js-client/issues/140)) ([bf60c05](https://github.com/amplitude/experiment-js-client/commit/bf60c05107388ece6f5469b182c2b521fe7957ef))





## [0.2.7](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-tag@0.2.6...@amplitude/experiment-tag@0.2.7) (2024-12-03)

**Note:** Version bump only for package @amplitude/experiment-tag





## [0.2.6](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-tag@0.2.5...@amplitude/experiment-tag@0.2.6) (2024-12-02)

**Note:** Version bump only for package @amplitude/experiment-tag





## [0.2.5](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-tag@0.2.4...@amplitude/experiment-tag@0.2.5) (2024-11-27)


### Bug Fixes

* dedupe control/off exposures ([#142](https://github.com/amplitude/experiment-js-client/issues/142)) ([6495b0c](https://github.com/amplitude/experiment-js-client/commit/6495b0c6a0c900a93b07995371646078703b393f))





## [0.2.4](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-tag@0.2.3...@amplitude/experiment-tag@0.2.4) (2024-11-26)

**Note:** Version bump only for package @amplitude/experiment-tag





## [0.2.3](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-tag@0.2.2...@amplitude/experiment-tag@0.2.3) (2024-11-18)

**Note:** Version bump only for package @amplitude/experiment-tag





## [0.2.2](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-tag@0.2.1...@amplitude/experiment-tag@0.2.2) (2024-10-31)

**Note:** Version bump only for package @amplitude/experiment-tag





## [0.2.1](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-tag@0.2.0...@amplitude/experiment-tag@0.2.1) (2024-10-30)

**Note:** Version bump only for package @amplitude/experiment-tag





# [0.2.0](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-tag@0.1.3...@amplitude/experiment-tag@0.2.0) (2024-10-30)


### Bug Fixes

* add inject support to experiment-tag ([#118](https://github.com/amplitude/experiment-js-client/issues/118)) ([23b8757](https://github.com/amplitude/experiment-js-client/commit/23b8757b70c1e261c9bf607ac3adef3288cf6039))
* add MessageEvent origin check for visual editor initialization ([#133](https://github.com/amplitude/experiment-js-client/issues/133)) ([05c2c38](https://github.com/amplitude/experiment-js-client/commit/05c2c3898cd7dcac4b60ae4794dd73c7e7004be3))
* Dedupe web experiment exposures if URL is unchanged ([cccbc72](https://github.com/amplitude/experiment-js-client/commit/cccbc72421343a349b19fb2cb0cf6b9fd4f0919d))


### Features

* add integration plugin; segment plugin; web exp updates ([#126](https://github.com/amplitude/experiment-js-client/issues/126)) ([58446e2](https://github.com/amplitude/experiment-js-client/commit/58446e2f8af0e41a8dcd9c759d53b60f041c70c2))
* add url param targeting ([#124](https://github.com/amplitude/experiment-js-client/issues/124)) ([aaad4fa](https://github.com/amplitude/experiment-js-client/commit/aaad4fa70788d8eabcfb34745957f57d01fe2a8e))
* Page targeting for Web Experimentation ([#117](https://github.com/amplitude/experiment-js-client/issues/117)) ([ab4ee1f](https://github.com/amplitude/experiment-js-client/commit/ab4ee1f3929b41903c353ba4499bbdcf0a7b27dc))





## [0.1.3](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-tag@0.1.2...@amplitude/experiment-tag@0.1.3) (2024-07-11)

**Note:** Version bump only for package @amplitude/experiment-tag





## [0.1.2](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-tag@0.1.1...@amplitude/experiment-tag@0.1.2) (2024-05-23)

**Note:** Version bump only for package @amplitude/experiment-tag





## 0.1.1 (2024-05-21)

**Note:** Version bump only for package @amplitude/experiment-tag
