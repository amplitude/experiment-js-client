# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [1.17.0](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-js-client@1.16.2...@amplitude/experiment-js-client@1.17.0) (2025-09-26)


### Features

* invalidate exposure cache on user identity change ([#216](https://github.com/amplitude/experiment-js-client/issues/216)) ([0a47b35](https://github.com/amplitude/experiment-js-client/commit/0a47b350bb4c09e541fc3795191d648524f8ffdb))





## [1.16.2](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-js-client@1.16.1...@amplitude/experiment-js-client@1.16.2) (2025-07-28)


### Bug Fixes

* remove null and undefined config to ensure defaults ([#196](https://github.com/amplitude/experiment-js-client/issues/196)) ([78f56ac](https://github.com/amplitude/experiment-js-client/commit/78f56acf92054b3129e6ae80be36c2be43fc2f78))





## [1.16.1](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-js-client@1.16.0...@amplitude/experiment-js-client@1.16.1) (2025-07-01)


### Bug Fixes

* url-redirect impression events fired on redirected page ([#193](https://github.com/amplitude/experiment-js-client/issues/193)) ([a80ac61](https://github.com/amplitude/experiment-js-client/commit/a80ac612290c065f0a4ab877c2f02c2ba0c227c6))





# [1.16.0](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-js-client@1.15.6...@amplitude/experiment-js-client@1.16.0) (2025-06-23)


### Features

* add throwOnError configuration option ([#187](https://github.com/amplitude/experiment-js-client/issues/187)) ([00761aa](https://github.com/amplitude/experiment-js-client/commit/00761aa122c4f5da30af914a82543635bfd25208))





## [1.15.6](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-js-client@1.15.5...@amplitude/experiment-js-client@1.15.6) (2025-05-06)


### Bug Fixes

* catch integration tracker error in PersistentTrackingQueue ([#180](https://github.com/amplitude/experiment-js-client/issues/180)) ([401fd1a](https://github.com/amplitude/experiment-js-client/commit/401fd1aebf177a003345824c7b11549347722079))





## [1.15.5](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-js-client@1.15.4...@amplitude/experiment-js-client@1.15.5) (2025-04-01)


### Bug Fixes

* dont re-add plugin; remove integration timout error log ([#173](https://github.com/amplitude/experiment-js-client/issues/173)) ([9490d83](https://github.com/amplitude/experiment-js-client/commit/9490d83bd66735aab515957d2e666f58fcf5dbad))





## [1.15.4](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-js-client@1.15.3...@amplitude/experiment-js-client@1.15.4) (2025-03-27)

**Note:** Version bump only for package @amplitude/experiment-js-client





## [1.15.3](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-js-client@1.15.2...@amplitude/experiment-js-client@1.15.3) (2025-03-13)


### Bug Fixes

* fix cookie parsing for b64 strings ([#163](https://github.com/amplitude/experiment-js-client/issues/163)) ([6840113](https://github.com/amplitude/experiment-js-client/commit/68401130ffcf4e38c2c35c56c74343f40f0b7bd6))





## [1.15.2](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-js-client@1.15.1...@amplitude/experiment-js-client@1.15.2) (2025-03-11)


### Bug Fixes

* store remote flags in session storage for reuse within session ([#162](https://github.com/amplitude/experiment-js-client/issues/162)) ([ef19343](https://github.com/amplitude/experiment-js-client/commit/ef19343f89303889dc616176d545f5fb9a525e59))
* wait for context before web experiment flags req ([#161](https://github.com/amplitude/experiment-js-client/issues/161)) ([420302a](https://github.com/amplitude/experiment-js-client/commit/420302add6de12ebc78b3b34d8af5a088a259fcf))





## [1.15.1](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-js-client@1.15.0...@amplitude/experiment-js-client@1.15.1) (2025-03-01)


### Bug Fixes

* add IP property to user object ([#160](https://github.com/amplitude/experiment-js-client/issues/160)) ([2231028](https://github.com/amplitude/experiment-js-client/commit/22310282e70ae119aee2c8d248c9380bf78a4404))





# [1.15.0](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-js-client@1.14.1...@amplitude/experiment-js-client@1.15.0) (2025-02-14)


### Features

* Web experiment remote evaluation ([#138](https://github.com/amplitude/experiment-js-client/issues/138)) ([d7c167f](https://github.com/amplitude/experiment-js-client/commit/d7c167f2df625bd15b6a2af2c2cb01a5e1ccc108))





## [1.14.1](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-js-client@1.14.0...@amplitude/experiment-js-client@1.14.1) (2024-12-27)


### Bug Fixes

* fix unexposure events not deduped by integration ([#151](https://github.com/amplitude/experiment-js-client/issues/151)) ([24ebf3e](https://github.com/amplitude/experiment-js-client/commit/24ebf3ee42c11b088e526839146747b6a49e354a))





# [1.14.0](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-js-client@1.13.2...@amplitude/experiment-js-client@1.14.0) (2024-12-23)


### Bug Fixes

* catch error in getUrlParam() in DefaultUserProvider ([#150](https://github.com/amplitude/experiment-js-client/issues/150)) ([007ff68](https://github.com/amplitude/experiment-js-client/commit/007ff684e40a0a78b538a99647e84101ac37e693))


### Features

* add feature experiment support in web script ([#140](https://github.com/amplitude/experiment-js-client/issues/140)) ([bf60c05](https://github.com/amplitude/experiment-js-client/commit/bf60c05107388ece6f5469b182c2b521fe7957ef))





## [1.13.2](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-js-client@1.13.1...@amplitude/experiment-js-client@1.13.2) (2024-12-03)


### Bug Fixes

* misconfigured polling interval ([e0e9525](https://github.com/amplitude/experiment-js-client/commit/e0e95259b617bddcca894e469a1c0e81b7523b82))





## [1.13.1](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-js-client@1.13.0...@amplitude/experiment-js-client@1.13.1) (2024-12-02)

**Note:** Version bump only for package @amplitude/experiment-js-client





# [1.13.0](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-js-client@1.12.3...@amplitude/experiment-js-client@1.13.0) (2024-11-26)


### Features

* increase flag polling interval; add flag poller interval config ([#141](https://github.com/amplitude/experiment-js-client/issues/141)) ([29b1640](https://github.com/amplitude/experiment-js-client/commit/29b1640f54ac0cab1ac1795d0ffd104a1fbf44d5))





## [1.12.3](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-js-client@1.12.2...@amplitude/experiment-js-client@1.12.3) (2024-11-18)


### Bug Fixes

* catch flag fetch timeout error when not in debug mode ([#137](https://github.com/amplitude/experiment-js-client/issues/137)) ([59da6d4](https://github.com/amplitude/experiment-js-client/commit/59da6d4acd8309595d7c88ad1761b5ddd4364fbb))





## [1.12.2](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-js-client@1.12.1...@amplitude/experiment-js-client@1.12.2) (2024-10-31)

**Note:** Version bump only for package @amplitude/experiment-js-client





## [1.12.1](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-js-client@1.12.0...@amplitude/experiment-js-client@1.12.1) (2024-10-30)


### Bug Fixes

* fix exposure tracking for amplitude integration ([c77b437](https://github.com/amplitude/experiment-js-client/commit/c77b43756b33b83e654730af85bcf28c11e9de09))





# [1.12.0](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-js-client@1.11.0...@amplitude/experiment-js-client@1.12.0) (2024-10-30)


### Bug Fixes

* catch variant/flag fetch timeout error and log at debug-level ([#135](https://github.com/amplitude/experiment-js-client/issues/135)) ([879cfe3](https://github.com/amplitude/experiment-js-client/commit/879cfe327788e2e3c4a140840371868cfa62bcbc))
* persistent tracking queue flush when tracker set ([#130](https://github.com/amplitude/experiment-js-client/issues/130)) ([93532c1](https://github.com/amplitude/experiment-js-client/commit/93532c1d00adad68cece4637f3d4a45cdcd2716a))
* persistent tracking queue poller ([#131](https://github.com/amplitude/experiment-js-client/issues/131)) ([1a39eda](https://github.com/amplitude/experiment-js-client/commit/1a39eda55d34b1ab48c1fc4ef03445efd59e4aa4))


### Features

* add integration plugin; segment plugin; web exp updates ([#126](https://github.com/amplitude/experiment-js-client/issues/126)) ([58446e2](https://github.com/amplitude/experiment-js-client/commit/58446e2f8af0e41a8dcd9c759d53b60f041c70c2))
* add url param targeting ([#124](https://github.com/amplitude/experiment-js-client/issues/124)) ([aaad4fa](https://github.com/amplitude/experiment-js-client/commit/aaad4fa70788d8eabcfb34745957f57d01fe2a8e))
* add web user targeting ([#116](https://github.com/amplitude/experiment-js-client/issues/116)) ([0312724](https://github.com/amplitude/experiment-js-client/commit/03127244b472925d1d91b80ed95df7fd06b9a38c))
* Page targeting for Web Experimentation ([#117](https://github.com/amplitude/experiment-js-client/issues/117)) ([ab4ee1f](https://github.com/amplitude/experiment-js-client/commit/ab4ee1f3929b41903c353ba4499bbdcf0a7b27dc))
* track impressions for web experiments ([#127](https://github.com/amplitude/experiment-js-client/issues/127)) ([fef53e5](https://github.com/amplitude/experiment-js-client/commit/fef53e5737f3e7262beb35b6f575be804bac523f))





# [1.11.0](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-js-client@1.10.2...@amplitude/experiment-js-client@1.11.0) (2024-07-11)


### Features

* add options evaluation api in experiment-core ([#114](https://github.com/amplitude/experiment-js-client/issues/114)) ([ce657a1](https://github.com/amplitude/experiment-js-client/commit/ce657a1fc9efdd28921ad12ccb702fb602a84c0c))





## [1.10.2](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-js-client@1.10.1...@amplitude/experiment-js-client@1.10.2) (2024-05-23)


### Bug Fixes

* convert initial variants so experiment key is tracked correctly ([#108](https://github.com/amplitude/experiment-js-client/issues/108)) ([66657c4](https://github.com/amplitude/experiment-js-client/commit/66657c44201bfd2aa145c9aebde185a103ada587))





## [1.10.1](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-js-client@1.10.0...@amplitude/experiment-js-client@1.10.1) (2024-05-21)


### Bug Fixes

* variant() debug log ([#107](https://github.com/amplitude/experiment-js-client/issues/107)) ([50fd116](https://github.com/amplitude/experiment-js-client/commit/50fd11688e7884054dbbfaeeb4ec2f95825ee7bf))





# [1.10.0](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-js-client@1.9.9...@amplitude/experiment-js-client@1.10.0) (2024-02-06)


### Features

* bootstrap initial local evaluation flags ([#93](https://github.com/amplitude/experiment-js-client/issues/93)) ([53a9ded](https://github.com/amplitude/experiment-js-client/commit/53a9dedb1f5433f1fb4f1fd510fe1c278d56319b))





## [1.9.9](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-js-client@1.9.8...@amplitude/experiment-js-client@1.9.9) (2024-01-29)


### Bug Fixes

* Improve remote evaluation fetch retry logic ([#96](https://github.com/amplitude/experiment-js-client/issues/96)) ([9b8a559](https://github.com/amplitude/experiment-js-client/commit/9b8a559aed2ea1f594e0f1c94f14d64131ed7eb8))





## [1.9.8](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-js-client@1.9.7...@amplitude/experiment-js-client@1.9.8) (2024-01-11)


### Bug Fixes

* remove localStorage undefined warning message ([#95](https://github.com/amplitude/experiment-js-client/issues/95)) ([19fdf19](https://github.com/amplitude/experiment-js-client/commit/19fdf197c2959b70ce7c100b25f225088f693ac0))





## [1.9.7](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-js-client@1.9.6...@amplitude/experiment-js-client@1.9.7) (2023-11-21)

**Note:** Version bump only for package @amplitude/experiment-js-client





## [1.9.6](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-js-client@1.9.5...@amplitude/experiment-js-client@1.9.6) (2023-11-15)


### Bug Fixes

* Handle localStorage errors from iframe ([#92](https://github.com/amplitude/experiment-js-client/issues/92)) ([159947e](https://github.com/amplitude/experiment-js-client/commit/159947e6f2824895118c45aeec6d9a102c015a44))





## [1.9.5](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-js-client@1.9.4...@amplitude/experiment-js-client@1.9.5) (2023-11-09)


### Bug Fixes

* call fetch on start by default ([#91](https://github.com/amplitude/experiment-js-client/issues/91)) ([8bb93fa](https://github.com/amplitude/experiment-js-client/commit/8bb93faa162e730fa5f1492875556585f359cd38))





## [1.9.4](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-js-client@1.9.3...@amplitude/experiment-js-client@1.9.4) (2023-11-03)


### Bug Fixes

* remove async from cache load and store ([0057076](https://github.com/amplitude/experiment-js-client/commit/0057076b7ab67283376ff993ea30f14383dad994))





## [1.9.3](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-js-client@1.9.2...@amplitude/experiment-js-client@1.9.3) (2023-11-03)


### Bug Fixes

* make storage synchronous ([#90](https://github.com/amplitude/experiment-js-client/issues/90)) ([f279830](https://github.com/amplitude/experiment-js-client/commit/f279830a11bb2a0a147defb6d28bc3f89808f1f4))





## [1.9.2](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-js-client@1.9.1...@amplitude/experiment-js-client@1.9.2) (2023-10-06)


### Bug Fixes

* add support for groups with client-side local eval ([#89](https://github.com/amplitude/experiment-js-client/issues/89)) ([cd47bcf](https://github.com/amplitude/experiment-js-client/commit/cd47bcf151235c891b0082e5c35c0c35405bc21a))
* fix nullptr if local evaluation does not return variant ([ed99791](https://github.com/amplitude/experiment-js-client/commit/ed99791fe20ee0d82670a54795e5f3c8bbee2e20))





## [1.9.1](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-js-client@1.9.0...@amplitude/experiment-js-client@1.9.1) (2023-09-18)


### Bug Fixes

* optimize variant cache access, legacy exposure ([#88](https://github.com/amplitude/experiment-js-client/issues/88)) ([bf40f9b](https://github.com/amplitude/experiment-js-client/commit/bf40f9b806c92f03fe33ce99791061cf0dd18bb1))





# [1.9.0](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-js-client@1.8.2...@amplitude/experiment-js-client@1.9.0) (2023-08-29)


### Features

* client-side local evaluation and core evaluation package ([#81](https://github.com/amplitude/experiment-js-client/issues/81)) ([91b24c5](https://github.com/amplitude/experiment-js-client/commit/91b24c56a92d38e87448084fc44d2c28005add60))





## [1.8.2](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-js-client@1.8.1...@amplitude/experiment-js-client@1.8.2) (2023-08-22)


### Bug Fixes

* remove duplicated user agent parser from build ([#74](https://github.com/amplitude/experiment-js-client/issues/74)) ([c639c27](https://github.com/amplitude/experiment-js-client/commit/c639c279bbbb198be9b7512d18af686aec0317f9))





## [1.8.1](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-js-client@1.8.0...@amplitude/experiment-js-client@1.8.1) (2023-06-23)


### Bug Fixes

* intialize with custom user provider ([#73](https://github.com/amplitude/experiment-js-client/issues/73)) ([2232d1a](https://github.com/amplitude/experiment-js-client/commit/2232d1a647b5b6188805103e1fdf4dd34e46f047))





# [1.8.0](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-js-client@1.7.5...@amplitude/experiment-js-client@1.8.0) (2023-06-02)


### Features

* support expeirment key on variant and exposure event ([#72](https://github.com/amplitude/experiment-js-client/issues/72)) ([6d55f90](https://github.com/amplitude/experiment-js-client/commit/6d55f90535e03ca2ef309db582c82f8255216525))





## [1.7.5](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-js-client@1.7.4...@amplitude/experiment-js-client@1.7.5) (2023-05-09)

**Note:** Version bump only for package @amplitude/experiment-js-client





## [1.7.4](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-js-client@1.7.3...@amplitude/experiment-js-client@1.7.4) (2023-04-19)

**Note:** Version bump only for package @amplitude/experiment-js-client





## [1.7.3](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-js-client@1.7.2...@amplitude/experiment-js-client@1.7.3) (2023-02-07)


### Bug Fixes

* unwrap default user provider before connector ([#57](https://github.com/amplitude/experiment-js-client/issues/57)) ([393c43e](https://github.com/amplitude/experiment-js-client/commit/393c43ef0ef30e550721bc6bb5570363e2ce4ffc))





## [1.7.2](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-js-client@1.7.1...@amplitude/experiment-js-client@1.7.2) (2023-02-06)


### Bug Fixes

* device tracking with amplitude integration ([#56](https://github.com/amplitude/experiment-js-client/issues/56)) ([3bc567f](https://github.com/amplitude/experiment-js-client/commit/3bc567f4d73f877f7037c1015caf08c15d961dce))





## [1.7.1](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-js-client@1.7.0...@amplitude/experiment-js-client@1.7.1) (2022-11-25)


### Bug Fixes

* clear cache if no flag keys so disabled flags are cleared ([#54](https://github.com/amplitude/experiment-js-client/issues/54)) ([378cb10](https://github.com/amplitude/experiment-js-client/commit/378cb10aa457cd7ef21cd8cef16ced01864babc0))





# [1.7.0](https://github.com/amplitude/experiment-js-client/compare/@amplitude/experiment-js-client@1.6.0...@amplitude/experiment-js-client@1.7.0) (2022-11-18)


### Features

* sub flag key config support ([#53](https://github.com/amplitude/experiment-js-client/issues/53)) ([ef9fdf6](https://github.com/amplitude/experiment-js-client/commit/ef9fdf61e98fda676b2827b43baed712893089bd))





# 1.6.0 (2022-10-21)


### Features

* add clear method to clear flag configs ([#51](https://github.com/amplitude/experiment-js-client/issues/51)) ([ceddb50](https://github.com/amplitude/experiment-js-client/commit/ceddb5082589e28cd6b5eaff4ddd1cfd20b69b9d))





## [1.5.6](https://github.com/amplitude/experiment-js-client/compare/v1.5.5...v1.5.6) (2022-09-06)

**Note:** Version bump only for package @amplitude/experiment-js-client





## [1.5.5](https://github.com/amplitude/experiment-js-client/compare/v1.5.4...v1.5.5) (2022-08-03)


### Bug Fixes

* increase timeout for experiment integration to 10 seconds ([#39](https://github.com/amplitude/experiment-js-client/issues/39)) ([1172ccb](https://github.com/amplitude/experiment-js-client/commit/1172ccb643ebe1c6b3076429ffde68563a1a4a92))





## [1.5.4](https://github.com/amplitude/experiment-js-client/compare/v1.5.3...v1.5.4) (2022-07-27)


### Bug Fixes

* update analytics connector dependency ([e699a90](https://github.com/amplitude/experiment-js-client/commit/e699a90a7ba37dd40532eaf195b0983e8975f798))





## [1.5.3](https://github.com/amplitude/experiment-js-client/compare/v1.5.2...v1.5.3) (2022-06-01)


### Bug Fixes

* add secondary initial variants as a fallback ([7727ba9](https://github.com/amplitude/experiment-js-client/commit/7727ba96c519b5b4dbd9355f86fca9ac59a9021d))
* re-add debug logging ([c18dfc9](https://github.com/amplitude/experiment-js-client/commit/c18dfc9f2fa4b7cbcbb35493cbb2c457a64ed83e))





## [1.5.2](https://github.com/amplitude/experiment-js-client/compare/v1.5.1...v1.5.2) (2022-05-28)


### Bug Fixes

* polyfill object entries for ie11 ([5c318ea](https://github.com/amplitude/experiment-js-client/commit/5c318ea100dafb467c06bafef69414d88f7867ea))





## [1.5.1](https://github.com/amplitude/experiment-js-client/compare/v1.5.0...v1.5.1) (2022-05-12)


### Bug Fixes

* update analytics connector ([0b4a5a6](https://github.com/amplitude/experiment-js-client/commit/0b4a5a623823b39f53eb5e5c198fcff5b287c5de))





# [1.5.0](https://github.com/amplitude/experiment-js-client/compare/v1.4.1...v1.5.0) (2022-04-30)


### Features

* add http client config ([#30](https://github.com/amplitude/experiment-js-client/issues/30)) ([8fa5ea1](https://github.com/amplitude/experiment-js-client/commit/8fa5ea1420bed610e997303d5c29e7a49ea827ef))





## [1.4.1](https://github.com/amplitude/experiment-js-client/compare/v1.4.0...v1.4.1) (2022-04-06)


### Bug Fixes

* make variant optional in exposure object for segment ([#26](https://github.com/amplitude/experiment-js-client/issues/26)) ([aa29994](https://github.com/amplitude/experiment-js-client/commit/aa299943cabd52f4077905a4d76a73eefb68090e))
* support script tag installs for analytics connector ([#28](https://github.com/amplitude/experiment-js-client/issues/28)) ([fa6be45](https://github.com/amplitude/experiment-js-client/commit/fa6be45182569b3fe1f6a00204e031b6ae9747e1))





# [1.4.0](https://github.com/amplitude/experiment-js-client/compare/v1.3.4...v1.4.0) (2022-02-12)


### Bug Fixes

* simplify connector analytics provider ([#24](https://github.com/amplitude/experiment-js-client/issues/24)) ([0aa4eee](https://github.com/amplitude/experiment-js-client/commit/0aa4eee400a8ceaf62de73aa178bc6385c437c17))


### Features

* implement exposure tracking provider ([#25](https://github.com/amplitude/experiment-js-client/issues/25)) ([9fb040c](https://github.com/amplitude/experiment-js-client/commit/9fb040c2a23d00f2f91a27028d8b271544f13854))
* integrate core package into experiment sdk ([#16](https://github.com/amplitude/experiment-js-client/issues/16)) ([7ff0540](https://github.com/amplitude/experiment-js-client/commit/7ff054078a67cafbf8fcd58af45b0c9a9f9a28c3))
* rename amplitude-core to analytics-connector ([#22](https://github.com/amplitude/experiment-js-client/issues/22)) ([70b3b50](https://github.com/amplitude/experiment-js-client/commit/70b3b5048a5bbc0d88717f5c8cf2db0a8cc85a4d))
* update analytics connector to use new exposure event definition ([#23](https://github.com/amplitude/experiment-js-client/issues/23)) ([b76b33c](https://github.com/amplitude/experiment-js-client/commit/b76b33ce96273848d9f1b7ae04a26c1ac7311d0c))





## [1.3.4](https://github.com/amplitude/experiment-js-client/compare/v1.3.3...v1.3.4) (2022-01-24)


### Bug Fixes

* remove _logEvent from instance type ([#21](https://github.com/amplitude/experiment-js-client/issues/21)) ([670a2f2](https://github.com/amplitude/experiment-js-client/commit/670a2f2f715c7739ac449d7adf69edd9045c5ab3))





## [1.3.3](https://github.com/amplitude/experiment-js-client/compare/v1.3.2...v1.3.3) (2022-01-20)


### Bug Fixes

* fix unset user property ([#20](https://github.com/amplitude/experiment-js-client/issues/20)) ([b722506](https://github.com/amplitude/experiment-js-client/commit/b722506c79bd920467025f46beda28416bb63a71))





## [1.3.2](https://github.com/amplitude/experiment-js-client/compare/v1.3.1...v1.3.2) (2022-01-20)


### Bug Fixes

* revert changes ([bee259f](https://github.com/amplitude/experiment-js-client/commit/bee259faf1ebe6abb92fa47af001649be4bbe58d))





## [1.3.1](https://github.com/amplitude/experiment-js-client/compare/v1.3.0...v1.3.1) (2022-01-20)


### Bug Fixes

* type issue with global amp instance ([#18](https://github.com/amplitude/experiment-js-client/issues/18)) ([5fcf461](https://github.com/amplitude/experiment-js-client/commit/5fcf4615677a280b4acd5edfd6ce81ec1c14f6eb))





# [1.3.0](https://github.com/amplitude/experiment-js-client/compare/v1.2.0...v1.3.0) (2021-10-18)


### Features

* unset user properties when variant evaluates to none or is a fallback ([#13](https://github.com/amplitude/experiment-js-client/issues/13)) ([dbab7e8](https://github.com/amplitude/experiment-js-client/commit/dbab7e83659628edcd4fca71e001fc38cae6b27b))





# [1.2.0](https://github.com/amplitude/experiment-js-client/compare/v1.1.1...v1.2.0) (2021-08-12)


### Features

* add user properties to analytics events like exposure ([#11](https://github.com/amplitude/experiment-js-client/issues/11)) ([881ab55](https://github.com/amplitude/experiment-js-client/commit/881ab55992ac55d7fc564b7dd48a5e2ac4d3b8f2))





## [1.1.1](https://github.com/amplitude/experiment-js-client/compare/v1.1.0...v1.1.1) (2021-08-09)


### Bug Fixes

* use user provider set by config ([3774e3c](https://github.com/amplitude/experiment-js-client/commit/3774e3c3dc7cd66fbc70bd260e0a36823ee26637))





# [1.1.0](https://github.com/amplitude/experiment-js-client/compare/v1.0.3...v1.1.0) (2021-07-29)


### Bug Fixes

* add additional client tests and fixes ([#8](https://github.com/amplitude/experiment-js-client/issues/8)) ([d0d196d](https://github.com/amplitude/experiment-js-client/commit/d0d196d32be420b4363ecb95a19aed188e8630c2))
* don't track exposure to fallbacks and add tests ([#9](https://github.com/amplitude/experiment-js-client/issues/9)) ([bd4917f](https://github.com/amplitude/experiment-js-client/commit/bd4917fcd7b18ceafb6599b76c5e728d565528b4))
* revert POST to GET request with user in header ([#10](https://github.com/amplitude/experiment-js-client/issues/10)) ([326990c](https://github.com/amplitude/experiment-js-client/commit/326990cd19c00399669d9fa1f369aaa709727766))


### Features

* client-side exposure tracking via analytics provider ([#7](https://github.com/amplitude/experiment-js-client/issues/7)) ([30448ab](https://github.com/amplitude/experiment-js-client/commit/30448abf524f12bd6ae7fc34bd247c5ad2927c3a))





## [1.0.3](https://github.com/amplitude/experiment-js-client/compare/v1.0.2...v1.0.3) (2021-07-19)


### Bug Fixes

* use merged ccontext in post body ([4ead70a](https://github.com/amplitude/experiment-js-client/commit/4ead70a6c81f54b3db02cf4b39cbb5415ddc09a0))





## [1.0.2](https://github.com/amplitude/experiment-js-client/compare/v1.0.1...v1.0.2) (2021-07-16)


### Bug Fixes

* use POST instead of GET for fetch request ([#6](https://github.com/amplitude/experiment-js-client/issues/6)) ([5a1c580](https://github.com/amplitude/experiment-js-client/commit/5a1c58081342a82b50bbc3ada4531ab8d8041fde))





## [1.0.1](https://github.com/amplitude/experiment-js-client/compare/v1.0.0...v1.0.1) (2021-06-09)


### Bug Fixes

* no retry console logging; handle error response ([969a5f6](https://github.com/amplitude/experiment-js-client/commit/969a5f6b61fe7fb7ea5ae85fb1d63eb2fd41c2fe))
