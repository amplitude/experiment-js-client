# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [1.5.7](https://github.com/amplitude/experiment-js-client/compare/v1.5.6...v1.5.7) (2022-09-26)


### Bug Fixes

* [#44](https://github.com/amplitude/experiment-js-client/issues/44) ReferenceError: global is not defined ([#45](https://github.com/amplitude/experiment-js-client/issues/45)) ([8722d18](https://github.com/amplitude/experiment-js-client/commit/8722d18045497825111d3a4e64feef4dd7aeaa98))





## [1.5.6](https://github.com/amplitude/experiment-js-client/compare/v1.5.5...v1.5.6) (2022-09-06)


### Bug Fixes

* move isEqual to util, add null check ([#42](https://github.com/amplitude/experiment-js-client/issues/42)) ([f8eec48](https://github.com/amplitude/experiment-js-client/commit/f8eec48a104ed8e2e34b823279b4e8100d290c46))





## [1.5.5](https://github.com/amplitude/experiment-js-client/compare/v1.5.4...v1.5.5) (2022-08-03)


### Bug Fixes

* increase timeout for experiment integration to 10 seconds ([#39](https://github.com/amplitude/experiment-js-client/issues/39)) ([1172ccb](https://github.com/amplitude/experiment-js-client/commit/1172ccb643ebe1c6b3076429ffde68563a1a4a92))





## [1.5.4](https://github.com/amplitude/experiment-js-client/compare/v1.5.3...v1.5.4) (2022-07-27)


### Bug Fixes

* add guard for navigator for use in envs that do no support navigator ([#36](https://github.com/amplitude/experiment-js-client/issues/36)) ([2c8d398](https://github.com/amplitude/experiment-js-client/commit/2c8d3982a33caa088d6cfe74212cae8f07b1ac06))
* update analytics connector dependency ([e699a90](https://github.com/amplitude/experiment-js-client/commit/e699a90a7ba37dd40532eaf195b0983e8975f798))





## [1.5.3](https://github.com/amplitude/experiment-js-client/compare/v1.5.2...v1.5.3) (2022-06-01)


### Bug Fixes

* add secondary initial variants as a fallback ([7727ba9](https://github.com/amplitude/experiment-js-client/commit/7727ba96c519b5b4dbd9355f86fca9ac59a9021d))
* re-add debug logging ([c18dfc9](https://github.com/amplitude/experiment-js-client/commit/c18dfc9f2fa4b7cbcbb35493cbb2c457a64ed83e))





## [1.5.2](https://github.com/amplitude/experiment-js-client/compare/v1.5.1...v1.5.2) (2022-05-28)


### Bug Fixes

* polyfill object entries for ie11 ([5c318ea](https://github.com/amplitude/experiment-js-client/commit/5c318ea100dafb467c06bafef69414d88f7867ea))
* polyfill object entries for ie11 ([#35](https://github.com/amplitude/experiment-js-client/issues/35)) ([3d7ab23](https://github.com/amplitude/experiment-js-client/commit/3d7ab2367fe34fc9a0c916bd0a9073e8791c75c5))





## [1.5.1](https://github.com/amplitude/experiment-js-client/compare/v1.5.0...v1.5.1) (2022-05-12)


### Bug Fixes

* dont use includes to support IE11 ([#32](https://github.com/amplitude/experiment-js-client/issues/32)) ([c9d42d2](https://github.com/amplitude/experiment-js-client/commit/c9d42d2826063e692e79a886e81b74b7e2c62921))
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

* core package for seamless integration with amplitude analytics ([#15](https://github.com/amplitude/experiment-js-client/issues/15)) ([f62c4cb](https://github.com/amplitude/experiment-js-client/commit/f62c4cbd833158e9749c69df53bfbeb41b9f917d))
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
