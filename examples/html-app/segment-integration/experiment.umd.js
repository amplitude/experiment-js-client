(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
    typeof define === 'function' && define.amd ? define(['exports'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.Experiment = {}));
})(this, (function (exports) { 'use strict';

    /**
     * @deprecated Update your version of the amplitude analytics-js SDK to 8.17.0+ and for seamless
     * integration with the amplitude analytics SDK.
     */
    var AmplitudeUserProvider = /** @class */ (function () {
        function AmplitudeUserProvider(amplitudeInstance) {
            this.amplitudeInstance = amplitudeInstance;
        }
        AmplitudeUserProvider.prototype.getUser = function () {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
            return {
                device_id: (_b = (_a = this.amplitudeInstance) === null || _a === void 0 ? void 0 : _a.options) === null || _b === void 0 ? void 0 : _b.deviceId,
                user_id: (_d = (_c = this.amplitudeInstance) === null || _c === void 0 ? void 0 : _c.options) === null || _d === void 0 ? void 0 : _d.userId,
                version: (_f = (_e = this.amplitudeInstance) === null || _e === void 0 ? void 0 : _e.options) === null || _f === void 0 ? void 0 : _f.versionName,
                language: (_h = (_g = this.amplitudeInstance) === null || _g === void 0 ? void 0 : _g.options) === null || _h === void 0 ? void 0 : _h.language,
                platform: (_k = (_j = this.amplitudeInstance) === null || _j === void 0 ? void 0 : _j.options) === null || _k === void 0 ? void 0 : _k.platform,
                os: this.getOs(),
                device_model: this.getDeviceModel(),
            };
        };
        AmplitudeUserProvider.prototype.getOs = function () {
            var _a, _b, _c, _d, _e, _f;
            return [
                (_c = (_b = (_a = this.amplitudeInstance) === null || _a === void 0 ? void 0 : _a._ua) === null || _b === void 0 ? void 0 : _b.browser) === null || _c === void 0 ? void 0 : _c.name,
                (_f = (_e = (_d = this.amplitudeInstance) === null || _d === void 0 ? void 0 : _d._ua) === null || _e === void 0 ? void 0 : _e.browser) === null || _f === void 0 ? void 0 : _f.major,
            ]
                .filter(function (e) { return e !== null && e !== undefined; })
                .join(' ');
        };
        AmplitudeUserProvider.prototype.getDeviceModel = function () {
            var _a, _b, _c;
            return (_c = (_b = (_a = this.amplitudeInstance) === null || _a === void 0 ? void 0 : _a._ua) === null || _b === void 0 ? void 0 : _b.os) === null || _c === void 0 ? void 0 : _c.name;
        };
        return AmplitudeUserProvider;
    }());
    /**
     * @deprecated Update your version of the amplitude analytics-js SDK to 8.17.0+ and for seamless
     * integration with the amplitude analytics SDK.
     */
    var AmplitudeAnalyticsProvider = /** @class */ (function () {
        function AmplitudeAnalyticsProvider(amplitudeInstance) {
            this.amplitudeInstance = amplitudeInstance;
        }
        AmplitudeAnalyticsProvider.prototype.track = function (event) {
            this.amplitudeInstance.logEvent(event.name, event.properties);
        };
        AmplitudeAnalyticsProvider.prototype.setUserProperty = function (event) {
            var _a;
            var _b;
            // if the variant has a value, set the user property and log an event
            this.amplitudeInstance.setUserProperties((_a = {},
                _a[event.userProperty] = (_b = event.variant) === null || _b === void 0 ? void 0 : _b.value,
                _a));
        };
        AmplitudeAnalyticsProvider.prototype.unsetUserProperty = function (event) {
            var _a;
            // if the variant does not have a value, unset the user property
            this.amplitudeInstance['_logEvent']('$identify', null, null, {
                $unset: (_a = {}, _a[event.userProperty] = '-', _a),
            });
        };
        return AmplitudeAnalyticsProvider;
    }());

    /******************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */
    var __assign$2 = function () {
      __assign$2 = Object.assign || function __assign(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
          s = arguments[i];
          for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
        }
        return t;
      };
      return __assign$2.apply(this, arguments);
    };
    function __awaiter$1(thisArg, _arguments, P, generator) {
      function adopt(value) {
        return value instanceof P ? value : new P(function (resolve) {
          resolve(value);
        });
      }
      return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) {
          try {
            step(generator.next(value));
          } catch (e) {
            reject(e);
          }
        }
        function rejected(value) {
          try {
            step(generator["throw"](value));
          } catch (e) {
            reject(e);
          }
        }
        function step(result) {
          result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
        }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
      });
    }
    function __generator$1(thisArg, body) {
      var _ = {
          label: 0,
          sent: function () {
            if (t[0] & 1) throw t[1];
            return t[1];
          },
          trys: [],
          ops: []
        },
        f,
        y,
        t,
        g;
      return g = {
        next: verb(0),
        "throw": verb(1),
        "return": verb(2)
      }, typeof Symbol === "function" && (g[Symbol.iterator] = function () {
        return this;
      }), g;
      function verb(n) {
        return function (v) {
          return step([n, v]);
        };
      }
      function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
          if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
          if (y = 0, t) op = [op[0] & 2, t.value];
          switch (op[0]) {
            case 0:
            case 1:
              t = op;
              break;
            case 4:
              _.label++;
              return {
                value: op[1],
                done: false
              };
            case 5:
              _.label++;
              y = op[1];
              op = [0];
              continue;
            case 7:
              op = _.ops.pop();
              _.trys.pop();
              continue;
            default:
              if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) {
                _ = 0;
                continue;
              }
              if (op[0] === 3 && (!t || op[1] > t[0] && op[1] < t[3])) {
                _.label = op[1];
                break;
              }
              if (op[0] === 6 && _.label < t[1]) {
                _.label = t[1];
                t = op;
                break;
              }
              if (t && _.label < t[2]) {
                _.label = t[2];
                _.ops.push(op);
                break;
              }
              if (t[2]) _.ops.pop();
              _.trys.pop();
              continue;
          }
          op = body.call(thisArg, _);
        } catch (e) {
          op = [6, e];
          y = 0;
        } finally {
          f = t = 0;
        }
        if (op[0] & 5) throw op[1];
        return {
          value: op[0] ? op[1] : void 0,
          done: true
        };
      }
    }
    function __values$2(o) {
      var s = typeof Symbol === "function" && Symbol.iterator,
        m = s && o[s],
        i = 0;
      if (m) return m.call(o);
      if (o && typeof o.length === "number") return {
        next: function () {
          if (o && i >= o.length) o = void 0;
          return {
            value: o && o[i++],
            done: !o
          };
        }
      };
      throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
    }
    function __read$2(o, n) {
      var m = typeof Symbol === "function" && o[Symbol.iterator];
      if (!m) return o;
      var i = m.call(o),
        r,
        ar = [],
        e;
      try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
      } catch (error) {
        e = {
          error: error
        };
      } finally {
        try {
          if (r && !r.done && (m = i["return"])) m.call(i);
        } finally {
          if (e) throw e.error;
        }
      }
      return ar;
    }
    function __spreadArray$1(to, from, pack) {
      if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
          if (!ar) ar = Array.prototype.slice.call(from, 0, i);
          ar[i] = from[i];
        }
      }
      return to.concat(ar || Array.prototype.slice.call(from));
    }
    typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
      var e = new Error(message);
      return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
    };

    /******************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */
    /* global Reflect, Promise, SuppressedError, Symbol */

    var extendStatics = function (d, b) {
      extendStatics = Object.setPrototypeOf || {
        __proto__: []
      } instanceof Array && function (d, b) {
        d.__proto__ = b;
      } || function (d, b) {
        for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p];
      };
      return extendStatics(d, b);
    };
    function __extends(d, b) {
      if (typeof b !== "function" && b !== null) throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
      extendStatics(d, b);
      function __() {
        this.constructor = d;
      }
      d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    }
    var __assign$1 = function () {
      __assign$1 = Object.assign || function __assign(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
          s = arguments[i];
          for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
        }
        return t;
      };
      return __assign$1.apply(this, arguments);
    };
    function __awaiter(thisArg, _arguments, P, generator) {
      function adopt(value) {
        return value instanceof P ? value : new P(function (resolve) {
          resolve(value);
        });
      }
      return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) {
          try {
            step(generator.next(value));
          } catch (e) {
            reject(e);
          }
        }
        function rejected(value) {
          try {
            step(generator["throw"](value));
          } catch (e) {
            reject(e);
          }
        }
        function step(result) {
          result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
        }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
      });
    }
    function __generator(thisArg, body) {
      var _ = {
          label: 0,
          sent: function () {
            if (t[0] & 1) throw t[1];
            return t[1];
          },
          trys: [],
          ops: []
        },
        f,
        y,
        t,
        g;
      return g = {
        next: verb(0),
        "throw": verb(1),
        "return": verb(2)
      }, typeof Symbol === "function" && (g[Symbol.iterator] = function () {
        return this;
      }), g;
      function verb(n) {
        return function (v) {
          return step([n, v]);
        };
      }
      function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
          if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
          if (y = 0, t) op = [op[0] & 2, t.value];
          switch (op[0]) {
            case 0:
            case 1:
              t = op;
              break;
            case 4:
              _.label++;
              return {
                value: op[1],
                done: false
              };
            case 5:
              _.label++;
              y = op[1];
              op = [0];
              continue;
            case 7:
              op = _.ops.pop();
              _.trys.pop();
              continue;
            default:
              if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) {
                _ = 0;
                continue;
              }
              if (op[0] === 3 && (!t || op[1] > t[0] && op[1] < t[3])) {
                _.label = op[1];
                break;
              }
              if (op[0] === 6 && _.label < t[1]) {
                _.label = t[1];
                t = op;
                break;
              }
              if (t && _.label < t[2]) {
                _.label = t[2];
                _.ops.push(op);
                break;
              }
              if (t[2]) _.ops.pop();
              _.trys.pop();
              continue;
          }
          op = body.call(thisArg, _);
        } catch (e) {
          op = [6, e];
          y = 0;
        } finally {
          f = t = 0;
        }
        if (op[0] & 5) throw op[1];
        return {
          value: op[0] ? op[1] : void 0,
          done: true
        };
      }
    }
    function __values$1(o) {
      var s = typeof Symbol === "function" && Symbol.iterator,
        m = s && o[s],
        i = 0;
      if (m) return m.call(o);
      if (o && typeof o.length === "number") return {
        next: function () {
          if (o && i >= o.length) o = void 0;
          return {
            value: o && o[i++],
            done: !o
          };
        }
      };
      throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
    }
    function __read$1(o, n) {
      var m = typeof Symbol === "function" && o[Symbol.iterator];
      if (!m) return o;
      var i = m.call(o),
        r,
        ar = [],
        e;
      try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
      } catch (error) {
        e = {
          error: error
        };
      } finally {
        try {
          if (r && !r.done && (m = i["return"])) m.call(i);
        } finally {
          if (e) throw e.error;
        }
      }
      return ar;
    }
    function __spreadArray(to, from, pack) {
      if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
          if (!ar) ar = Array.prototype.slice.call(from, 0, i);
          ar[i] = from[i];
        }
      }
      return to.concat(ar || Array.prototype.slice.call(from));
    }
    typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
      var e = new Error(message);
      return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
    };
    var EvaluationOperator = {
      IS: 'is',
      IS_NOT: 'is not',
      CONTAINS: 'contains',
      DOES_NOT_CONTAIN: 'does not contain',
      LESS_THAN: 'less',
      LESS_THAN_EQUALS: 'less or equal',
      GREATER_THAN: 'greater',
      GREATER_THAN_EQUALS: 'greater or equal',
      VERSION_LESS_THAN: 'version less',
      VERSION_LESS_THAN_EQUALS: 'version less or equal',
      VERSION_GREATER_THAN: 'version greater',
      VERSION_GREATER_THAN_EQUALS: 'version greater or equal',
      SET_IS: 'set is',
      SET_IS_NOT: 'set is not',
      SET_CONTAINS: 'set contains',
      SET_DOES_NOT_CONTAIN: 'set does not contain',
      SET_CONTAINS_ANY: 'set contains any',
      SET_DOES_NOT_CONTAIN_ANY: 'set does not contain any',
      REGEX_MATCH: 'regex match',
      REGEX_DOES_NOT_MATCH: 'regex does not match'
    };
    var stringToUtf8ByteArray = function (str) {
      var out = [];
      var p = 0;
      for (var i = 0; i < str.length; i++) {
        var c = str.charCodeAt(i);
        if (c < 128) {
          out[p++] = c;
        } else if (c < 2048) {
          out[p++] = c >> 6 | 192;
          out[p++] = c & 63 | 128;
        } else if ((c & 0xfc00) == 0xd800 && i + 1 < str.length && (str.charCodeAt(i + 1) & 0xfc00) == 0xdc00) {
          // Surrogate Pair
          c = 0x10000 + ((c & 0x03ff) << 10) + (str.charCodeAt(++i) & 0x03ff);
          out[p++] = c >> 18 | 240;
          out[p++] = c >> 12 & 63 | 128;
          out[p++] = c >> 6 & 63 | 128;
          out[p++] = c & 63 | 128;
        } else {
          out[p++] = c >> 12 | 224;
          out[p++] = c >> 6 & 63 | 128;
          out[p++] = c & 63 | 128;
        }
      }
      return Uint8Array.from(out);
    };
    var C1_32 = -0x3361d2af;
    var C2_32 = 0x1b873593;
    var R1_32 = 15;
    var R2_32 = 13;
    var M_32 = 5;
    var N_32 = -0x19ab949c;
    var hash32x86 = function (input, seed) {
      if (seed === void 0) {
        seed = 0;
      }
      var data = stringToUtf8ByteArray(input);
      var length = data.length;
      var nBlocks = length >> 2;
      var hash = seed;
      // body
      for (var i = 0; i < nBlocks; i++) {
        var index_1 = i << 2;
        var k = readIntLe(data, index_1);
        hash = mix32(k, hash);
      }
      // tail
      var index = nBlocks << 2;
      var k1 = 0;
      switch (length - index) {
        case 3:
          k1 ^= data[index + 2] << 16;
          k1 ^= data[index + 1] << 8;
          k1 ^= data[index];
          k1 = Math.imul(k1, C1_32);
          k1 = rotateLeft(k1, R1_32);
          k1 = Math.imul(k1, C2_32);
          hash ^= k1;
          break;
        case 2:
          k1 ^= data[index + 1] << 8;
          k1 ^= data[index];
          k1 = Math.imul(k1, C1_32);
          k1 = rotateLeft(k1, R1_32);
          k1 = Math.imul(k1, C2_32);
          hash ^= k1;
          break;
        case 1:
          k1 ^= data[index];
          k1 = Math.imul(k1, C1_32);
          k1 = rotateLeft(k1, R1_32);
          k1 = Math.imul(k1, C2_32);
          hash ^= k1;
          break;
      }
      hash ^= length;
      return fmix32(hash) >>> 0;
    };
    var mix32 = function (k, hash) {
      var kResult = k;
      var hashResult = hash;
      kResult = Math.imul(kResult, C1_32);
      kResult = rotateLeft(kResult, R1_32);
      kResult = Math.imul(kResult, C2_32);
      hashResult ^= kResult;
      hashResult = rotateLeft(hashResult, R2_32);
      hashResult = Math.imul(hashResult, M_32);
      return hashResult + N_32 | 0;
    };
    var fmix32 = function (hash) {
      var hashResult = hash;
      hashResult ^= hashResult >>> 16;
      hashResult = Math.imul(hashResult, -0x7a143595);
      hashResult ^= hashResult >>> 13;
      hashResult = Math.imul(hashResult, -0x3d4d51cb);
      hashResult ^= hashResult >>> 16;
      return hashResult;
    };
    var rotateLeft = function (x, n, width) {
      if (width === void 0) {
        width = 32;
      }
      if (n > width) n = n % width;
      var mask = 0xffffffff << width - n >>> 0;
      var r = (x & mask) >>> 0 >>> width - n >>> 0;
      return (x << n | r) >>> 0;
    };
    var readIntLe = function (data, index) {
      if (index === void 0) {
        index = 0;
      }
      var n = data[index] << 24 | data[index + 1] << 16 | data[index + 2] << 8 | data[index + 3];
      return reverseBytes(n);
    };
    var reverseBytes = function (n) {
      return (n & -0x1000000) >>> 24 | (n & 0x00ff0000) >>> 8 | (n & 0x0000ff00) << 8 | (n & 0x000000ff) << 24;
    };
    var select = function (selectable, selector) {
      var e_1, _a;
      if (!selector || selector.length === 0) {
        return undefined;
      }
      try {
        for (var selector_1 = __values$1(selector), selector_1_1 = selector_1.next(); !selector_1_1.done; selector_1_1 = selector_1.next()) {
          var selectorElement = selector_1_1.value;
          if (!selectorElement || !selectable || typeof selectable !== 'object') {
            return undefined;
          }
          selectable = selectable[selectorElement];
        }
      } catch (e_1_1) {
        e_1 = {
          error: e_1_1
        };
      } finally {
        try {
          if (selector_1_1 && !selector_1_1.done && (_a = selector_1.return)) _a.call(selector_1);
        } finally {
          if (e_1) throw e_1.error;
        }
      }
      if (!selectable) {
        return undefined;
      } else {
        return selectable;
      }
    };

    // major and minor should be non-negative numbers separated by a dot
    var MAJOR_MINOR_REGEX = '(\\d+)\\.(\\d+)';
    // patch should be a non-negative number
    var PATCH_REGEX = '(\\d+)';
    // prerelease is optional. If provided, it should be a hyphen followed by a
    // series of dot separated identifiers where an identifer can contain anything in [-0-9a-zA-Z]
    var PRERELEASE_REGEX = '(-(([-\\w]+\\.?)*))?';
    // version pattern should be major.minor(.patchAndPreRelease) where .patchAndPreRelease is optional
    var VERSION_PATTERN = "^".concat(MAJOR_MINOR_REGEX, "(\\.").concat(PATCH_REGEX).concat(PRERELEASE_REGEX, ")?$");
    var SemanticVersion = /** @class */function () {
      function SemanticVersion(major, minor, patch, preRelease) {
        if (preRelease === void 0) {
          preRelease = undefined;
        }
        this.major = major;
        this.minor = minor;
        this.patch = patch;
        this.preRelease = preRelease;
      }
      SemanticVersion.parse = function (version) {
        if (!version) {
          return undefined;
        }
        var matchGroup = new RegExp(VERSION_PATTERN).exec(version);
        if (!matchGroup) {
          return undefined;
        }
        var major = Number(matchGroup[1]);
        var minor = Number(matchGroup[2]);
        if (isNaN(major) || isNaN(minor)) {
          return undefined;
        }
        var patch = Number(matchGroup[4]) || 0;
        var preRelease = matchGroup[5] || undefined;
        return new SemanticVersion(major, minor, patch, preRelease);
      };
      SemanticVersion.prototype.compareTo = function (other) {
        if (this.major > other.major) return 1;
        if (this.major < other.major) return -1;
        if (this.minor > other.minor) return 1;
        if (this.minor < other.minor) return -1;
        if (this.patch > other.patch) return 1;
        if (this.patch < other.patch) return -1;
        if (this.preRelease && !other.preRelease) return -1;
        if (!this.preRelease && other.preRelease) return 1;
        if (this.preRelease && other.preRelease) {
          if (this.preRelease > other.preRelease) return 1;
          if (this.preRelease < other.preRelease) return -1;
          return 0;
        }
        return 0;
      };
      return SemanticVersion;
    }();
    var EvaluationEngine = /** @class */function () {
      function EvaluationEngine() {}
      EvaluationEngine.prototype.evaluate = function (context, flags) {
        var e_1, _a;
        var results = {};
        var target = {
          context: context,
          result: results
        };
        try {
          for (var flags_1 = __values$1(flags), flags_1_1 = flags_1.next(); !flags_1_1.done; flags_1_1 = flags_1.next()) {
            var flag = flags_1_1.value;
            // Evaluate flag and update results.
            var variant = this.evaluateFlag(target, flag);
            if (variant) {
              results[flag.key] = variant;
            }
          }
        } catch (e_1_1) {
          e_1 = {
            error: e_1_1
          };
        } finally {
          try {
            if (flags_1_1 && !flags_1_1.done && (_a = flags_1.return)) _a.call(flags_1);
          } finally {
            if (e_1) throw e_1.error;
          }
        }
        return results;
      };
      EvaluationEngine.prototype.evaluateFlag = function (target, flag) {
        var e_2, _a;
        var result;
        try {
          for (var _b = __values$1(flag.segments), _c = _b.next(); !_c.done; _c = _b.next()) {
            var segment = _c.value;
            result = this.evaluateSegment(target, flag, segment);
            if (result) {
              // Merge all metadata into the result
              var metadata = __assign$1(__assign$1(__assign$1({}, flag.metadata), segment.metadata), result.metadata);
              result = __assign$1(__assign$1({}, result), {
                metadata: metadata
              });
              break;
            }
          }
        } catch (e_2_1) {
          e_2 = {
            error: e_2_1
          };
        } finally {
          try {
            if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
          } finally {
            if (e_2) throw e_2.error;
          }
        }
        return result;
      };
      EvaluationEngine.prototype.evaluateSegment = function (target, flag, segment) {
        var e_3, _a, e_4, _b;
        if (!segment.conditions) {
          // Null conditions always match
          var variantKey = this.bucket(target, segment);
          if (variantKey !== undefined) {
            return flag.variants[variantKey];
          } else {
            return undefined;
          }
        }
        try {
          // Outer list logic is "or" (||)
          for (var _c = __values$1(segment.conditions), _d = _c.next(); !_d.done; _d = _c.next()) {
            var conditions = _d.value;
            var match = true;
            try {
              for (var conditions_1 = (e_4 = void 0, __values$1(conditions)), conditions_1_1 = conditions_1.next(); !conditions_1_1.done; conditions_1_1 = conditions_1.next()) {
                var condition = conditions_1_1.value;
                match = this.matchCondition(target, condition);
                if (!match) {
                  break;
                }
              }
            } catch (e_4_1) {
              e_4 = {
                error: e_4_1
              };
            } finally {
              try {
                if (conditions_1_1 && !conditions_1_1.done && (_b = conditions_1.return)) _b.call(conditions_1);
              } finally {
                if (e_4) throw e_4.error;
              }
            }
            // On match, bucket the user.
            if (match) {
              var variantKey = this.bucket(target, segment);
              if (variantKey !== undefined) {
                return flag.variants[variantKey];
              } else {
                return undefined;
              }
            }
          }
        } catch (e_3_1) {
          e_3 = {
            error: e_3_1
          };
        } finally {
          try {
            if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
          } finally {
            if (e_3) throw e_3.error;
          }
        }
        return undefined;
      };
      EvaluationEngine.prototype.matchCondition = function (target, condition) {
        var propValue = select(target, condition.selector);
        // We need special matching for null properties and set type prop values
        // and operators. All other values are matched as strings, since the
        // filter values are always strings.
        if (!propValue) {
          return this.matchNull(condition.op, condition.values);
        } else if (this.isSetOperator(condition.op)) {
          var propValueStringList = this.coerceStringArray(propValue);
          if (!propValueStringList) {
            return false;
          }
          return this.matchSet(propValueStringList, condition.op, condition.values);
        } else {
          var propValueString = this.coerceString(propValue);
          if (propValueString !== undefined) {
            return this.matchString(propValueString, condition.op, condition.values);
          } else {
            return false;
          }
        }
      };
      EvaluationEngine.prototype.getHash = function (key) {
        return hash32x86(key);
      };
      EvaluationEngine.prototype.bucket = function (target, segment) {
        var e_5, _a, e_6, _b;
        if (!segment.bucket) {
          // A null bucket means the segment is fully rolled out. Select the
          // default variant.
          return segment.variant;
        }
        // Select the bucketing value.
        var bucketingValue = this.coerceString(select(target, segment.bucket.selector));
        if (!bucketingValue || bucketingValue.length === 0) {
          // A null or empty bucketing value cannot be bucketed. Select the
          // default variant.
          return segment.variant;
        }
        // Salt and has the value, and compute the allocation and distribution
        // values.
        var keyToHash = "".concat(segment.bucket.salt, "/").concat(bucketingValue);
        var hash = this.getHash(keyToHash);
        var allocationValue = hash % 100;
        var distributionValue = Math.floor(hash / 100);
        try {
          for (var _c = __values$1(segment.bucket.allocations), _d = _c.next(); !_d.done; _d = _c.next()) {
            var allocation = _d.value;
            var allocationStart = allocation.range[0];
            var allocationEnd = allocation.range[1];
            if (allocationValue >= allocationStart && allocationValue < allocationEnd) {
              try {
                for (var _e = (e_6 = void 0, __values$1(allocation.distributions)), _f = _e.next(); !_f.done; _f = _e.next()) {
                  var distribution = _f.value;
                  var distributionStart = distribution.range[0];
                  var distributionEnd = distribution.range[1];
                  if (distributionValue >= distributionStart && distributionValue < distributionEnd) {
                    return distribution.variant;
                  }
                }
              } catch (e_6_1) {
                e_6 = {
                  error: e_6_1
                };
              } finally {
                try {
                  if (_f && !_f.done && (_b = _e.return)) _b.call(_e);
                } finally {
                  if (e_6) throw e_6.error;
                }
              }
            }
          }
        } catch (e_5_1) {
          e_5 = {
            error: e_5_1
          };
        } finally {
          try {
            if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
          } finally {
            if (e_5) throw e_5.error;
          }
        }
        return segment.variant;
      };
      EvaluationEngine.prototype.matchNull = function (op, filterValues) {
        var containsNone = this.containsNone(filterValues);
        switch (op) {
          case EvaluationOperator.IS:
          case EvaluationOperator.CONTAINS:
          case EvaluationOperator.LESS_THAN:
          case EvaluationOperator.LESS_THAN_EQUALS:
          case EvaluationOperator.GREATER_THAN:
          case EvaluationOperator.GREATER_THAN_EQUALS:
          case EvaluationOperator.VERSION_LESS_THAN:
          case EvaluationOperator.VERSION_LESS_THAN_EQUALS:
          case EvaluationOperator.VERSION_GREATER_THAN:
          case EvaluationOperator.VERSION_GREATER_THAN_EQUALS:
          case EvaluationOperator.SET_IS:
          case EvaluationOperator.SET_CONTAINS:
          case EvaluationOperator.SET_CONTAINS_ANY:
            return containsNone;
          case EvaluationOperator.IS_NOT:
          case EvaluationOperator.DOES_NOT_CONTAIN:
          case EvaluationOperator.SET_DOES_NOT_CONTAIN:
          case EvaluationOperator.SET_DOES_NOT_CONTAIN_ANY:
            return !containsNone;
          default:
            return false;
        }
      };
      EvaluationEngine.prototype.matchSet = function (propValues, op, filterValues) {
        switch (op) {
          case EvaluationOperator.SET_IS:
            return this.setEquals(propValues, filterValues);
          case EvaluationOperator.SET_IS_NOT:
            return !this.setEquals(propValues, filterValues);
          case EvaluationOperator.SET_CONTAINS:
            return this.matchesSetContainsAll(propValues, filterValues);
          case EvaluationOperator.SET_DOES_NOT_CONTAIN:
            return !this.matchesSetContainsAll(propValues, filterValues);
          case EvaluationOperator.SET_CONTAINS_ANY:
            return this.matchesSetContainsAny(propValues, filterValues);
          case EvaluationOperator.SET_DOES_NOT_CONTAIN_ANY:
            return !this.matchesSetContainsAny(propValues, filterValues);
          default:
            return false;
        }
      };
      EvaluationEngine.prototype.matchString = function (propValue, op, filterValues) {
        var _this = this;
        switch (op) {
          case EvaluationOperator.IS:
            return this.matchesIs(propValue, filterValues);
          case EvaluationOperator.IS_NOT:
            return !this.matchesIs(propValue, filterValues);
          case EvaluationOperator.CONTAINS:
            return this.matchesContains(propValue, filterValues);
          case EvaluationOperator.DOES_NOT_CONTAIN:
            return !this.matchesContains(propValue, filterValues);
          case EvaluationOperator.LESS_THAN:
          case EvaluationOperator.LESS_THAN_EQUALS:
          case EvaluationOperator.GREATER_THAN:
          case EvaluationOperator.GREATER_THAN_EQUALS:
            return this.matchesComparable(propValue, op, filterValues, function (value) {
              return _this.parseNumber(value);
            }, this.comparator);
          case EvaluationOperator.VERSION_LESS_THAN:
          case EvaluationOperator.VERSION_LESS_THAN_EQUALS:
          case EvaluationOperator.VERSION_GREATER_THAN:
          case EvaluationOperator.VERSION_GREATER_THAN_EQUALS:
            return this.matchesComparable(propValue, op, filterValues, function (value) {
              return SemanticVersion.parse(value);
            }, this.versionComparator);
          case EvaluationOperator.REGEX_MATCH:
            return this.matchesRegex(propValue, filterValues);
          case EvaluationOperator.REGEX_DOES_NOT_MATCH:
            return !this.matchesRegex(propValue, filterValues);
          default:
            return false;
        }
      };
      EvaluationEngine.prototype.matchesIs = function (propValue, filterValues) {
        if (this.containsBooleans(filterValues)) {
          var lower_1 = propValue.toLowerCase();
          if (lower_1 === 'true' || lower_1 === 'false') {
            return filterValues.some(function (value) {
              return value.toLowerCase() === lower_1;
            });
          }
        }
        return filterValues.some(function (value) {
          return propValue === value;
        });
      };
      EvaluationEngine.prototype.matchesContains = function (propValue, filterValues) {
        var e_7, _a;
        try {
          for (var filterValues_1 = __values$1(filterValues), filterValues_1_1 = filterValues_1.next(); !filterValues_1_1.done; filterValues_1_1 = filterValues_1.next()) {
            var filterValue = filterValues_1_1.value;
            if (propValue.toLowerCase().includes(filterValue.toLowerCase())) {
              return true;
            }
          }
        } catch (e_7_1) {
          e_7 = {
            error: e_7_1
          };
        } finally {
          try {
            if (filterValues_1_1 && !filterValues_1_1.done && (_a = filterValues_1.return)) _a.call(filterValues_1);
          } finally {
            if (e_7) throw e_7.error;
          }
        }
        return false;
      };
      EvaluationEngine.prototype.matchesComparable = function (propValue, op, filterValues, typeTransformer, typeComparator) {
        var _this = this;
        var propValueTransformed = typeTransformer(propValue);
        var filterValuesTransformed = filterValues.map(function (filterValue) {
          return typeTransformer(filterValue);
        }).filter(function (filterValue) {
          return filterValue !== undefined;
        });
        if (propValueTransformed === undefined || filterValuesTransformed.length === 0) {
          return filterValues.some(function (filterValue) {
            return _this.comparator(propValue, op, filterValue);
          });
        } else {
          return filterValuesTransformed.some(function (filterValueTransformed) {
            return typeComparator(propValueTransformed, op, filterValueTransformed);
          });
        }
      };
      EvaluationEngine.prototype.comparator = function (propValue, op, filterValue) {
        switch (op) {
          case EvaluationOperator.LESS_THAN:
          case EvaluationOperator.VERSION_LESS_THAN:
            return propValue < filterValue;
          case EvaluationOperator.LESS_THAN_EQUALS:
          case EvaluationOperator.VERSION_LESS_THAN_EQUALS:
            return propValue <= filterValue;
          case EvaluationOperator.GREATER_THAN:
          case EvaluationOperator.VERSION_GREATER_THAN:
            return propValue > filterValue;
          case EvaluationOperator.GREATER_THAN_EQUALS:
          case EvaluationOperator.VERSION_GREATER_THAN_EQUALS:
            return propValue >= filterValue;
          default:
            return false;
        }
      };
      EvaluationEngine.prototype.versionComparator = function (propValue, op, filterValue) {
        var compareTo = propValue.compareTo(filterValue);
        switch (op) {
          case EvaluationOperator.LESS_THAN:
          case EvaluationOperator.VERSION_LESS_THAN:
            return compareTo < 0;
          case EvaluationOperator.LESS_THAN_EQUALS:
          case EvaluationOperator.VERSION_LESS_THAN_EQUALS:
            return compareTo <= 0;
          case EvaluationOperator.GREATER_THAN:
          case EvaluationOperator.VERSION_GREATER_THAN:
            return compareTo > 0;
          case EvaluationOperator.GREATER_THAN_EQUALS:
          case EvaluationOperator.VERSION_GREATER_THAN_EQUALS:
            return compareTo >= 0;
          default:
            return false;
        }
      };
      EvaluationEngine.prototype.matchesRegex = function (propValue, filterValues) {
        return filterValues.some(function (filterValue) {
          return Boolean(new RegExp(filterValue).exec(propValue));
        });
      };
      EvaluationEngine.prototype.containsNone = function (filterValues) {
        return filterValues.some(function (filterValue) {
          return filterValue === '(none)';
        });
      };
      EvaluationEngine.prototype.containsBooleans = function (filterValues) {
        return filterValues.some(function (filterValue) {
          switch (filterValue.toLowerCase()) {
            case 'true':
            case 'false':
              return true;
            default:
              return false;
          }
        });
      };
      EvaluationEngine.prototype.parseNumber = function (value) {
        var _a;
        return (_a = Number(value)) !== null && _a !== void 0 ? _a : undefined;
      };
      EvaluationEngine.prototype.coerceString = function (value) {
        if (!value) {
          return undefined;
        }
        if (typeof value === 'object') {
          return JSON.stringify(value);
        }
        return String(value);
      };
      EvaluationEngine.prototype.coerceStringArray = function (value) {
        var _this = this;
        if (Array.isArray(value)) {
          var anyArray = value;
          return anyArray.map(function (e) {
            return _this.coerceString(e);
          }).filter(Boolean);
        }
        var stringValue = String(value);
        try {
          var parsedValue = JSON.parse(stringValue);
          if (Array.isArray(parsedValue)) {
            var anyArray = value;
            return anyArray.map(function (e) {
              return _this.coerceString(e);
            }).filter(Boolean);
          } else {
            var s = this.coerceString(stringValue);
            return s ? [s] : undefined;
          }
        } catch (_a) {
          var s = this.coerceString(stringValue);
          return s ? [s] : undefined;
        }
      };
      EvaluationEngine.prototype.isSetOperator = function (op) {
        switch (op) {
          case EvaluationOperator.SET_IS:
          case EvaluationOperator.SET_IS_NOT:
          case EvaluationOperator.SET_CONTAINS:
          case EvaluationOperator.SET_DOES_NOT_CONTAIN:
          case EvaluationOperator.SET_CONTAINS_ANY:
          case EvaluationOperator.SET_DOES_NOT_CONTAIN_ANY:
            return true;
          default:
            return false;
        }
      };
      EvaluationEngine.prototype.setEquals = function (xa, ya) {
        var xs = new Set(xa);
        var ys = new Set(ya);
        return xs.size === ys.size && __spreadArray([], __read$1(ys), false).every(function (y) {
          return xs.has(y);
        });
      };
      EvaluationEngine.prototype.matchesSetContainsAll = function (propValues, filterValues) {
        var e_8, _a;
        if (propValues.length < filterValues.length) {
          return false;
        }
        try {
          for (var filterValues_2 = __values$1(filterValues), filterValues_2_1 = filterValues_2.next(); !filterValues_2_1.done; filterValues_2_1 = filterValues_2.next()) {
            var filterValue = filterValues_2_1.value;
            if (!this.matchesIs(filterValue, propValues)) {
              return false;
            }
          }
        } catch (e_8_1) {
          e_8 = {
            error: e_8_1
          };
        } finally {
          try {
            if (filterValues_2_1 && !filterValues_2_1.done && (_a = filterValues_2.return)) _a.call(filterValues_2);
          } finally {
            if (e_8) throw e_8.error;
          }
        }
        return true;
      };
      EvaluationEngine.prototype.matchesSetContainsAny = function (propValues, filterValues) {
        var e_9, _a;
        try {
          for (var filterValues_3 = __values$1(filterValues), filterValues_3_1 = filterValues_3.next(); !filterValues_3_1.done; filterValues_3_1 = filterValues_3.next()) {
            var filterValue = filterValues_3_1.value;
            if (this.matchesIs(filterValue, propValues)) {
              return true;
            }
          }
        } catch (e_9_1) {
          e_9 = {
            error: e_9_1
          };
        } finally {
          try {
            if (filterValues_3_1 && !filterValues_3_1.done && (_a = filterValues_3.return)) _a.call(filterValues_3);
          } finally {
            if (e_9) throw e_9.error;
          }
        }
        return false;
      };
      return EvaluationEngine;
    }();
    var topologicalSort = function (flags, flagKeys) {
      var e_1, _a;
      var available = __assign$1({}, flags);
      var result = [];
      var startingKeys = flagKeys || Object.keys(available);
      try {
        for (var startingKeys_1 = __values$1(startingKeys), startingKeys_1_1 = startingKeys_1.next(); !startingKeys_1_1.done; startingKeys_1_1 = startingKeys_1.next()) {
          var flagKey = startingKeys_1_1.value;
          var traversal = parentTraversal(flagKey, available);
          if (traversal) {
            result.push.apply(result, __spreadArray([], __read$1(traversal), false));
          }
        }
      } catch (e_1_1) {
        e_1 = {
          error: e_1_1
        };
      } finally {
        try {
          if (startingKeys_1_1 && !startingKeys_1_1.done && (_a = startingKeys_1.return)) _a.call(startingKeys_1);
        } finally {
          if (e_1) throw e_1.error;
        }
      }
      return result;
    };
    var parentTraversal = function (flagKey, available, path) {
      var e_2, _a;
      if (path === void 0) {
        path = [];
      }
      var flag = available[flagKey];
      if (!flag) {
        return undefined;
      } else if (!flag.dependencies || flag.dependencies.length === 0) {
        delete available[flag.key];
        return [flag];
      }
      path.push(flag.key);
      var result = [];
      var _loop_1 = function (parentKey) {
        if (path.some(function (p) {
          return p === parentKey;
        })) {
          throw Error("Detected a cycle between flags ".concat(path));
        }
        var traversal = parentTraversal(parentKey, available, path);
        if (traversal) {
          result.push.apply(result, __spreadArray([], __read$1(traversal), false));
        }
      };
      try {
        for (var _b = __values$1(flag.dependencies), _c = _b.next(); !_c.done; _c = _b.next()) {
          var parentKey = _c.value;
          _loop_1(parentKey);
        }
      } catch (e_2_1) {
        e_2 = {
          error: e_2_1
        };
      } finally {
        try {
          if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
        } finally {
          if (e_2) throw e_2.error;
        }
      }
      result.push(flag);
      path.pop();
      delete available[flag.key];
      return result;
    };

    /**
     *  base64.ts
     *
     *  Licensed under the BSD 3-Clause License.
     *    http://opensource.org/licenses/BSD-3-Clause
     *
     *  References:
     *    http://en.wikipedia.org/wiki/Base64
     *
     * @author Dan Kogai (https://github.com/dankogai)
     */
    const version$1 = '3.7.5';
    /**
     * @deprecated use lowercase `version`.
     */
    const VERSION = version$1;
    const _hasatob = typeof atob === 'function';
    const _hasbtoa = typeof btoa === 'function';
    const _hasBuffer = typeof Buffer === 'function';
    const _TD = typeof TextDecoder === 'function' ? new TextDecoder() : undefined;
    const _TE = typeof TextEncoder === 'function' ? new TextEncoder() : undefined;
    const b64ch = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    const b64chs = Array.prototype.slice.call(b64ch);
    const b64tab = (a => {
      let tab = {};
      a.forEach((c, i) => tab[c] = i);
      return tab;
    })(b64chs);
    const b64re = /^(?:[A-Za-z\d+\/]{4})*?(?:[A-Za-z\d+\/]{2}(?:==)?|[A-Za-z\d+\/]{3}=?)?$/;
    const _fromCC = String.fromCharCode.bind(String);
    const _U8Afrom = typeof Uint8Array.from === 'function' ? Uint8Array.from.bind(Uint8Array) : it => new Uint8Array(Array.prototype.slice.call(it, 0));
    const _mkUriSafe = src => src.replace(/=/g, '').replace(/[+\/]/g, m0 => m0 == '+' ? '-' : '_');
    const _tidyB64 = s => s.replace(/[^A-Za-z0-9\+\/]/g, '');
    /**
     * polyfill version of `btoa`
     */
    const btoaPolyfill = bin => {
      // console.log('polyfilled');
      let u32,
        c0,
        c1,
        c2,
        asc = '';
      const pad = bin.length % 3;
      for (let i = 0; i < bin.length;) {
        if ((c0 = bin.charCodeAt(i++)) > 255 || (c1 = bin.charCodeAt(i++)) > 255 || (c2 = bin.charCodeAt(i++)) > 255) throw new TypeError('invalid character found');
        u32 = c0 << 16 | c1 << 8 | c2;
        asc += b64chs[u32 >> 18 & 63] + b64chs[u32 >> 12 & 63] + b64chs[u32 >> 6 & 63] + b64chs[u32 & 63];
      }
      return pad ? asc.slice(0, pad - 3) + "===".substring(pad) : asc;
    };
    /**
     * does what `window.btoa` of web browsers do.
     * @param {String} bin binary string
     * @returns {string} Base64-encoded string
     */
    const _btoa = _hasbtoa ? bin => btoa(bin) : _hasBuffer ? bin => Buffer.from(bin, 'binary').toString('base64') : btoaPolyfill;
    const _fromUint8Array = _hasBuffer ? u8a => Buffer.from(u8a).toString('base64') : u8a => {
      // cf. https://stackoverflow.com/questions/12710001/how-to-convert-uint8-array-to-base64-encoded-string/12713326#12713326
      const maxargs = 0x1000;
      let strs = [];
      for (let i = 0, l = u8a.length; i < l; i += maxargs) {
        strs.push(_fromCC.apply(null, u8a.subarray(i, i + maxargs)));
      }
      return _btoa(strs.join(''));
    };
    /**
     * converts a Uint8Array to a Base64 string.
     * @param {boolean} [urlsafe] URL-and-filename-safe a la RFC4648 §5
     * @returns {string} Base64 string
     */
    const fromUint8Array = (u8a, urlsafe = false) => urlsafe ? _mkUriSafe(_fromUint8Array(u8a)) : _fromUint8Array(u8a);
    // This trick is found broken https://github.com/dankogai/js-base64/issues/130
    // const utob = (src: string) => unescape(encodeURIComponent(src));
    // reverting good old fationed regexp
    const cb_utob = c => {
      if (c.length < 2) {
        var cc = c.charCodeAt(0);
        return cc < 0x80 ? c : cc < 0x800 ? _fromCC(0xc0 | cc >>> 6) + _fromCC(0x80 | cc & 0x3f) : _fromCC(0xe0 | cc >>> 12 & 0x0f) + _fromCC(0x80 | cc >>> 6 & 0x3f) + _fromCC(0x80 | cc & 0x3f);
      } else {
        var cc = 0x10000 + (c.charCodeAt(0) - 0xD800) * 0x400 + (c.charCodeAt(1) - 0xDC00);
        return _fromCC(0xf0 | cc >>> 18 & 0x07) + _fromCC(0x80 | cc >>> 12 & 0x3f) + _fromCC(0x80 | cc >>> 6 & 0x3f) + _fromCC(0x80 | cc & 0x3f);
      }
    };
    const re_utob = /[\uD800-\uDBFF][\uDC00-\uDFFFF]|[^\x00-\x7F]/g;
    /**
     * @deprecated should have been internal use only.
     * @param {string} src UTF-8 string
     * @returns {string} UTF-16 string
     */
    const utob = u => u.replace(re_utob, cb_utob);
    //
    const _encode = _hasBuffer ? s => Buffer.from(s, 'utf8').toString('base64') : _TE ? s => _fromUint8Array(_TE.encode(s)) : s => _btoa(utob(s));
    /**
     * converts a UTF-8-encoded string to a Base64 string.
     * @param {boolean} [urlsafe] if `true` make the result URL-safe
     * @returns {string} Base64 string
     */
    const encode = (src, urlsafe = false) => urlsafe ? _mkUriSafe(_encode(src)) : _encode(src);
    /**
     * converts a UTF-8-encoded string to URL-safe Base64 RFC4648 §5.
     * @returns {string} Base64 string
     */
    const encodeURI = src => encode(src, true);
    // This trick is found broken https://github.com/dankogai/js-base64/issues/130
    // const btou = (src: string) => decodeURIComponent(escape(src));
    // reverting good old fationed regexp
    const re_btou = /[\xC0-\xDF][\x80-\xBF]|[\xE0-\xEF][\x80-\xBF]{2}|[\xF0-\xF7][\x80-\xBF]{3}/g;
    const cb_btou = cccc => {
      switch (cccc.length) {
        case 4:
          var cp = (0x07 & cccc.charCodeAt(0)) << 18 | (0x3f & cccc.charCodeAt(1)) << 12 | (0x3f & cccc.charCodeAt(2)) << 6 | 0x3f & cccc.charCodeAt(3),
            offset = cp - 0x10000;
          return _fromCC((offset >>> 10) + 0xD800) + _fromCC((offset & 0x3FF) + 0xDC00);
        case 3:
          return _fromCC((0x0f & cccc.charCodeAt(0)) << 12 | (0x3f & cccc.charCodeAt(1)) << 6 | 0x3f & cccc.charCodeAt(2));
        default:
          return _fromCC((0x1f & cccc.charCodeAt(0)) << 6 | 0x3f & cccc.charCodeAt(1));
      }
    };
    /**
     * @deprecated should have been internal use only.
     * @param {string} src UTF-16 string
     * @returns {string} UTF-8 string
     */
    const btou = b => b.replace(re_btou, cb_btou);
    /**
     * polyfill version of `atob`
     */
    const atobPolyfill = asc => {
      // console.log('polyfilled');
      asc = asc.replace(/\s+/g, '');
      if (!b64re.test(asc)) throw new TypeError('malformed base64.');
      asc += '=='.slice(2 - (asc.length & 3));
      let u24,
        bin = '',
        r1,
        r2;
      for (let i = 0; i < asc.length;) {
        u24 = b64tab[asc.charAt(i++)] << 18 | b64tab[asc.charAt(i++)] << 12 | (r1 = b64tab[asc.charAt(i++)]) << 6 | (r2 = b64tab[asc.charAt(i++)]);
        bin += r1 === 64 ? _fromCC(u24 >> 16 & 255) : r2 === 64 ? _fromCC(u24 >> 16 & 255, u24 >> 8 & 255) : _fromCC(u24 >> 16 & 255, u24 >> 8 & 255, u24 & 255);
      }
      return bin;
    };
    /**
     * does what `window.atob` of web browsers do.
     * @param {String} asc Base64-encoded string
     * @returns {string} binary string
     */
    const _atob = _hasatob ? asc => atob(_tidyB64(asc)) : _hasBuffer ? asc => Buffer.from(asc, 'base64').toString('binary') : atobPolyfill;
    //
    const _toUint8Array = _hasBuffer ? a => _U8Afrom(Buffer.from(a, 'base64')) : a => _U8Afrom(_atob(a).split('').map(c => c.charCodeAt(0)));
    /**
     * converts a Base64 string to a Uint8Array.
     */
    const toUint8Array = a => _toUint8Array(_unURI(a));
    //
    const _decode = _hasBuffer ? a => Buffer.from(a, 'base64').toString('utf8') : _TD ? a => _TD.decode(_toUint8Array(a)) : a => btou(_atob(a));
    const _unURI = a => _tidyB64(a.replace(/[-_]/g, m0 => m0 == '-' ? '+' : '/'));
    /**
     * converts a Base64 string to a UTF-8 string.
     * @param {String} src Base64 string.  Both normal and URL-safe are supported
     * @returns {string} UTF-8 string
     */
    const decode = src => _decode(_unURI(src));
    /**
     * check if a value is a valid Base64 string
     * @param {String} src a value to check
      */
    const isValid = src => {
      if (typeof src !== 'string') return false;
      const s = src.replace(/\s+/g, '').replace(/={0,2}$/, '');
      return !/[^\s0-9a-zA-Z\+/]/.test(s) || !/[^\s0-9a-zA-Z\-_]/.test(s);
    };
    //
    const _noEnum = v => {
      return {
        value: v,
        enumerable: false,
        writable: true,
        configurable: true
      };
    };
    /**
     * extend String.prototype with relevant methods
     */
    const extendString = function () {
      const _add = (name, body) => Object.defineProperty(String.prototype, name, _noEnum(body));
      _add('fromBase64', function () {
        return decode(this);
      });
      _add('toBase64', function (urlsafe) {
        return encode(this, urlsafe);
      });
      _add('toBase64URI', function () {
        return encode(this, true);
      });
      _add('toBase64URL', function () {
        return encode(this, true);
      });
      _add('toUint8Array', function () {
        return toUint8Array(this);
      });
    };
    /**
     * extend Uint8Array.prototype with relevant methods
     */
    const extendUint8Array = function () {
      const _add = (name, body) => Object.defineProperty(Uint8Array.prototype, name, _noEnum(body));
      _add('toBase64', function (urlsafe) {
        return fromUint8Array(this, urlsafe);
      });
      _add('toBase64URI', function () {
        return fromUint8Array(this, true);
      });
      _add('toBase64URL', function () {
        return fromUint8Array(this, true);
      });
    };
    /**
     * extend Builtin prototypes with relevant methods
     */
    const extendBuiltins = () => {
      extendString();
      extendUint8Array();
    };
    const gBase64 = {
      version: version$1,
      VERSION: VERSION,
      atob: _atob,
      atobPolyfill: atobPolyfill,
      btoa: _btoa,
      btoaPolyfill: btoaPolyfill,
      fromBase64: decode,
      toBase64: encode,
      encode: encode,
      encodeURI: encodeURI,
      encodeURL: encodeURI,
      utob: utob,
      btou: btou,
      decode: decode,
      isValid: isValid,
      fromUint8Array: fromUint8Array,
      toUint8Array: toUint8Array,
      extendString: extendString,
      extendUint8Array: extendUint8Array,
      extendBuiltins: extendBuiltins
    };
    var FetchError = /** @class */function (_super) {
      __extends(FetchError, _super);
      function FetchError(statusCode, message) {
        var _this = _super.call(this, message) || this;
        _this.statusCode = statusCode;
        Object.setPrototypeOf(_this, FetchError.prototype);
        return _this;
      }
      return FetchError;
    }(Error);
    var SdkEvaluationApi = /** @class */function () {
      function SdkEvaluationApi(deploymentKey, serverUrl, httpClient) {
        this.deploymentKey = deploymentKey;
        this.serverUrl = serverUrl;
        this.httpClient = httpClient;
      }
      SdkEvaluationApi.prototype.getVariants = function (user, options) {
        return __awaiter(this, void 0, void 0, function () {
          var userJsonBase64, headers, url, response;
          return __generator(this, function (_a) {
            switch (_a.label) {
              case 0:
                userJsonBase64 = gBase64.encodeURL(JSON.stringify(user));
                headers = {
                  Authorization: "Api-Key ".concat(this.deploymentKey),
                  'X-Amp-Exp-User': userJsonBase64
                };
                if (options === null || options === void 0 ? void 0 : options.flagKeys) {
                  headers['X-Amp-Exp-Flag-Keys'] = gBase64.encodeURL(JSON.stringify(options.flagKeys));
                }
                if (options === null || options === void 0 ? void 0 : options.trackingOption) {
                  headers['X-Amp-Exp-Track'] = options.trackingOption;
                }
                url = new URL("".concat(this.serverUrl, "/sdk/v2/vardata?v=0"));
                if (options === null || options === void 0 ? void 0 : options.evaluationMode) {
                  url.searchParams.append('eval_mode', options === null || options === void 0 ? void 0 : options.evaluationMode);
                }
                if (options === null || options === void 0 ? void 0 : options.deliveryMethod) {
                  url.searchParams.append('delivery_method', options === null || options === void 0 ? void 0 : options.deliveryMethod);
                }
                return [4 /*yield*/, this.httpClient.request({
                  requestUrl: url.toString(),
                  method: 'GET',
                  headers: headers,
                  timeoutMillis: options === null || options === void 0 ? void 0 : options.timeoutMillis
                })];
              case 1:
                response = _a.sent();
                if (response.status != 200) {
                  throw new FetchError(response.status, "Fetch error response: status=".concat(response.status));
                }
                return [2 /*return*/, JSON.parse(response.body)];
            }
          });
        });
      };
      return SdkEvaluationApi;
    }();
    var SdkFlagApi = /** @class */function () {
      function SdkFlagApi(deploymentKey, serverUrl, httpClient) {
        this.deploymentKey = deploymentKey;
        this.serverUrl = serverUrl;
        this.httpClient = httpClient;
      }
      SdkFlagApi.prototype.getFlags = function (options) {
        return __awaiter(this, void 0, void 0, function () {
          var headers, response, flagsArray;
          return __generator(this, function (_a) {
            switch (_a.label) {
              case 0:
                headers = {
                  Authorization: "Api-Key ".concat(this.deploymentKey)
                };
                if ((options === null || options === void 0 ? void 0 : options.libraryName) && (options === null || options === void 0 ? void 0 : options.libraryVersion)) {
                  headers['X-Amp-Exp-Library'] = "".concat(options.libraryName, "/").concat(options.libraryVersion);
                }
                return [4 /*yield*/, this.httpClient.request({
                  requestUrl: "".concat(this.serverUrl, "/sdk/v2/flags"),
                  method: 'GET',
                  headers: headers,
                  timeoutMillis: options === null || options === void 0 ? void 0 : options.timeoutMillis
                })];
              case 1:
                response = _a.sent();
                if (response.status != 200) {
                  throw Error("Flags error response: status=".concat(response.status));
                }
                flagsArray = JSON.parse(response.body);
                return [2 /*return*/, flagsArray.reduce(function (map, flag) {
                  map[flag.key] = flag;
                  return map;
                }, {})];
            }
          });
        });
      };
      return SdkFlagApi;
    }();
    var safeGlobal$1 = typeof globalThis !== 'undefined' ? globalThis : global || self;
    var getGlobalScope = function () {
      if (typeof globalThis !== 'undefined') {
        return globalThis;
      }
      if (typeof window !== 'undefined') {
        return window;
      }
      if (typeof self !== 'undefined') {
        return self;
      }
      if (typeof global !== 'undefined') {
        return global;
      }
      return undefined;
    };
    var isLocalStorageAvailable = function () {
      var globalScope = getGlobalScope();
      if (globalScope) {
        try {
          var testKey = 'EXP_test';
          globalScope.localStorage.setItem(testKey, testKey);
          globalScope.localStorage.removeItem(testKey);
          return true;
        } catch (e) {
          return false;
        }
      }
      return false;
    };
    var Poller = /** @class */function () {
      function Poller(action, ms) {
        this.poller = undefined;
        this.action = action;
        this.ms = ms;
      }
      Poller.prototype.start = function () {
        if (this.poller) {
          return;
        }
        this.poller = safeGlobal$1.setInterval(this.action, this.ms);
        void this.action();
      };
      Poller.prototype.stop = function () {
        if (!this.poller) {
          return;
        }
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        safeGlobal$1.clearInterval(this.poller);
        this.poller = undefined;
      };
      return Poller;
    }();

    var parseAmplitudeCookie = function (apiKey, newFormat) {
        var e_1, _a;
        if (newFormat === void 0) { newFormat = false; }
        // Get the cookie value
        var key = generateKey(apiKey, newFormat);
        var value = undefined;
        var cookies = safeGlobal$1.document.cookie.split('; ');
        try {
            for (var cookies_1 = __values$2(cookies), cookies_1_1 = cookies_1.next(); !cookies_1_1.done; cookies_1_1 = cookies_1.next()) {
                var cookie = cookies_1_1.value;
                var _b = __read$2(cookie.split('='), 2), cookieKey = _b[0], cookieValue = _b[1];
                if (cookieKey === key) {
                    value = decodeURIComponent(cookieValue);
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (cookies_1_1 && !cookies_1_1.done && (_a = cookies_1.return)) _a.call(cookies_1);
            }
            finally { if (e_1) throw e_1.error; }
        }
        if (!value) {
            return;
        }
        // Parse cookie value depending on format
        try {
            // New format
            if (newFormat) {
                var decoding = Buffer.from(value, 'base64').toString('utf-8');
                return JSON.parse(decodeURIComponent(decoding));
            }
            // Old format
            var values = value.split('.');
            var userId = undefined;
            if (values.length >= 2 && values[1]) {
                userId = Buffer.from(values[1], 'base64').toString('utf-8');
            }
            return {
                deviceId: values[0],
                userId: userId,
            };
        }
        catch (e) {
            return;
        }
    };
    var parseAmplitudeLocalStorage = function (apiKey) {
        var key = generateKey(apiKey, true);
        try {
            var value = safeGlobal$1.localStorage.getItem(key);
            if (!value)
                return;
            var state = JSON.parse(value);
            if (typeof state !== 'object')
                return;
            return state;
        }
        catch (_a) {
            return;
        }
    };
    var parseAmplitudeSessionStorage = function (apiKey) {
        var key = generateKey(apiKey, true);
        try {
            var value = safeGlobal$1.sessionStorage.getItem(key);
            if (!value)
                return;
            var state = JSON.parse(value);
            if (typeof state !== 'object')
                return;
            return state;
        }
        catch (_a) {
            return;
        }
    };
    var generateKey = function (apiKey, newFormat) {
        if (newFormat) {
            if ((apiKey === null || apiKey === void 0 ? void 0 : apiKey.length) < 10) {
                return;
            }
            return "AMP_".concat(apiKey.substring(0, 10));
        }
        if ((apiKey === null || apiKey === void 0 ? void 0 : apiKey.length) < 6) {
            return;
        }
        return "amp_".concat(apiKey.substring(0, 6));
    };

    /**
     * Integration plugin for Amplitude Analytics. Uses the analytics connector to
     * track events and get user identity.
     *
     * On initialization, this plugin attempts to read the user identity from all
     * the storage locations and formats supported by the analytics SDK, then
     * commits the identity to the connector. The order of locations checks are:
     *  - Cookie
     *  - Cookie (Legacy)
     *  - Local Storage
     *  - Session Storage
     *
     * Events are tracked only if the connector has an event receiver set, otherwise
     * track returns false, and events are persisted and managed by the
     * IntegrationManager.
     */
    var AmplitudeIntegrationPlugin = /** @class */ (function () {
        function AmplitudeIntegrationPlugin(apiKey, connector, timeoutMillis) {
            this.apiKey = apiKey;
            this.identityStore = connector.identityStore;
            this.eventBridge = connector.eventBridge;
            this.contextProvider = connector.applicationContextProvider;
            this.timeoutMillis = timeoutMillis;
            this.loadPersistedState();
            if (timeoutMillis <= 0) {
                this.setup = undefined;
            }
        }
        AmplitudeIntegrationPlugin.prototype.setup = function (config, client) {
            return __awaiter$1(this, void 0, void 0, function () {
                return __generator$1(this, function (_a) {
                    // Setup automatic fetch on amplitude identity change.
                    if (config === null || config === void 0 ? void 0 : config.automaticFetchOnAmplitudeIdentityChange) {
                        this.identityStore.addIdentityListener(function () {
                            client === null || client === void 0 ? void 0 : client.fetch();
                        });
                    }
                    return [2 /*return*/, this.waitForConnectorIdentity(this.timeoutMillis)];
                });
            });
        };
        AmplitudeIntegrationPlugin.prototype.getUser = function () {
            var identity = this.identityStore.getIdentity();
            return {
                user_id: identity.userId,
                device_id: identity.deviceId,
                user_properties: identity.userProperties,
                version: this.contextProvider.versionName,
            };
        };
        AmplitudeIntegrationPlugin.prototype.track = function (event) {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            if (!this.eventBridge.receiver) {
                return false;
            }
            this.eventBridge.logEvent({
                eventType: event.eventType,
                eventProperties: event.eventProperties,
            });
            return true;
        };
        AmplitudeIntegrationPlugin.prototype.loadPersistedState = function () {
            // Avoid reading state if the api key is undefined or an experiment
            // deployment.
            if (!this.apiKey || this.apiKey.startsWith('client-')) {
                return false;
            }
            // New cookie format
            var user = parseAmplitudeCookie(this.apiKey, true);
            if (user) {
                this.commitIdentityToConnector(user);
                return true;
            }
            // Old cookie format
            user = parseAmplitudeCookie(this.apiKey, false);
            if (user) {
                this.commitIdentityToConnector(user);
                return true;
            }
            // Local storage
            user = parseAmplitudeLocalStorage(this.apiKey);
            if (user) {
                this.commitIdentityToConnector(user);
                return true;
            }
            // Session storage
            user = parseAmplitudeSessionStorage(this.apiKey);
            if (user) {
                this.commitIdentityToConnector(user);
                return true;
            }
            return false;
        };
        AmplitudeIntegrationPlugin.prototype.commitIdentityToConnector = function (user) {
            var editor = this.identityStore.editIdentity();
            editor.setDeviceId(user.deviceId);
            if (user.userId) {
                editor.setUserId(user.userId);
            }
            editor.commit();
        };
        AmplitudeIntegrationPlugin.prototype.waitForConnectorIdentity = function (ms) {
            return __awaiter$1(this, void 0, void 0, function () {
                var identity;
                var _this = this;
                return __generator$1(this, function (_a) {
                    identity = this.identityStore.getIdentity();
                    if (!identity.userId && !identity.deviceId) {
                        return [2 /*return*/, Promise.race([
                                new Promise(function (resolve) {
                                    var listener = function () {
                                        resolve();
                                        _this.identityStore.removeIdentityListener(listener);
                                    };
                                    _this.identityStore.addIdentityListener(listener);
                                }),
                                new Promise(function (_, reject) {
                                    safeGlobal$1.setTimeout(reject, ms, 'Timed out waiting for Amplitude Analytics SDK to initialize.');
                                }),
                            ])];
                    }
                    return [2 /*return*/];
                });
            });
        };
        return AmplitudeIntegrationPlugin;
    }());

    var ApplicationContextProviderImpl = /** @class */function () {
      function ApplicationContextProviderImpl() {}
      ApplicationContextProviderImpl.prototype.getApplicationContext = function () {
        return {
          versionName: this.versionName,
          language: getLanguage(),
          platform: 'Web',
          os: undefined,
          deviceModel: undefined
        };
      };
      return ApplicationContextProviderImpl;
    }();
    var getLanguage = function () {
      return typeof navigator !== 'undefined' && (navigator.languages && navigator.languages[0] || navigator.language) || '';
    };
    var EventBridgeImpl = /** @class */function () {
      function EventBridgeImpl() {
        this.queue = [];
      }
      EventBridgeImpl.prototype.logEvent = function (event) {
        if (!this.receiver) {
          if (this.queue.length < 512) {
            this.queue.push(event);
          }
        } else {
          this.receiver(event);
        }
      };
      EventBridgeImpl.prototype.setEventReceiver = function (receiver) {
        this.receiver = receiver;
        if (this.queue.length > 0) {
          this.queue.forEach(function (event) {
            receiver(event);
          });
          this.queue = [];
        }
      };
      return EventBridgeImpl;
    }();

    /******************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */
    var __assign = function () {
      __assign = Object.assign || function __assign(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
          s = arguments[i];
          for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
        }
        return t;
      };
      return __assign.apply(this, arguments);
    };
    function __values(o) {
      var s = typeof Symbol === "function" && Symbol.iterator,
        m = s && o[s],
        i = 0;
      if (m) return m.call(o);
      if (o && typeof o.length === "number") return {
        next: function () {
          if (o && i >= o.length) o = void 0;
          return {
            value: o && o[i++],
            done: !o
          };
        }
      };
      throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
    }
    function __read(o, n) {
      var m = typeof Symbol === "function" && o[Symbol.iterator];
      if (!m) return o;
      var i = m.call(o),
        r,
        ar = [],
        e;
      try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
      } catch (error) {
        e = {
          error: error
        };
      } finally {
        try {
          if (r && !r.done && (m = i["return"])) m.call(i);
        } finally {
          if (e) throw e.error;
        }
      }
      return ar;
    }
    typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
      var e = new Error(message);
      return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    var isEqual = function (obj1, obj2) {
      var e_1, _a;
      var primitive = ['string', 'number', 'boolean', 'undefined'];
      var typeA = typeof obj1;
      var typeB = typeof obj2;
      if (typeA !== typeB) {
        return false;
      }
      try {
        for (var primitive_1 = __values(primitive), primitive_1_1 = primitive_1.next(); !primitive_1_1.done; primitive_1_1 = primitive_1.next()) {
          var p = primitive_1_1.value;
          if (p === typeA) {
            return obj1 === obj2;
          }
        }
      } catch (e_1_1) {
        e_1 = {
          error: e_1_1
        };
      } finally {
        try {
          if (primitive_1_1 && !primitive_1_1.done && (_a = primitive_1.return)) _a.call(primitive_1);
        } finally {
          if (e_1) throw e_1.error;
        }
      }
      // check null
      if (obj1 == null && obj2 == null) {
        return true;
      } else if (obj1 == null || obj2 == null) {
        return false;
      }
      // if got here - objects
      if (obj1.length !== obj2.length) {
        return false;
      }
      //check if arrays
      var isArrayA = Array.isArray(obj1);
      var isArrayB = Array.isArray(obj2);
      if (isArrayA !== isArrayB) {
        return false;
      }
      if (isArrayA && isArrayB) {
        //arrays
        for (var i = 0; i < obj1.length; i++) {
          if (!isEqual(obj1[i], obj2[i])) {
            return false;
          }
        }
      } else {
        //objects
        var sorted1 = Object.keys(obj1).sort();
        var sorted2 = Object.keys(obj2).sort();
        if (!isEqual(sorted1, sorted2)) {
          return false;
        }
        //compare object values
        var result_1 = true;
        Object.keys(obj1).forEach(function (key) {
          if (!isEqual(obj1[key], obj2[key])) {
            result_1 = false;
          }
        });
        return result_1;
      }
      return true;
    };
    var ID_OP_SET = '$set';
    var ID_OP_UNSET = '$unset';
    var ID_OP_CLEAR_ALL = '$clearAll';
    // Polyfill for Object.entries
    if (!Object.entries) {
      Object.entries = function (obj) {
        var ownProps = Object.keys(obj);
        var i = ownProps.length;
        var resArray = new Array(i);
        while (i--) {
          resArray[i] = [ownProps[i], obj[ownProps[i]]];
        }
        return resArray;
      };
    }
    var IdentityStoreImpl = /** @class */function () {
      function IdentityStoreImpl() {
        this.identity = {
          userProperties: {}
        };
        this.listeners = new Set();
      }
      IdentityStoreImpl.prototype.editIdentity = function () {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        var self = this;
        var actingUserProperties = __assign({}, this.identity.userProperties);
        var actingIdentity = __assign(__assign({}, this.identity), {
          userProperties: actingUserProperties
        });
        return {
          setUserId: function (userId) {
            actingIdentity.userId = userId;
            return this;
          },
          setDeviceId: function (deviceId) {
            actingIdentity.deviceId = deviceId;
            return this;
          },
          setUserProperties: function (userProperties) {
            actingIdentity.userProperties = userProperties;
            return this;
          },
          setOptOut: function (optOut) {
            actingIdentity.optOut = optOut;
            return this;
          },
          updateUserProperties: function (actions) {
            var e_1, _a, e_2, _b, e_3, _c;
            var actingProperties = actingIdentity.userProperties || {};
            try {
              for (var _d = __values(Object.entries(actions)), _e = _d.next(); !_e.done; _e = _d.next()) {
                var _f = __read(_e.value, 2),
                  action = _f[0],
                  properties = _f[1];
                switch (action) {
                  case ID_OP_SET:
                    try {
                      for (var _g = (e_2 = void 0, __values(Object.entries(properties))), _h = _g.next(); !_h.done; _h = _g.next()) {
                        var _j = __read(_h.value, 2),
                          key = _j[0],
                          value = _j[1];
                        actingProperties[key] = value;
                      }
                    } catch (e_2_1) {
                      e_2 = {
                        error: e_2_1
                      };
                    } finally {
                      try {
                        if (_h && !_h.done && (_b = _g.return)) _b.call(_g);
                      } finally {
                        if (e_2) throw e_2.error;
                      }
                    }
                    break;
                  case ID_OP_UNSET:
                    try {
                      for (var _k = (e_3 = void 0, __values(Object.keys(properties))), _l = _k.next(); !_l.done; _l = _k.next()) {
                        var key = _l.value;
                        delete actingProperties[key];
                      }
                    } catch (e_3_1) {
                      e_3 = {
                        error: e_3_1
                      };
                    } finally {
                      try {
                        if (_l && !_l.done && (_c = _k.return)) _c.call(_k);
                      } finally {
                        if (e_3) throw e_3.error;
                      }
                    }
                    break;
                  case ID_OP_CLEAR_ALL:
                    actingProperties = {};
                    break;
                }
              }
            } catch (e_1_1) {
              e_1 = {
                error: e_1_1
              };
            } finally {
              try {
                if (_e && !_e.done && (_a = _d.return)) _a.call(_d);
              } finally {
                if (e_1) throw e_1.error;
              }
            }
            actingIdentity.userProperties = actingProperties;
            return this;
          },
          commit: function () {
            self.setIdentity(actingIdentity);
            return this;
          }
        };
      };
      IdentityStoreImpl.prototype.getIdentity = function () {
        return __assign({}, this.identity);
      };
      IdentityStoreImpl.prototype.setIdentity = function (identity) {
        var originalIdentity = __assign({}, this.identity);
        this.identity = __assign({}, identity);
        if (!isEqual(originalIdentity, this.identity)) {
          this.listeners.forEach(function (listener) {
            listener(identity);
          });
        }
      };
      IdentityStoreImpl.prototype.addIdentityListener = function (listener) {
        this.listeners.add(listener);
      };
      IdentityStoreImpl.prototype.removeIdentityListener = function (listener) {
        this.listeners.delete(listener);
      };
      return IdentityStoreImpl;
    }();
    var safeGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof global !== 'undefined' ? global : self;
    var AnalyticsConnector = /** @class */function () {
      function AnalyticsConnector() {
        this.identityStore = new IdentityStoreImpl();
        this.eventBridge = new EventBridgeImpl();
        this.applicationContextProvider = new ApplicationContextProviderImpl();
      }
      AnalyticsConnector.getInstance = function (instanceName) {
        if (!safeGlobal['analyticsConnectorInstances']) {
          safeGlobal['analyticsConnectorInstances'] = {};
        }
        if (!safeGlobal['analyticsConnectorInstances'][instanceName]) {
          safeGlobal['analyticsConnectorInstances'][instanceName] = new AnalyticsConnector();
        }
        return safeGlobal['analyticsConnectorInstances'][instanceName];
      };
      return AnalyticsConnector;
    }();

    function unfetch (e, n) {
      return n = n || {}, new Promise(function (t, r) {
        var s = new XMLHttpRequest(),
          o = [],
          u = [],
          i = {},
          a = function () {
            return {
              ok: 2 == (s.status / 100 | 0),
              statusText: s.statusText,
              status: s.status,
              url: s.responseURL,
              text: function () {
                return Promise.resolve(s.responseText);
              },
              json: function () {
                return Promise.resolve(JSON.parse(s.responseText));
              },
              blob: function () {
                return Promise.resolve(new Blob([s.response]));
              },
              clone: a,
              headers: {
                keys: function () {
                  return o;
                },
                entries: function () {
                  return u;
                },
                get: function (e) {
                  return i[e.toLowerCase()];
                },
                has: function (e) {
                  return e.toLowerCase() in i;
                }
              }
            };
          };
        for (var l in s.open(n.method || "get", e, !0), s.onload = function () {
          s.getAllResponseHeaders().replace(/^(.*?):[^\S\n]*([\s\S]*?)$/gm, function (e, n, t) {
            o.push(n = n.toLowerCase()), u.push([n, t]), i[n] = i[n] ? i[n] + "," + t : t;
          }), t(a());
        }, s.onerror = r, s.withCredentials = "include" == n.credentials, n.headers) s.setRequestHeader(l, n.headers[l]);
        s.send(n.body || null);
      });
    }

    /**
     * @packageDocumentation
     * @internal
     */
    var fetch = safeGlobal$1.fetch || unfetch;
    /*
     * Copied from:
     * https://github.com/github/fetch/issues/175#issuecomment-284787564
     */
    var timeout = function (promise, timeoutMillis) {
        // Don't timeout if timeout is null or invalid
        if (timeoutMillis == null || timeoutMillis <= 0) {
            return promise;
        }
        return new Promise(function (resolve, reject) {
            safeGlobal$1.setTimeout(function () {
                reject(Error('Request timeout after ' + timeoutMillis + ' milliseconds'));
            }, timeoutMillis);
            promise.then(resolve, reject);
        });
    };
    var _request = function (requestUrl, method, headers, data, timeoutMillis) {
        var call = function () { return __awaiter$1(void 0, void 0, void 0, function () {
            var response, simpleResponse;
            var _a;
            return __generator$1(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, fetch(requestUrl, {
                            method: method,
                            headers: headers,
                            body: data,
                        })];
                    case 1:
                        response = _b.sent();
                        _a = {
                            status: response.status
                        };
                        return [4 /*yield*/, response.text()];
                    case 2:
                        simpleResponse = (_a.body = _b.sent(),
                            _a);
                        return [2 /*return*/, simpleResponse];
                }
            });
        }); };
        return timeout(call(), timeoutMillis);
    };
    /**
     * Wrap the exposed HttpClient in a CoreClient implementation to work with
     * FlagsApi and EvaluationApi.
     */
    var WrapperClient = /** @class */ (function () {
        function WrapperClient(client) {
            this.client = client;
        }
        WrapperClient.prototype.request = function (request) {
            return __awaiter$1(this, void 0, void 0, function () {
                return __generator$1(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.client.request(request.requestUrl, request.method, request.headers, null, request.timeoutMillis)];
                        case 1: return [2 /*return*/, _a.sent()];
                    }
                });
            });
        };
        return WrapperClient;
    }());
    var FetchHttpClient = { request: _request };

    /**
     * Determines the primary source of variants before falling back.
     *
     * @category Source
     */
    exports.Source = void 0;
    (function (Source) {
        /**
         * The default way to source variants within your application. Before the
         * assignments are fetched, `getVariant(s)` will fallback to local storage
         * first, then `initialVariants` if local storage is empty. This option
         * effectively falls back to an assignment fetched previously.
         */
        Source["LocalStorage"] = "localStorage";
        /**
         * This bootstrap option is used primarily for servers-side rendering using an
         * Experiment server SDK. This bootstrap option always prefers the config
         * `initialVariants` over data in local storage, even if variants are fetched
         * successfully and stored locally.
         */
        Source["InitialVariants"] = "initialVariants";
    })(exports.Source || (exports.Source = {}));
    /**
     * Indicates from which source the variant() function determines the variant
     *
     * @category Source
     */
    var VariantSource;
    (function (VariantSource) {
        VariantSource["LocalStorage"] = "storage";
        VariantSource["InitialVariants"] = "initial";
        VariantSource["SecondaryLocalStorage"] = "secondary-storage";
        VariantSource["SecondaryInitialVariants"] = "secondary-initial";
        VariantSource["FallbackInline"] = "fallback-inline";
        VariantSource["FallbackConfig"] = "fallback-config";
        VariantSource["LocalEvaluation"] = "local-evaluation";
    })(VariantSource || (VariantSource = {}));
    /**
     * Returns true if the VariantSource is one of the fallbacks (inline or config)
     *
     * @param source a {@link VariantSource}
     * @returns true if source is {@link VariantSource.FallbackInline} or {@link VariantSource.FallbackConfig}
     */
    var isFallback = function (source) {
        return (!source ||
            source === VariantSource.FallbackInline ||
            source === VariantSource.FallbackConfig ||
            source === VariantSource.SecondaryInitialVariants);
    };

    /**
     Defaults for Experiment Config options

     | **Option**       | **Default**                       |
     |------------------|-----------------------------------|
     | **debug**        | `false`                           |
     | **instanceName** | `$default_instance` |
     | **fallbackVariant**         | `null`                 |
     | **initialVariants**         | `null`                 |
     | **initialFlags**         | `undefined`                 |
     | **source** | `Source.LocalStorage` |
     | **serverUrl**    | `"https://api.lab.amplitude.com"` |
     | **flagsServerUrl**    | `"https://flag.lab.amplitude.com"` |
     | **serverZone**    | `"US"` |
     | **assignmentTimeoutMillis**    | `10000` |
     | **retryFailedAssignment**    | `true` |
     | **automaticExposureTracking** | `true` |
     | **pollOnStart** | `true` |
     | **fetchOnStart** | `true` |
     | **automaticFetchOnAmplitudeIdentityChange** | `false` |
     | **userProvider**    | `null` |
     | **analyticsProvider**    | `null` |
     | **exposureTrackingProvider**    | `null` |

     *
     * @category Configuration
     */
    var Defaults = {
        debug: false,
        instanceName: '$default_instance',
        fallbackVariant: {},
        initialVariants: {},
        initialFlags: undefined,
        source: exports.Source.LocalStorage,
        serverUrl: 'https://api.lab.amplitude.com',
        flagsServerUrl: 'https://flag.lab.amplitude.com',
        serverZone: 'US',
        fetchTimeoutMillis: 10000,
        retryFetchOnFailure: true,
        automaticExposureTracking: true,
        pollOnStart: true,
        fetchOnStart: true,
        automaticFetchOnAmplitudeIdentityChange: false,
        userProvider: null,
        analyticsProvider: null,
        exposureTrackingProvider: null,
        httpClient: FetchHttpClient,
    };

    var version = "1.11.0";

    var MAX_QUEUE_SIZE = 512;
    /**
     * Handles integration plugin management, event persistence and deduplication.
     */
    var IntegrationManager = /** @class */ (function () {
        function IntegrationManager(config, client) {
            var _this = this;
            var _a;
            this.isReady = new Promise(function (resolve) {
                _this.resolve = resolve;
            });
            this.config = config;
            this.client = client;
            var instanceName = (_a = config.instanceName) !== null && _a !== void 0 ? _a : Defaults.instanceName;
            this.queue = new PersistentTrackingQueue(instanceName);
            this.cache = new SessionDedupeCache(instanceName);
        }
        /**
         * Returns a promise when the integration has completed setup. If no
         * integration has been set, returns a resolved promise.
         */
        IntegrationManager.prototype.ready = function () {
            if (!this.integration) {
                return Promise.resolve();
            }
            return this.isReady;
        };
        /**
         * Set the integration to be managed. An existing integration is torndown,
         * and the new integration is setup. This function resolves the promise
         * returned by ready() if it has not already been resolved.
         *
         * @param integration the integration to manage.
         */
        IntegrationManager.prototype.setIntegration = function (integration) {
            var _this = this;
            if (this.integration && this.integration.teardown) {
                void this.integration.teardown();
            }
            this.integration = integration;
            if (integration.setup) {
                this.integration.setup(this.config, this.client).then(function () {
                    _this.queue.tracker = _this.integration.track;
                    _this.resolve();
                }, function (e) {
                    console.error('Integration setup failed.', e);
                    _this.queue.tracker = _this.integration.track;
                    _this.resolve();
                });
            }
            else {
                this.queue.tracker = this.integration.track;
                this.resolve();
            }
        };
        /**
         * Get the user from the integration. If no integration is set, returns an
         * empty object.
         */
        IntegrationManager.prototype.getUser = function () {
            if (!this.integration) {
                return {};
            }
            return this.integration.getUser();
        };
        /**
         * Deduplicates exposures using session storage, then tracks the event to the
         * integration. If no integration is set, or if the integration returns false,
         * the event is persisted in local storage.
         *
         * @param exposure
         */
        IntegrationManager.prototype.track = function (exposure) {
            var _a;
            if (this.cache.shouldTrack(exposure)) {
                if (((_a = exposure.metadata) === null || _a === void 0 ? void 0 : _a.deliveryMethod) === 'web') {
                    // Track impression
                    this.queue.push({
                        eventType: '$impression',
                        eventProperties: exposure,
                    });
                }
                else {
                    // Track exposure
                    this.queue.push({
                        eventType: '$exposure',
                        eventProperties: exposure,
                    });
                }
            }
        };
        return IntegrationManager;
    }());
    var SessionDedupeCache = /** @class */ (function () {
        function SessionDedupeCache(instanceName) {
            this.isSessionStorageAvailable = isSessionStorageAvailable();
            this.inMemoryCache = {};
            this.storageKey = "EXP_sent_".concat(instanceName);
        }
        SessionDedupeCache.prototype.shouldTrack = function (exposure) {
            var _a;
            // Always track web impressions.
            if (((_a = exposure.metadata) === null || _a === void 0 ? void 0 : _a.deliveryMethod) === 'web') {
                return true;
            }
            this.loadCache();
            var value = this.inMemoryCache[exposure.flag_key];
            var shouldTrack = false;
            if (!value) {
                shouldTrack = true;
                this.inMemoryCache[exposure.flag_key] = exposure.variant;
            }
            this.storeCache();
            return shouldTrack;
        };
        SessionDedupeCache.prototype.loadCache = function () {
            if (this.isSessionStorageAvailable) {
                var storedCache = safeGlobal$1.sessionStorage.getItem(this.storageKey);
                this.inMemoryCache = storedCache ? JSON.parse(storedCache) : {};
            }
        };
        SessionDedupeCache.prototype.storeCache = function () {
            if (this.isSessionStorageAvailable) {
                safeGlobal$1.sessionStorage.setItem(this.storageKey, JSON.stringify(this.inMemoryCache));
            }
        };
        return SessionDedupeCache;
    }());
    var PersistentTrackingQueue = /** @class */ (function () {
        function PersistentTrackingQueue(instanceName, maxQueueSize) {
            if (maxQueueSize === void 0) { maxQueueSize = MAX_QUEUE_SIZE; }
            this.isLocalStorageAvailable = isLocalStorageAvailable();
            this.inMemoryQueue = [];
            this.storageKey = "EXP_unsent_".concat(instanceName);
            this.maxQueueSize = maxQueueSize;
        }
        PersistentTrackingQueue.prototype.push = function (event) {
            this.loadQueue();
            this.inMemoryQueue.push(event);
            this.flush();
            this.storeQueue();
        };
        PersistentTrackingQueue.prototype.flush = function () {
            var e_1, _a;
            if (!this.tracker)
                return;
            if (this.inMemoryQueue.length === 0)
                return;
            try {
                for (var _b = __values$2(this.inMemoryQueue), _c = _b.next(); !_c.done; _c = _b.next()) {
                    var event_1 = _c.value;
                    if (!this.tracker(event_1))
                        return;
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                }
                finally { if (e_1) throw e_1.error; }
            }
            this.inMemoryQueue = [];
        };
        PersistentTrackingQueue.prototype.loadQueue = function () {
            if (this.isLocalStorageAvailable) {
                var storedQueue = safeGlobal$1.localStorage.getItem(this.storageKey);
                this.inMemoryQueue = storedQueue ? JSON.parse(storedQueue) : [];
            }
        };
        PersistentTrackingQueue.prototype.storeQueue = function () {
            if (this.isLocalStorageAvailable) {
                // Trim the queue if it is too large.
                if (this.inMemoryQueue.length > this.maxQueueSize) {
                    this.inMemoryQueue = this.inMemoryQueue.slice(this.inMemoryQueue.length - this.maxQueueSize);
                }
                safeGlobal$1.localStorage.setItem(this.storageKey, JSON.stringify(this.inMemoryQueue));
            }
        };
        return PersistentTrackingQueue;
    }());
    var isSessionStorageAvailable = function () {
        var globalScope = getGlobalScope();
        if (globalScope) {
            try {
                var testKey = 'EXP_test';
                globalScope.sessionStorage.setItem(testKey, testKey);
                globalScope.sessionStorage.removeItem(testKey);
                return true;
            }
            catch (e) {
                return false;
            }
        }
        return false;
    };

    var LocalStorage = /** @class */ (function () {
        function LocalStorage() {
            this.globalScope = getGlobalScope();
        }
        LocalStorage.prototype.get = function (key) {
            var _a;
            return (_a = this.globalScope) === null || _a === void 0 ? void 0 : _a.localStorage.getItem(key);
        };
        LocalStorage.prototype.put = function (key, value) {
            var _a;
            (_a = this.globalScope) === null || _a === void 0 ? void 0 : _a.localStorage.setItem(key, value);
        };
        LocalStorage.prototype.delete = function (key) {
            var _a;
            (_a = this.globalScope) === null || _a === void 0 ? void 0 : _a.localStorage.removeItem(key);
        };
        return LocalStorage;
    }());

    var getVariantStorage = function (deploymentKey, instanceName, storage) {
        var truncatedDeployment = deploymentKey.substring(deploymentKey.length - 6);
        var namespace = "amp-exp-".concat(instanceName, "-").concat(truncatedDeployment);
        return new LoadStoreCache(namespace, storage, transformVariantFromStorage);
    };
    var getFlagStorage = function (deploymentKey, instanceName, storage) {
        if (storage === void 0) { storage = new LocalStorage(); }
        var truncatedDeployment = deploymentKey.substring(deploymentKey.length - 6);
        var namespace = "amp-exp-".concat(instanceName, "-").concat(truncatedDeployment, "-flags");
        return new LoadStoreCache(namespace, storage);
    };
    var LoadStoreCache = /** @class */ (function () {
        function LoadStoreCache(namespace, storage, transformer) {
            this.cache = {};
            this.namespace = namespace;
            this.storage = storage;
            this.transformer = transformer;
        }
        LoadStoreCache.prototype.get = function (key) {
            return this.cache[key];
        };
        LoadStoreCache.prototype.getAll = function () {
            return __assign$2({}, this.cache);
        };
        LoadStoreCache.prototype.put = function (key, value) {
            this.cache[key] = value;
        };
        LoadStoreCache.prototype.putAll = function (values) {
            var e_1, _a;
            try {
                for (var _b = __values$2(Object.keys(values)), _c = _b.next(); !_c.done; _c = _b.next()) {
                    var key = _c.value;
                    this.cache[key] = values[key];
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                }
                finally { if (e_1) throw e_1.error; }
            }
        };
        LoadStoreCache.prototype.remove = function (key) {
            delete this.cache[key];
        };
        LoadStoreCache.prototype.clear = function () {
            this.cache = {};
        };
        LoadStoreCache.prototype.load = function () {
            var e_2, _a;
            var rawValues = this.storage.get(this.namespace);
            var jsonValues;
            try {
                jsonValues = JSON.parse(rawValues) || {};
            }
            catch (_b) {
                // Do nothing
                return;
            }
            var values = {};
            try {
                for (var _c = __values$2(Object.keys(jsonValues)), _d = _c.next(); !_d.done; _d = _c.next()) {
                    var key = _d.value;
                    try {
                        var value = void 0;
                        if (this.transformer) {
                            value = this.transformer(jsonValues[key]);
                        }
                        else {
                            value = jsonValues[key];
                        }
                        if (value) {
                            values[key] = value;
                        }
                    }
                    catch (_e) {
                        // Do nothing
                    }
                }
            }
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
                }
                finally { if (e_2) throw e_2.error; }
            }
            this.clear();
            this.putAll(values);
        };
        LoadStoreCache.prototype.store = function (values) {
            if (values === void 0) { values = this.cache; }
            this.storage.put(this.namespace, JSON.stringify(values));
        };
        return LoadStoreCache;
    }());
    var transformVariantFromStorage = function (storageValue) {
        if (typeof storageValue === 'string') {
            // From v0 string format
            return {
                key: storageValue,
                value: storageValue,
            };
        }
        else if (typeof storageValue === 'object') {
            // From v1 or v2 object format
            var key = storageValue['key'];
            var value = storageValue['value'];
            var payload = storageValue['payload'];
            var metadata = storageValue['metadata'];
            var experimentKey = storageValue['expKey'];
            if (metadata && metadata.experimentKey) {
                experimentKey = metadata.experimentKey;
            }
            else if (experimentKey) {
                metadata = metadata || {};
                metadata['experimentKey'] = experimentKey;
            }
            var variant = {};
            if (key) {
                variant.key = key;
            }
            else if (value) {
                variant.key = value;
            }
            if (value)
                variant.value = value;
            if (metadata)
                variant.metadata = metadata;
            if (payload)
                variant.payload = payload;
            if (experimentKey)
                variant.expKey = experimentKey;
            return variant;
        }
    };

    /**
     * Event for tracking a user's exposure to a variant. This event will not count
     * towards your analytics event volume.
     *
     * @deprecated use ExposureTrackingProvider instead
     */
    var exposureEvent = function (user, key, variant, source) {
        var _a;
        var name = '[Experiment] Exposure';
        var value = variant === null || variant === void 0 ? void 0 : variant.value;
        var userProperty = "[Experiment] ".concat(key);
        return {
            name: name,
            user: user,
            key: key,
            variant: variant,
            userProperty: userProperty,
            properties: {
                key: key,
                variant: value,
                source: source,
            },
            userProperties: (_a = {},
                _a[userProperty] = value,
                _a),
        };
    };

    var isNullOrUndefined = function (value) {
        return value === null || value === undefined;
    };
    var isNullUndefinedOrEmpty = function (value) {
        if (isNullOrUndefined(value))
            return true;
        return value && Object.keys(value).length === 0;
    };
    var isLocalEvaluationMode = function (flag) {
        var _a;
        return ((_a = flag === null || flag === void 0 ? void 0 : flag.metadata) === null || _a === void 0 ? void 0 : _a.evaluationMode) === 'local';
    };

    var Backoff = /** @class */ (function () {
        function Backoff(attempts, min, max, scalar) {
            this.started = false;
            this.done = false;
            this.attempts = attempts;
            this.min = min;
            this.max = max;
            this.scalar = scalar;
        }
        Backoff.prototype.start = function (fn) {
            return __awaiter$1(this, void 0, void 0, function () {
                return __generator$1(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (!this.started) {
                                this.started = true;
                            }
                            else {
                                throw Error('Backoff already started');
                            }
                            return [4 /*yield*/, this.backoff(fn, 0, this.min)];
                        case 1:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            });
        };
        Backoff.prototype.cancel = function () {
            this.done = true;
            clearTimeout(this.timeoutHandle);
        };
        Backoff.prototype.backoff = function (fn, attempt, delay) {
            return __awaiter$1(this, void 0, void 0, function () {
                var _this = this;
                return __generator$1(this, function (_a) {
                    if (this.done) {
                        return [2 /*return*/];
                    }
                    this.timeoutHandle = safeGlobal$1.setTimeout(function () { return __awaiter$1(_this, void 0, void 0, function () {
                        var nextAttempt, nextDelay;
                        return __generator$1(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 2, , 3]);
                                    return [4 /*yield*/, fn()];
                                case 1:
                                    _a.sent();
                                    return [3 /*break*/, 3];
                                case 2:
                                    _a.sent();
                                    nextAttempt = attempt + 1;
                                    if (nextAttempt < this.attempts) {
                                        nextDelay = Math.min(delay * this.scalar, this.max);
                                        this.backoff(fn, nextAttempt, nextDelay);
                                    }
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); }, delay);
                    return [2 /*return*/];
                });
            });
        };
        return Backoff;
    }());

    var convertUserToContext = function (user) {
        var e_1, _a;
        var _b, _c;
        if (!user) {
            return {};
        }
        var context = { user: user };
        // add page context
        var globalScope = getGlobalScope();
        if (globalScope) {
            context.page = {
                url: globalScope.location.href,
            };
        }
        var groups = {};
        if (!user.groups) {
            return context;
        }
        try {
            for (var _d = __values$2(Object.keys(user.groups)), _e = _d.next(); !_e.done; _e = _d.next()) {
                var groupType = _e.value;
                var groupNames = user.groups[groupType];
                if (groupNames.length > 0 && groupNames[0]) {
                    var groupName = groupNames[0];
                    var groupNameMap = {
                        group_name: groupName,
                    };
                    // Check for group properties
                    var groupProperties = (_c = (_b = user.group_properties) === null || _b === void 0 ? void 0 : _b[groupType]) === null || _c === void 0 ? void 0 : _c[groupName];
                    if (groupProperties && Object.keys(groupProperties).length > 0) {
                        groupNameMap['group_properties'] = groupProperties;
                    }
                    groups[groupType] = groupNameMap;
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_e && !_e.done && (_a = _d.return)) _a.call(_d);
            }
            finally { if (e_1) throw e_1.error; }
        }
        if (Object.keys(groups).length > 0) {
            context['groups'] = groups;
        }
        delete context.user['groups'];
        delete context.user['group_properties'];
        return context;
    };
    var convertVariant = function (value) {
        if (value === null || value === undefined) {
            return {};
        }
        if (typeof value == 'string') {
            return {
                key: value,
                value: value,
            };
        }
        else {
            return value;
        }
    };
    var convertEvaluationVariantToVariant = function (evaluationVariant) {
        if (!evaluationVariant) {
            return {};
        }
        var experimentKey = undefined;
        if (evaluationVariant.metadata) {
            experimentKey = evaluationVariant.metadata['experimentKey'];
        }
        var variant = {};
        if (evaluationVariant.key)
            variant.key = evaluationVariant.key;
        if (evaluationVariant.value)
            variant.value = evaluationVariant.value;
        if (evaluationVariant.payload)
            variant.payload = evaluationVariant.payload;
        if (experimentKey)
            variant.expKey = experimentKey;
        if (evaluationVariant.metadata)
            variant.metadata = evaluationVariant.metadata;
        return variant;
    };

    /**
     * A wrapper for an analytics provider which only sends one exposure event per
     * flag, per variant, per session. In other words, wrapping an analytics
     * provider in this class will prevent the same exposure event to be sent twice
     * in one session.
     */
    var SessionAnalyticsProvider = /** @class */ (function () {
        function SessionAnalyticsProvider(analyticsProvider) {
            // In memory record of flagKey and variant value to in order to only set
            // user properties and track an exposure event once per session unless the
            // variant value changes
            this.setProperties = {};
            this.unsetProperties = {};
            this.analyticsProvider = analyticsProvider;
        }
        SessionAnalyticsProvider.prototype.track = function (event) {
            if (this.setProperties[event.key] == event.variant.value) {
                return;
            }
            else {
                this.setProperties[event.key] = event.variant.value;
                delete this.unsetProperties[event.key];
            }
            this.analyticsProvider.track(event);
        };
        SessionAnalyticsProvider.prototype.setUserProperty = function (event) {
            if (this.setProperties[event.key] == event.variant.value) {
                return;
            }
            this.analyticsProvider.setUserProperty(event);
        };
        SessionAnalyticsProvider.prototype.unsetUserProperty = function (event) {
            if (this.unsetProperties[event.key]) {
                return;
            }
            else {
                this.unsetProperties[event.key] = 'unset';
                delete this.setProperties[event.key];
            }
            this.analyticsProvider.unsetUserProperty(event);
        };
        return SessionAnalyticsProvider;
    }());

    var SessionExposureTrackingProvider = /** @class */ (function () {
        function SessionExposureTrackingProvider(exposureTrackingProvider) {
            this.tracked = {};
            this.exposureTrackingProvider = exposureTrackingProvider;
        }
        SessionExposureTrackingProvider.prototype.track = function (exposure) {
            var trackedExposure = this.tracked[exposure.flag_key];
            if (trackedExposure && trackedExposure.variant === exposure.variant) {
                return;
            }
            else {
                this.tracked[exposure.flag_key] = exposure;
                this.exposureTrackingProvider.track(exposure);
            }
        };
        return SessionExposureTrackingProvider;
    }());

    /**
     * @packageDocumentation
     * @module experiment-js-client
     */
    // Configs which have been removed from the public API.
    // May be added back in the future.
    var fetchBackoffTimeout = 10000;
    var fetchBackoffAttempts = 8;
    var fetchBackoffMinMillis = 500;
    var fetchBackoffMaxMillis = 10000;
    var fetchBackoffScalar = 1.5;
    var flagPollerIntervalMillis = 60000;
    var euServerUrl = 'https://api.lab.eu.amplitude.com';
    var euFlagsServerUrl = 'https://flag.lab.eu.amplitude.com';
    /**
     * The default {@link Client} used to fetch variations from Experiment's
     * servers.
     *
     * @category Core Usage
     */
    var ExperimentClient = /** @class */ (function () {
        /**
         * Creates a new ExperimentClient instance.
         *
         * In most cases you will want to use the `initialize` factory method in
         * {@link Experiment}.
         *
         * @param apiKey The Client key for the Experiment project
         * @param config See {@link ExperimentConfig} for config options
         */
        function ExperimentClient(apiKey, config) {
            var _this = this;
            var _a, _b;
            this.engine = new EvaluationEngine();
            this.poller = new Poller(function () { return _this.doFlags(); }, flagPollerIntervalMillis);
            this.isRunning = false;
            this.apiKey = apiKey;
            // Merge configs with defaults and wrap providers
            this.config = __assign$2(__assign$2(__assign$2({}, Defaults), config), { 
                // Set server URLs separately
                serverUrl: (config === null || config === void 0 ? void 0 : config.serverUrl) ||
                    (((_a = config === null || config === void 0 ? void 0 : config.serverZone) === null || _a === void 0 ? void 0 : _a.toLowerCase()) === 'eu'
                        ? euServerUrl
                        : Defaults.serverUrl), flagsServerUrl: (config === null || config === void 0 ? void 0 : config.flagsServerUrl) ||
                    (((_b = config === null || config === void 0 ? void 0 : config.serverZone) === null || _b === void 0 ? void 0 : _b.toLowerCase()) === 'eu'
                        ? euFlagsServerUrl
                        : Defaults.flagsServerUrl) });
            // Transform initialVariants
            if (this.config.initialVariants) {
                for (var flagKey in this.config.initialVariants) {
                    this.config.initialVariants[flagKey] = transformVariantFromStorage(this.config.initialVariants[flagKey]);
                }
            }
            if (this.config.userProvider) {
                this.userProvider = this.config.userProvider;
            }
            if (this.config.analyticsProvider) {
                this.analyticsProvider = new SessionAnalyticsProvider(this.config.analyticsProvider);
            }
            if (this.config.exposureTrackingProvider) {
                this.exposureTrackingProvider = new SessionExposureTrackingProvider(this.config.exposureTrackingProvider);
            }
            this.integrationManager = new IntegrationManager(this.config, this);
            // Setup Remote APIs
            var httpClient = new WrapperClient(this.config.httpClient || FetchHttpClient);
            this.flagApi = new SdkFlagApi(this.apiKey, this.config.flagsServerUrl, httpClient);
            this.evaluationApi = new SdkEvaluationApi(this.apiKey, this.config.serverUrl, httpClient);
            // Storage & Caching
            var storage = new LocalStorage();
            this.variants = getVariantStorage(this.apiKey, this.config.instanceName, storage);
            this.flags = getFlagStorage(this.apiKey, this.config.instanceName, storage);
            try {
                this.flags.load();
                this.variants.load();
            }
            catch (e) {
                // catch localStorage undefined error
            }
            this.mergeInitialFlagsWithStorage();
        }
        /**
         * Start the SDK by getting flag configurations from the server and fetching
         * variants for the user. The promise returned by this function resolves when
         * local flag configurations have been updated, and the {@link fetch()}
         * result has been received (if the request was made).
         *
         * To force this function not to fetch variants, set the {@link fetchOnStart}
         * configuration option to `false` when initializing the SDK.
         *
         * Finally, this function will start polling for flag configurations at a
         * fixed interval. To disable polling, set the {@link pollOnStart}
         * configuration option to `false` on initialization.
         *
         * @param user The user to set in the SDK.
         * @see fetchOnStart
         * @see pollOnStart
         * @see fetch
         * @see variant
         */
        ExperimentClient.prototype.start = function (user) {
            var _a;
            return __awaiter$1(this, void 0, void 0, function () {
                var flagsReadyPromise, fetchOnStart;
                return __generator$1(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            if (this.isRunning) {
                                return [2 /*return*/];
                            }
                            else {
                                this.isRunning = true;
                            }
                            this.setUser(user);
                            flagsReadyPromise = this.doFlags();
                            fetchOnStart = (_a = this.config.fetchOnStart) !== null && _a !== void 0 ? _a : true;
                            if (!fetchOnStart) return [3 /*break*/, 2];
                            return [4 /*yield*/, Promise.all([this.fetch(user), flagsReadyPromise])];
                        case 1:
                            _b.sent();
                            return [3 /*break*/, 4];
                        case 2: return [4 /*yield*/, flagsReadyPromise];
                        case 3:
                            _b.sent();
                            _b.label = 4;
                        case 4:
                            if (this.config.pollOnStart) {
                                this.poller.start();
                            }
                            return [2 /*return*/];
                    }
                });
            });
        };
        /**
         * Stop the local flag configuration poller.
         */
        ExperimentClient.prototype.stop = function () {
            if (!this.isRunning) {
                return;
            }
            this.poller.stop();
            this.isRunning = false;
        };
        /**
         * Assign the given user to the SDK and asynchronously fetch all variants
         * from the server. Subsequent calls may omit the user from the argument to
         * use the user from the previous call.
         *
         * If an {@link ExperimentUserProvider} has been set, the argument user will
         * be merged with the provider user, preferring user fields from the argument
         * user and falling back on the provider for fields which are null or
         * undefined.
         *
         * If configured, fetch retries the request in the background on failure.
         * Variants received from a successful retry are stored in local storage for
         * access.
         *
         * If you are using the `initialVariants` config option to preload this SDK
         * from the server, you generally do not need to call `fetch`.
         *
         * @param user The user to fetch variants for.
         * @param options Options for this specific fetch call.
         * @returns Promise that resolves when the request for variants completes.
         * @see ExperimentUser
         * @see ExperimentUserProvider
         */
        ExperimentClient.prototype.fetch = function (user, options) {
            if (user === void 0) { user = this.user; }
            return __awaiter$1(this, void 0, void 0, function () {
                var e_1;
                return __generator$1(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            this.setUser(user || {});
                            _a.label = 1;
                        case 1:
                            _a.trys.push([1, 3, , 4]);
                            return [4 /*yield*/, this.fetchInternal(user, this.config.fetchTimeoutMillis, this.config.retryFetchOnFailure, options)];
                        case 2:
                            _a.sent();
                            return [3 /*break*/, 4];
                        case 3:
                            e_1 = _a.sent();
                            console.error(e_1);
                            return [3 /*break*/, 4];
                        case 4: return [2 /*return*/, this];
                    }
                });
            });
        };
        /**
         * Returns the variant for the provided key.
         *
         * Access the variant from {@link Source}, falling back  on the given
         * fallback, then the configured fallbackVariant.
         *
         * If an {@link ExposureTrackingProvider} is configured and the
         * {@link automaticExposureTracking} configuration option is `true`, this
         * function will call the provider with an {@link Exposure} event. The
         * exposure event does not count towards your event volume within Amplitude.
         *
         * @param key The key to get the variant for.
         * @param fallback The highest priority fallback.
         * @see ExperimentConfig
         * @see ExposureTrackingProvider
         */
        ExperimentClient.prototype.variant = function (key, fallback) {
            var _a, _b;
            if (!this.apiKey) {
                return { value: undefined };
            }
            var sourceVariant = this.variantAndSource(key, fallback);
            if (this.config.automaticExposureTracking) {
                this.exposureInternal(key, sourceVariant);
            }
            this.debug("[Experiment] variant for ".concat(key, " is ").concat(((_a = sourceVariant.variant) === null || _a === void 0 ? void 0 : _a.key) || ((_b = sourceVariant.variant) === null || _b === void 0 ? void 0 : _b.value)));
            return sourceVariant.variant || {};
        };
        /**
         * Track an exposure event for the variant associated with the flag/experiment
         * {@link key}.
         *
         * This method requires that an {@link ExposureTrackingProvider} be
         * configured when this client is initialized, either manually, or through the
         * Amplitude Analytics SDK integration from set up using
         * {@link Experiment.initializeWithAmplitudeAnalytics}.
         *
         * @param key The flag/experiment key to track an exposure for.
         * @see ExposureTrackingProvider
         */
        ExperimentClient.prototype.exposure = function (key) {
            var sourceVariant = this.variantAndSource(key);
            this.exposureInternal(key, sourceVariant);
        };
        /**
         * Returns all variants for the user.
         *
         * The primary source of variants is based on the
         * {@link Source} configured in the {@link ExperimentConfig}.
         *
         * @see Source
         * @see ExperimentConfig
         */
        ExperimentClient.prototype.all = function () {
            if (!this.apiKey) {
                return {};
            }
            var evaluatedVariants = this.evaluate();
            for (var flagKey in evaluatedVariants) {
                var flag = this.flags.get(flagKey);
                if (!isLocalEvaluationMode(flag)) {
                    delete evaluatedVariants[flagKey];
                }
            }
            return __assign$2(__assign$2(__assign$2({}, this.secondaryVariants()), this.sourceVariants()), evaluatedVariants);
        };
        /**
         * Clear all variants in the cache and storage.
         */
        ExperimentClient.prototype.clear = function () {
            this.variants.clear();
            try {
                void this.variants.store();
            }
            catch (e) {
                // catch localStorage undefined error
            }
        };
        /**
         * Get a copy of the internal {@link ExperimentUser} object if it is set.
         *
         * @returns a copy of the internal user object if set.
         */
        ExperimentClient.prototype.getUser = function () {
            var _a;
            if (!this.user) {
                return this.user;
            }
            if ((_a = this.user) === null || _a === void 0 ? void 0 : _a.user_properties) {
                var userPropertiesCopy = __assign$2({}, this.user.user_properties);
                return __assign$2(__assign$2({}, this.user), { user_properties: userPropertiesCopy });
            }
            else {
                return __assign$2({}, this.user);
            }
        };
        /**
         * Copy in and set the user within the experiment client.
         *
         * @param user the user to set within the experiment client.
         */
        ExperimentClient.prototype.setUser = function (user) {
            var _a;
            if (!user) {
                this.user = null;
                return;
            }
            if ((_a = this.user) === null || _a === void 0 ? void 0 : _a.user_properties) {
                var userPropertiesCopy = __assign$2({}, user.user_properties);
                this.user = __assign$2(__assign$2({}, user), { user_properties: userPropertiesCopy });
            }
            else {
                this.user = __assign$2({}, user);
            }
        };
        /**
         * Get the user provider set by {@link setUserProvider} or null if the user
         * provider has not been set.
         *
         * @returns The user provider set by {@link setUserProvider} or null.
         * @deprecated use ExperimentConfig.userProvider instead
         */
        ExperimentClient.prototype.getUserProvider = function () {
            return this.userProvider;
        };
        /**
         * Sets a user provider that will inject identity information into the user
         * for {@link fetch()} requests. The user provider will only set user fields
         * in outgoing requests which are null or undefined.
         *
         * See {@link ExperimentUserProvider} for more details
         * @param userProvider
         * @deprecated use ExperimentConfig.userProvider instead
         */
        ExperimentClient.prototype.setUserProvider = function (userProvider) {
            this.userProvider = userProvider;
            return this;
        };
        ExperimentClient.prototype.mergeInitialFlagsWithStorage = function () {
            var _this = this;
            if (this.config.initialFlags) {
                var initialFlags = JSON.parse(this.config.initialFlags);
                initialFlags.forEach(function (flag) {
                    if (!_this.flags.get(flag.key)) {
                        _this.flags.put(flag.key, flag);
                    }
                });
            }
        };
        ExperimentClient.prototype.evaluate = function (flagKeys) {
            var e_2, _a;
            var user = this.addContext(this.user);
            var flags = topologicalSort(this.flags.getAll(), flagKeys);
            var context = convertUserToContext(user);
            var evaluationVariants = this.engine.evaluate(context, flags);
            var variants = {};
            try {
                for (var _b = __values$2(Object.keys(evaluationVariants)), _c = _b.next(); !_c.done; _c = _b.next()) {
                    var flagKey = _c.value;
                    variants[flagKey] = convertEvaluationVariantToVariant(evaluationVariants[flagKey]);
                }
            }
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                }
                finally { if (e_2) throw e_2.error; }
            }
            return variants;
        };
        ExperimentClient.prototype.variantAndSource = function (key, fallback) {
            var sourceVariant = {};
            if (this.config.source === exports.Source.LocalStorage) {
                sourceVariant = this.localStorageVariantAndSource(key, fallback);
            }
            else if (this.config.source === exports.Source.InitialVariants) {
                sourceVariant = this.initialVariantsVariantAndSource(key, fallback);
            }
            var flag = this.flags.get(key);
            if (isLocalEvaluationMode(flag) || (!sourceVariant.variant && flag)) {
                sourceVariant = this.localEvaluationVariantAndSource(key, flag, fallback);
            }
            return sourceVariant;
        };
        /**
         * This function assumes the flag exists and is local evaluation mode. For
         * local evaluation, fallback order goes:
         *
         *  1. Local evaluation
         *  2. Inline function fallback
         *  3. Initial variants
         *  4. Config fallback
         *
         * If there is a default variant and no fallback, return the default variant.
         */
        ExperimentClient.prototype.localEvaluationVariantAndSource = function (key, flag, fallback) {
            var _a;
            var defaultSourceVariant = {};
            // Local evaluation
            var variant = this.evaluate([flag.key])[key];
            var source = VariantSource.LocalEvaluation;
            var isLocalEvaluationDefault = (_a = variant === null || variant === void 0 ? void 0 : variant.metadata) === null || _a === void 0 ? void 0 : _a.default;
            if (!isNullOrUndefined(variant) && !isLocalEvaluationDefault) {
                return {
                    variant: convertVariant(variant),
                    source: source,
                    hasDefaultVariant: false,
                };
            }
            else if (isLocalEvaluationDefault) {
                defaultSourceVariant = {
                    variant: convertVariant(variant),
                    source: source,
                    hasDefaultVariant: true,
                };
            }
            // Inline fallback
            if (!isNullOrUndefined(fallback)) {
                return {
                    variant: convertVariant(fallback),
                    source: VariantSource.FallbackInline,
                    hasDefaultVariant: defaultSourceVariant.hasDefaultVariant,
                };
            }
            // Initial variants
            var initialVariant = this.config.initialVariants[key];
            if (!isNullOrUndefined(initialVariant)) {
                return {
                    variant: convertVariant(initialVariant),
                    source: VariantSource.SecondaryInitialVariants,
                    hasDefaultVariant: defaultSourceVariant.hasDefaultVariant,
                };
            }
            // Configured fallback, or default variant
            var fallbackVariant = convertVariant(this.config.fallbackVariant);
            var fallbackSourceVariant = {
                variant: fallbackVariant,
                source: VariantSource.FallbackConfig,
                hasDefaultVariant: defaultSourceVariant.hasDefaultVariant,
            };
            if (!isNullUndefinedOrEmpty(fallbackVariant)) {
                return fallbackSourceVariant;
            }
            return defaultSourceVariant;
        };
        /**
         * For Source.LocalStorage, fallback order goes:
         *
         *  1. Local Storage
         *  2. Inline function fallback
         *  3. InitialFlags
         *  4. Config fallback
         *
         * If there is a default variant and no fallback, return the default variant.
         */
        ExperimentClient.prototype.localStorageVariantAndSource = function (key, fallback) {
            var _a;
            var defaultSourceVariant = {};
            // Local storage
            var localStorageVariant = this.variants.get(key);
            var isLocalStorageDefault = (_a = localStorageVariant === null || localStorageVariant === void 0 ? void 0 : localStorageVariant.metadata) === null || _a === void 0 ? void 0 : _a.default;
            if (!isNullOrUndefined(localStorageVariant) && !isLocalStorageDefault) {
                return {
                    variant: convertVariant(localStorageVariant),
                    source: VariantSource.LocalStorage,
                    hasDefaultVariant: false,
                };
            }
            else if (isLocalStorageDefault) {
                defaultSourceVariant = {
                    variant: convertVariant(localStorageVariant),
                    source: VariantSource.LocalStorage,
                    hasDefaultVariant: true,
                };
            }
            // Inline fallback
            if (!isNullOrUndefined(fallback)) {
                return {
                    variant: convertVariant(fallback),
                    source: VariantSource.FallbackInline,
                    hasDefaultVariant: defaultSourceVariant.hasDefaultVariant,
                };
            }
            // Initial variants
            var initialVariant = this.config.initialVariants[key];
            if (!isNullOrUndefined(initialVariant)) {
                return {
                    variant: convertVariant(initialVariant),
                    source: VariantSource.SecondaryInitialVariants,
                    hasDefaultVariant: defaultSourceVariant.hasDefaultVariant,
                };
            }
            // Configured fallback, or default variant
            var fallbackVariant = convertVariant(this.config.fallbackVariant);
            var fallbackSourceVariant = {
                variant: fallbackVariant,
                source: VariantSource.FallbackConfig,
                hasDefaultVariant: defaultSourceVariant.hasDefaultVariant,
            };
            if (!isNullUndefinedOrEmpty(fallbackVariant)) {
                return fallbackSourceVariant;
            }
            return defaultSourceVariant;
        };
        /**
         * For Source.InitialVariants, fallback order goes:
         *
         *  1. Initial variants
         *  2. Local storage
         *  3. Inline function fallback
         *  4. Config fallback
         *
         * If there is a default variant and no fallback, return the default variant.
         */
        ExperimentClient.prototype.initialVariantsVariantAndSource = function (key, fallback) {
            var _a;
            var defaultSourceVariant = {};
            // Initial variants
            var initialVariantsVariant = this.config.initialVariants[key];
            if (!isNullOrUndefined(initialVariantsVariant)) {
                return {
                    variant: convertVariant(initialVariantsVariant),
                    source: VariantSource.InitialVariants,
                    hasDefaultVariant: false,
                };
            }
            // Local storage
            var localStorageVariant = this.variants.get(key);
            var isLocalStorageDefault = (_a = localStorageVariant === null || localStorageVariant === void 0 ? void 0 : localStorageVariant.metadata) === null || _a === void 0 ? void 0 : _a.default;
            if (!isNullOrUndefined(localStorageVariant) && !isLocalStorageDefault) {
                return {
                    variant: convertVariant(localStorageVariant),
                    source: VariantSource.LocalStorage,
                    hasDefaultVariant: false,
                };
            }
            else if (isLocalStorageDefault) {
                defaultSourceVariant = {
                    variant: convertVariant(localStorageVariant),
                    source: VariantSource.LocalStorage,
                    hasDefaultVariant: true,
                };
            }
            // Inline fallback
            if (!isNullOrUndefined(fallback)) {
                return {
                    variant: convertVariant(fallback),
                    source: VariantSource.FallbackInline,
                    hasDefaultVariant: defaultSourceVariant.hasDefaultVariant,
                };
            }
            // Configured fallback, or default variant
            var fallbackVariant = convertVariant(this.config.fallbackVariant);
            var fallbackSourceVariant = {
                variant: fallbackVariant,
                source: VariantSource.FallbackConfig,
                hasDefaultVariant: defaultSourceVariant.hasDefaultVariant,
            };
            if (!isNullUndefinedOrEmpty(fallbackVariant)) {
                return fallbackSourceVariant;
            }
            return defaultSourceVariant;
        };
        ExperimentClient.prototype.fetchInternal = function (user, timeoutMillis, retry, options) {
            return __awaiter$1(this, void 0, void 0, function () {
                var variants, e_3;
                return __generator$1(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            // Don't even try to fetch variants if API key is not set
                            if (!this.apiKey) {
                                throw Error('Experiment API key is empty');
                            }
                            this.debug("[Experiment] Fetch all: retry=".concat(retry));
                            // Proactively cancel retries if active in order to avoid unnecessary API
                            // requests. A new failure will restart the retries.
                            if (retry) {
                                this.stopRetries();
                            }
                            _a.label = 1;
                        case 1:
                            _a.trys.push([1, 4, , 5]);
                            return [4 /*yield*/, this.doFetch(user, timeoutMillis, options)];
                        case 2:
                            variants = _a.sent();
                            return [4 /*yield*/, this.storeVariants(variants, options)];
                        case 3:
                            _a.sent();
                            return [2 /*return*/, variants];
                        case 4:
                            e_3 = _a.sent();
                            if (retry && this.shouldRetryFetch(e_3)) {
                                void this.startRetries(user, options);
                            }
                            throw e_3;
                        case 5: return [2 /*return*/];
                    }
                });
            });
        };
        ExperimentClient.prototype.cleanUserPropsForFetch = function (user) {
            var cleanedUser = __assign$2({}, user);
            delete cleanedUser.cookie;
            return cleanedUser;
        };
        ExperimentClient.prototype.doFetch = function (user, timeoutMillis, options) {
            return __awaiter$1(this, void 0, void 0, function () {
                var results, variants, _a, _b, key;
                var e_4, _c;
                return __generator$1(this, function (_d) {
                    switch (_d.label) {
                        case 0: return [4 /*yield*/, this.addContextOrWait(user)];
                        case 1:
                            user = _d.sent();
                            user = this.cleanUserPropsForFetch(user);
                            this.debug('[Experiment] Fetch variants for user: ', user);
                            return [4 /*yield*/, this.evaluationApi.getVariants(user, __assign$2({ timeoutMillis: timeoutMillis }, options))];
                        case 2:
                            results = _d.sent();
                            variants = {};
                            try {
                                for (_a = __values$2(Object.keys(results)), _b = _a.next(); !_b.done; _b = _a.next()) {
                                    key = _b.value;
                                    variants[key] = convertEvaluationVariantToVariant(results[key]);
                                }
                            }
                            catch (e_4_1) { e_4 = { error: e_4_1 }; }
                            finally {
                                try {
                                    if (_b && !_b.done && (_c = _a.return)) _c.call(_a);
                                }
                                finally { if (e_4) throw e_4.error; }
                            }
                            this.debug('[Experiment] Received variants: ', variants);
                            return [2 /*return*/, variants];
                    }
                });
            });
        };
        ExperimentClient.prototype.doFlags = function () {
            return __awaiter$1(this, void 0, void 0, function () {
                var flags;
                return __generator$1(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.flagApi.getFlags({
                                libraryName: 'experiment-js-client',
                                libraryVersion: version,
                                timeoutMillis: this.config.fetchTimeoutMillis,
                            })];
                        case 1:
                            flags = _a.sent();
                            this.flags.clear();
                            this.flags.putAll(flags);
                            try {
                                this.flags.store();
                            }
                            catch (e) {
                                // catch localStorage undefined error
                            }
                            this.mergeInitialFlagsWithStorage();
                            return [2 /*return*/];
                    }
                });
            });
        };
        ExperimentClient.prototype.storeVariants = function (variants, options) {
            return __awaiter$1(this, void 0, void 0, function () {
                var failedFlagKeys, _loop_1, this_1, key, key;
                return __generator$1(this, function (_a) {
                    failedFlagKeys = options && options.flagKeys ? options.flagKeys : [];
                    if (failedFlagKeys.length === 0) {
                        this.variants.clear();
                    }
                    _loop_1 = function (key) {
                        failedFlagKeys = failedFlagKeys.filter(function (flagKey) { return flagKey !== key; });
                        this_1.variants.put(key, variants[key]);
                    };
                    this_1 = this;
                    for (key in variants) {
                        _loop_1(key);
                    }
                    for (key in failedFlagKeys) {
                        this.variants.remove(key);
                    }
                    try {
                        this.variants.store();
                    }
                    catch (e) {
                        // catch localStorage undefined error
                    }
                    this.debug('[Experiment] Stored variants: ', variants);
                    return [2 /*return*/];
                });
            });
        };
        ExperimentClient.prototype.startRetries = function (user, options) {
            return __awaiter$1(this, void 0, void 0, function () {
                var _this = this;
                return __generator$1(this, function (_a) {
                    this.debug('[Experiment] Retry fetch');
                    this.retriesBackoff = new Backoff(fetchBackoffAttempts, fetchBackoffMinMillis, fetchBackoffMaxMillis, fetchBackoffScalar);
                    void this.retriesBackoff.start(function () { return __awaiter$1(_this, void 0, void 0, function () {
                        return __generator$1(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, this.fetchInternal(user, fetchBackoffTimeout, false, options)];
                                case 1:
                                    _a.sent();
                                    return [2 /*return*/];
                            }
                        });
                    }); });
                    return [2 /*return*/];
                });
            });
        };
        ExperimentClient.prototype.stopRetries = function () {
            if (this.retriesBackoff) {
                this.retriesBackoff.cancel();
            }
        };
        ExperimentClient.prototype.addContext = function (user) {
            var _a;
            var providedUser = (_a = this.userProvider) === null || _a === void 0 ? void 0 : _a.getUser();
            var integrationUser = this.integrationManager.getUser();
            var mergedUserProperties = __assign$2(__assign$2(__assign$2({}, providedUser === null || providedUser === void 0 ? void 0 : providedUser.user_properties), integrationUser.user_properties), user === null || user === void 0 ? void 0 : user.user_properties);
            return __assign$2(__assign$2(__assign$2(__assign$2({ library: "experiment-js-client/".concat(version) }, providedUser), integrationUser), user), { user_properties: mergedUserProperties });
        };
        ExperimentClient.prototype.addContextOrWait = function (user) {
            return __awaiter$1(this, void 0, void 0, function () {
                return __generator$1(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.integrationManager.ready()];
                        case 1:
                            _a.sent();
                            return [2 /*return*/, this.addContext(user)];
                    }
                });
            });
        };
        ExperimentClient.prototype.sourceVariants = function () {
            if (this.config.source == exports.Source.LocalStorage) {
                return this.variants.getAll();
            }
            else if (this.config.source == exports.Source.InitialVariants) {
                return this.config.initialVariants;
            }
        };
        ExperimentClient.prototype.secondaryVariants = function () {
            if (this.config.source == exports.Source.LocalStorage) {
                return this.config.initialVariants;
            }
            else if (this.config.source == exports.Source.InitialVariants) {
                return this.variants.getAll();
            }
        };
        ExperimentClient.prototype.exposureInternal = function (key, sourceVariant) {
            var _a, _b, _c, _d, _e, _f;
            this.legacyExposureInternal(key, sourceVariant.variant, sourceVariant.source);
            var exposure = { flag_key: key };
            // Do not track exposure for fallback variants that are not associated with
            // a default variant.
            var fallback = isFallback(sourceVariant.source);
            if (fallback && !sourceVariant.hasDefaultVariant) {
                return;
            }
            if ((_a = sourceVariant.variant) === null || _a === void 0 ? void 0 : _a.expKey) {
                exposure.experiment_key = (_b = sourceVariant.variant) === null || _b === void 0 ? void 0 : _b.expKey;
            }
            var metadata = (_c = sourceVariant.variant) === null || _c === void 0 ? void 0 : _c.metadata;
            if (!fallback && !(metadata === null || metadata === void 0 ? void 0 : metadata.default)) {
                if ((_d = sourceVariant.variant) === null || _d === void 0 ? void 0 : _d.key) {
                    exposure.variant = sourceVariant.variant.key;
                }
                else if ((_e = sourceVariant.variant) === null || _e === void 0 ? void 0 : _e.value) {
                    exposure.variant = sourceVariant.variant.value;
                }
            }
            if (metadata)
                exposure.metadata = metadata;
            (_f = this.exposureTrackingProvider) === null || _f === void 0 ? void 0 : _f.track(exposure);
            this.integrationManager.track(exposure);
        };
        ExperimentClient.prototype.legacyExposureInternal = function (key, variant, source) {
            var _a, _b, _c, _d, _e;
            if (this.analyticsProvider) {
                var user = this.addContext(this.getUser());
                var event_1 = exposureEvent(user, key, variant, source);
                if (isFallback(source) || !(variant === null || variant === void 0 ? void 0 : variant.value)) {
                    (_b = (_a = this.analyticsProvider) === null || _a === void 0 ? void 0 : _a.unsetUserProperty) === null || _b === void 0 ? void 0 : _b.call(_a, event_1);
                }
                else if (variant === null || variant === void 0 ? void 0 : variant.value) {
                    (_d = (_c = this.analyticsProvider) === null || _c === void 0 ? void 0 : _c.setUserProperty) === null || _d === void 0 ? void 0 : _d.call(_c, event_1);
                    (_e = this.analyticsProvider) === null || _e === void 0 ? void 0 : _e.track(event_1);
                }
            }
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ExperimentClient.prototype.debug = function (message) {
            var optionalParams = [];
            for (var _i = 1; _i < arguments.length; _i++) {
                optionalParams[_i - 1] = arguments[_i];
            }
            if (this.config.debug) {
                console.debug.apply(console, __spreadArray$1([message], __read$2(optionalParams), false));
            }
        };
        ExperimentClient.prototype.shouldRetryFetch = function (e) {
            if (e instanceof FetchError) {
                return e.statusCode < 400 || e.statusCode >= 500 || e.statusCode === 429;
            }
            return true;
        };
        /**
         * Add a plugin to the experiment client.
         * @param plugin the plugin to add.
         */
        ExperimentClient.prototype.addPlugin = function (plugin) {
            if (plugin.type === 'integration') {
                this.integrationManager.setIntegration(plugin);
            }
        };
        return ExperimentClient;
    }());

    var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

    function createCommonjsModule(fn, basedir, module) {
    	return module = {
    		path: basedir,
    		exports: {},
    		require: function (path, base) {
    			return commonjsRequire(path, (base === undefined || base === null) ? module.path : base);
    		}
    	}, fn(module, module.exports), module.exports;
    }

    function commonjsRequire () {
    	throw new Error('Dynamic requires are not currently supported by @rollup/plugin-commonjs');
    }

    var uaParser = createCommonjsModule(function (module, exports) {
      /////////////////////////////////////////////////////////////////////////////////
      /* UAParser.js v0.7.33
         Copyright © 2012-2021 Faisal Salman <f@faisalman.com>
         MIT License */ /*
                        Detect Browser, Engine, OS, CPU, and Device type/model from User-Agent data.
                        Supports browser & node.js environment.
                        Demo   : https://faisalman.github.io/ua-parser-js
                        Source : https://github.com/faisalman/ua-parser-js */
      /////////////////////////////////////////////////////////////////////////////////

      (function (window, undefined$1) {

        //////////////
        // Constants
        /////////////
        var LIBVERSION = "0.7.33",
          EMPTY = "",
          UNKNOWN = "?",
          FUNC_TYPE = "function",
          UNDEF_TYPE = "undefined",
          OBJ_TYPE = "object",
          STR_TYPE = "string",
          MAJOR = "major",
          MODEL = "model",
          NAME = "name",
          TYPE = "type",
          VENDOR = "vendor",
          VERSION = "version",
          ARCHITECTURE = "architecture",
          CONSOLE = "console",
          MOBILE = "mobile",
          TABLET = "tablet",
          SMARTTV = "smarttv",
          WEARABLE = "wearable",
          EMBEDDED = "embedded",
          UA_MAX_LENGTH = 350;
        var AMAZON = "Amazon",
          APPLE = "Apple",
          ASUS = "ASUS",
          BLACKBERRY = "BlackBerry",
          BROWSER = "Browser",
          CHROME = "Chrome",
          EDGE = "Edge",
          FIREFOX = "Firefox",
          GOOGLE = "Google",
          HUAWEI = "Huawei",
          LG = "LG",
          MICROSOFT = "Microsoft",
          MOTOROLA = "Motorola",
          OPERA = "Opera",
          SAMSUNG = "Samsung",
          SHARP = "Sharp",
          SONY = "Sony",
          XIAOMI = "Xiaomi",
          ZEBRA = "Zebra",
          FACEBOOK = "Facebook";

        ///////////
        // Helper
        //////////

        var extend = function (regexes, extensions) {
            var mergedRegexes = {};
            for (var i in regexes) {
              if (extensions[i] && extensions[i].length % 2 === 0) {
                mergedRegexes[i] = extensions[i].concat(regexes[i]);
              } else {
                mergedRegexes[i] = regexes[i];
              }
            }
            return mergedRegexes;
          },
          enumerize = function (arr) {
            var enums = {};
            for (var i = 0; i < arr.length; i++) {
              enums[arr[i].toUpperCase()] = arr[i];
            }
            return enums;
          },
          has = function (str1, str2) {
            return typeof str1 === STR_TYPE ? lowerize(str2).indexOf(lowerize(str1)) !== -1 : false;
          },
          lowerize = function (str) {
            return str.toLowerCase();
          },
          majorize = function (version) {
            return typeof version === STR_TYPE ? version.replace(/[^\d\.]/g, EMPTY).split(".")[0] : undefined$1;
          },
          trim = function (str, len) {
            if (typeof str === STR_TYPE) {
              str = str.replace(/^\s\s*/, EMPTY);
              return typeof len === UNDEF_TYPE ? str : str.substring(0, UA_MAX_LENGTH);
            }
          };

        ///////////////
        // Map helper
        //////////////

        var rgxMapper = function (ua, arrays) {
            var i = 0,
              j,
              k,
              p,
              q,
              matches,
              match;

            // loop through all regexes maps
            while (i < arrays.length && !matches) {
              var regex = arrays[i],
                // even sequence (0,2,4,..)
                props = arrays[i + 1]; // odd sequence (1,3,5,..)
              j = k = 0;

              // try matching uastring with regexes
              while (j < regex.length && !matches) {
                matches = regex[j++].exec(ua);
                if (!!matches) {
                  for (p = 0; p < props.length; p++) {
                    match = matches[++k];
                    q = props[p];
                    // check if given property is actually array
                    if (typeof q === OBJ_TYPE && q.length > 0) {
                      if (q.length === 2) {
                        if (typeof q[1] == FUNC_TYPE) {
                          // assign modified match
                          this[q[0]] = q[1].call(this, match);
                        } else {
                          // assign given value, ignore regex match
                          this[q[0]] = q[1];
                        }
                      } else if (q.length === 3) {
                        // check whether function or regex
                        if (typeof q[1] === FUNC_TYPE && !(q[1].exec && q[1].test)) {
                          // call function (usually string mapper)
                          this[q[0]] = match ? q[1].call(this, match, q[2]) : undefined$1;
                        } else {
                          // sanitize match using given regex
                          this[q[0]] = match ? match.replace(q[1], q[2]) : undefined$1;
                        }
                      } else if (q.length === 4) {
                        this[q[0]] = match ? q[3].call(this, match.replace(q[1], q[2])) : undefined$1;
                      }
                    } else {
                      this[q] = match ? match : undefined$1;
                    }
                  }
                }
              }
              i += 2;
            }
          },
          strMapper = function (str, map) {
            for (var i in map) {
              // check if current value is array
              if (typeof map[i] === OBJ_TYPE && map[i].length > 0) {
                for (var j = 0; j < map[i].length; j++) {
                  if (has(map[i][j], str)) {
                    return i === UNKNOWN ? undefined$1 : i;
                  }
                }
              } else if (has(map[i], str)) {
                return i === UNKNOWN ? undefined$1 : i;
              }
            }
            return str;
          };

        ///////////////
        // String map
        //////////////

        // Safari < 3.0
        var oldSafariMap = {
            "1.0": "/8",
            1.2: "/1",
            1.3: "/3",
            "2.0": "/412",
            "2.0.2": "/416",
            "2.0.3": "/417",
            "2.0.4": "/419",
            "?": "/"
          },
          windowsVersionMap = {
            ME: "4.90",
            "NT 3.11": "NT3.51",
            "NT 4.0": "NT4.0",
            2000: "NT 5.0",
            XP: ["NT 5.1", "NT 5.2"],
            Vista: "NT 6.0",
            7: "NT 6.1",
            8: "NT 6.2",
            8.1: "NT 6.3",
            10: ["NT 6.4", "NT 10.0"],
            RT: "ARM"
          };

        //////////////
        // Regex map
        /////////////

        var regexes = {
          browser: [[/\b(?:crmo|crios)\/([\w\.]+)/i // Chrome for Android/iOS
          ], [VERSION, [NAME, "Chrome"]], [/edg(?:e|ios|a)?\/([\w\.]+)/i // Microsoft Edge
          ], [VERSION, [NAME, "Edge"]], [
          // Presto based
          /(opera mini)\/([-\w\.]+)/i,
          // Opera Mini
          /(opera [mobiletab]{3,6})\b.+version\/([-\w\.]+)/i,
          // Opera Mobi/Tablet
          /(opera)(?:.+version\/|[\/ ]+)([\w\.]+)/i // Opera
          ], [NAME, VERSION], [/opios[\/ ]+([\w\.]+)/i // Opera mini on iphone >= 8.0
          ], [VERSION, [NAME, OPERA + " Mini"]], [/\bopr\/([\w\.]+)/i // Opera Webkit
          ], [VERSION, [NAME, OPERA]], [
          // Mixed
          /(kindle)\/([\w\.]+)/i,
          // Kindle
          /(lunascape|maxthon|netfront|jasmine|blazer)[\/ ]?([\w\.]*)/i,
          // Lunascape/Maxthon/Netfront/Jasmine/Blazer
          // Trident based
          /(avant |iemobile|slim)(?:browser)?[\/ ]?([\w\.]*)/i,
          // Avant/IEMobile/SlimBrowser
          /(ba?idubrowser)[\/ ]?([\w\.]+)/i,
          // Baidu Browser
          /(?:ms|\()(ie) ([\w\.]+)/i,
          // Internet Explorer

          // Webkit/KHTML based                                               // Flock/RockMelt/Midori/Epiphany/Silk/Skyfire/Bolt/Iron/Iridium/PhantomJS/Bowser/QupZilla/Falkon
          /(flock|rockmelt|midori|epiphany|silk|skyfire|ovibrowser|bolt|iron|vivaldi|iridium|phantomjs|bowser|quark|qupzilla|falkon|rekonq|puffin|brave|whale|qqbrowserlite|qq|duckduckgo)\/([-\w\.]+)/i,
          // Rekonq/Puffin/Brave/Whale/QQBrowserLite/QQ, aka ShouQ
          /(weibo)__([\d\.]+)/i // Weibo
          ], [NAME, VERSION], [/(?:\buc? ?browser|(?:juc.+)ucweb)[\/ ]?([\w\.]+)/i // UCBrowser
          ], [VERSION, [NAME, "UC" + BROWSER]], [/microm.+\bqbcore\/([\w\.]+)/i,
          // WeChat Desktop for Windows Built-in Browser
          /\bqbcore\/([\w\.]+).+microm/i], [VERSION, [NAME, "WeChat(Win) Desktop"]], [/micromessenger\/([\w\.]+)/i // WeChat
          ], [VERSION, [NAME, "WeChat"]], [/konqueror\/([\w\.]+)/i // Konqueror
          ], [VERSION, [NAME, "Konqueror"]], [/trident.+rv[: ]([\w\.]{1,9})\b.+like gecko/i // IE11
          ], [VERSION, [NAME, "IE"]], [/yabrowser\/([\w\.]+)/i // Yandex
          ], [VERSION, [NAME, "Yandex"]], [/(avast|avg)\/([\w\.]+)/i // Avast/AVG Secure Browser
          ], [[NAME, /(.+)/, "$1 Secure " + BROWSER], VERSION], [/\bfocus\/([\w\.]+)/i // Firefox Focus
          ], [VERSION, [NAME, FIREFOX + " Focus"]], [/\bopt\/([\w\.]+)/i // Opera Touch
          ], [VERSION, [NAME, OPERA + " Touch"]], [/coc_coc\w+\/([\w\.]+)/i // Coc Coc Browser
          ], [VERSION, [NAME, "Coc Coc"]], [/dolfin\/([\w\.]+)/i // Dolphin
          ], [VERSION, [NAME, "Dolphin"]], [/coast\/([\w\.]+)/i // Opera Coast
          ], [VERSION, [NAME, OPERA + " Coast"]], [/miuibrowser\/([\w\.]+)/i // MIUI Browser
          ], [VERSION, [NAME, "MIUI " + BROWSER]], [/fxios\/([-\w\.]+)/i // Firefox for iOS
          ], [VERSION, [NAME, FIREFOX]], [/\bqihu|(qi?ho?o?|360)browser/i // 360
          ], [[NAME, "360 " + BROWSER]], [/(oculus|samsung|sailfish|huawei)browser\/([\w\.]+)/i], [[NAME, /(.+)/, "$1 " + BROWSER], VERSION], [
          // Oculus/Samsung/Sailfish/Huawei Browser
          /(comodo_dragon)\/([\w\.]+)/i // Comodo Dragon
          ], [[NAME, /_/g, " "], VERSION], [/(electron)\/([\w\.]+) safari/i,
          // Electron-based App
          /(tesla)(?: qtcarbrowser|\/(20\d\d\.[-\w\.]+))/i,
          // Tesla
          /m?(qqbrowser|baiduboxapp|2345Explorer)[\/ ]?([\w\.]+)/i // QQBrowser/Baidu App/2345 Browser
          ], [NAME, VERSION], [/(metasr)[\/ ]?([\w\.]+)/i,
          // SouGouBrowser
          /(lbbrowser)/i,
          // LieBao Browser
          /\[(linkedin)app\]/i // LinkedIn App for iOS & Android
          ], [NAME], [
          // WebView
          /((?:fban\/fbios|fb_iab\/fb4a)(?!.+fbav)|;fbav\/([\w\.]+);)/i // Facebook App for iOS & Android
          ], [[NAME, FACEBOOK], VERSION], [/safari (line)\/([\w\.]+)/i,
          // Line App for iOS
          /\b(line)\/([\w\.]+)\/iab/i,
          // Line App for Android
          /(chromium|instagram)[\/ ]([-\w\.]+)/i // Chromium/Instagram
          ], [NAME, VERSION], [/\bgsa\/([\w\.]+) .*safari\//i // Google Search Appliance on iOS
          ], [VERSION, [NAME, "GSA"]], [/headlesschrome(?:\/([\w\.]+)| )/i // Chrome Headless
          ], [VERSION, [NAME, CHROME + " Headless"]], [/ wv\).+(chrome)\/([\w\.]+)/i // Chrome WebView
          ], [[NAME, CHROME + " WebView"], VERSION], [/droid.+ version\/([\w\.]+)\b.+(?:mobile safari|safari)/i // Android Browser
          ], [VERSION, [NAME, "Android " + BROWSER]], [/(chrome|omniweb|arora|[tizenoka]{5} ?browser)\/v?([\w\.]+)/i // Chrome/OmniWeb/Arora/Tizen/Nokia
          ], [NAME, VERSION], [/version\/([\w\.\,]+) .*mobile\/\w+ (safari)/i // Mobile Safari
          ], [VERSION, [NAME, "Mobile Safari"]], [/version\/([\w(\.|\,)]+) .*(mobile ?safari|safari)/i // Safari & Safari Mobile
          ], [VERSION, NAME], [/webkit.+?(mobile ?safari|safari)(\/[\w\.]+)/i // Safari < 3.0
          ], [NAME, [VERSION, strMapper, oldSafariMap]], [/(webkit|khtml)\/([\w\.]+)/i], [NAME, VERSION], [
          // Gecko based
          /(navigator|netscape\d?)\/([-\w\.]+)/i // Netscape
          ], [[NAME, "Netscape"], VERSION], [/mobile vr; rv:([\w\.]+)\).+firefox/i // Firefox Reality
          ], [VERSION, [NAME, FIREFOX + " Reality"]], [/ekiohf.+(flow)\/([\w\.]+)/i,
          // Flow
          /(swiftfox)/i,
          // Swiftfox
          /(icedragon|iceweasel|camino|chimera|fennec|maemo browser|minimo|conkeror|klar)[\/ ]?([\w\.\+]+)/i,
          // IceDragon/Iceweasel/Camino/Chimera/Fennec/Maemo/Minimo/Conkeror/Klar
          /(seamonkey|k-meleon|icecat|iceape|firebird|phoenix|palemoon|basilisk|waterfox)\/([-\w\.]+)$/i,
          // Firefox/SeaMonkey/K-Meleon/IceCat/IceApe/Firebird/Phoenix
          /(firefox)\/([\w\.]+)/i,
          // Other Firefox-based
          /(mozilla)\/([\w\.]+) .+rv\:.+gecko\/\d+/i,
          // Mozilla

          // Other
          /(polaris|lynx|dillo|icab|doris|amaya|w3m|netsurf|sleipnir|obigo|mosaic|(?:go|ice|up)[\. ]?browser)[-\/ ]?v?([\w\.]+)/i,
          // Polaris/Lynx/Dillo/iCab/Doris/Amaya/w3m/NetSurf/Sleipnir/Obigo/Mosaic/Go/ICE/UP.Browser
          /(links) \(([\w\.]+)/i // Links
          ], [NAME, VERSION], [/(cobalt)\/([\w\.]+)/i // Cobalt
          ], [NAME, [VERSION, /master.|lts./, ""]]],
          cpu: [[/(?:(amd|x(?:(?:86|64)[-_])?|wow|win)64)[;\)]/i // AMD64 (x64)
          ], [[ARCHITECTURE, "amd64"]], [/(ia32(?=;))/i // IA32 (quicktime)
          ], [[ARCHITECTURE, lowerize]], [/((?:i[346]|x)86)[;\)]/i // IA32 (x86)
          ], [[ARCHITECTURE, "ia32"]], [/\b(aarch64|arm(v?8e?l?|_?64))\b/i // ARM64
          ], [[ARCHITECTURE, "arm64"]], [/\b(arm(?:v[67])?ht?n?[fl]p?)\b/i // ARMHF
          ], [[ARCHITECTURE, "armhf"]], [
          // PocketPC mistakenly identified as PowerPC
          /windows (ce|mobile); ppc;/i], [[ARCHITECTURE, "arm"]], [/((?:ppc|powerpc)(?:64)?)(?: mac|;|\))/i // PowerPC
          ], [[ARCHITECTURE, /ower/, EMPTY, lowerize]], [/(sun4\w)[;\)]/i // SPARC
          ], [[ARCHITECTURE, "sparc"]], [/((?:avr32|ia64(?=;))|68k(?=\))|\barm(?=v(?:[1-7]|[5-7]1)l?|;|eabi)|(?=atmel )avr|(?:irix|mips|sparc)(?:64)?\b|pa-risc)/i
          // IA64, 68K, ARM/64, AVR/32, IRIX/64, MIPS/64, SPARC/64, PA-RISC
          ], [[ARCHITECTURE, lowerize]]],
          device: [[
          //////////////////////////
          // MOBILES & TABLETS
          // Ordered by popularity
          /////////////////////////

          // Samsung
          /\b(sch-i[89]0\d|shw-m380s|sm-[ptx]\w{2,4}|gt-[pn]\d{2,4}|sgh-t8[56]9|nexus 10)/i], [MODEL, [VENDOR, SAMSUNG], [TYPE, TABLET]], [/\b((?:s[cgp]h|gt|sm)-\w+|galaxy nexus)/i, /samsung[- ]([-\w]+)/i, /sec-(sgh\w+)/i], [MODEL, [VENDOR, SAMSUNG], [TYPE, MOBILE]], [
          // Apple
          /((ipod|iphone)\d+,\d+)/i // iPod/iPhone model
          ], [MODEL, [VENDOR, APPLE], [TYPE, MOBILE]], [/(ipad\d+,\d+)/i // iPad model
          ], [MODEL, [VENDOR, APPLE], [TYPE, TABLET]], [/\((ip(?:hone|od)[\w ]*);/i // iPod/iPhone
          ], [MODEL, [VENDOR, APPLE], [TYPE, MOBILE]], [/\((ipad);[-\w\),; ]+apple/i,
          // iPad
          /applecoremedia\/[\w\.]+ \((ipad)/i, /\b(ipad)\d\d?,\d\d?[;\]].+ios/i], [MODEL, [VENDOR, APPLE], [TYPE, TABLET]], [/(macintosh);/i], [MODEL, [VENDOR, APPLE]], [
          // Huawei
          /\b((?:ag[rs][23]?|bah2?|sht?|btv)-a?[lw]\d{2})\b(?!.+d\/s)/i], [MODEL, [VENDOR, HUAWEI], [TYPE, TABLET]], [/(?:huawei|honor)([-\w ]+)[;\)]/i, /\b(nexus 6p|\w{2,4}e?-[atu]?[ln][\dx][012359c][adn]?)\b(?!.+d\/s)/i], [MODEL, [VENDOR, HUAWEI], [TYPE, MOBILE]], [
          // Xiaomi
          /\b(poco[\w ]+)(?: bui|\))/i,
          // Xiaomi POCO
          /\b; (\w+) build\/hm\1/i,
          // Xiaomi Hongmi 'numeric' models
          /\b(hm[-_ ]?note?[_ ]?(?:\d\w)?) bui/i,
          // Xiaomi Hongmi
          /\b(redmi[\-_ ]?(?:note|k)?[\w_ ]+)(?: bui|\))/i,
          // Xiaomi Redmi
          /\b(mi[-_ ]?(?:a\d|one|one[_ ]plus|note lte|max|cc)?[_ ]?(?:\d?\w?)[_ ]?(?:plus|se|lite)?)(?: bui|\))/i // Xiaomi Mi
          ], [[MODEL, /_/g, " "], [VENDOR, XIAOMI], [TYPE, MOBILE]], [/\b(mi[-_ ]?(?:pad)(?:[\w_ ]+))(?: bui|\))/i // Mi Pad tablets
          ], [[MODEL, /_/g, " "], [VENDOR, XIAOMI], [TYPE, TABLET]], [
          // OPPO
          /; (\w+) bui.+ oppo/i, /\b(cph[12]\d{3}|p(?:af|c[al]|d\w|e[ar])[mt]\d0|x9007|a101op)\b/i], [MODEL, [VENDOR, "OPPO"], [TYPE, MOBILE]], [
          // Vivo
          /vivo (\w+)(?: bui|\))/i, /\b(v[12]\d{3}\w?[at])(?: bui|;)/i], [MODEL, [VENDOR, "Vivo"], [TYPE, MOBILE]], [
          // Realme
          /\b(rmx[12]\d{3})(?: bui|;|\))/i], [MODEL, [VENDOR, "Realme"], [TYPE, MOBILE]], [
          // Motorola
          /\b(milestone|droid(?:[2-4x]| (?:bionic|x2|pro|razr))?:?( 4g)?)\b[\w ]+build\//i, /\bmot(?:orola)?[- ](\w*)/i, /((?:moto[\w\(\) ]+|xt\d{3,4}|nexus 6)(?= bui|\)))/i], [MODEL, [VENDOR, MOTOROLA], [TYPE, MOBILE]], [/\b(mz60\d|xoom[2 ]{0,2}) build\//i], [MODEL, [VENDOR, MOTOROLA], [TYPE, TABLET]], [
          // LG
          /((?=lg)?[vl]k\-?\d{3}) bui| 3\.[-\w; ]{10}lg?-([06cv9]{3,4})/i], [MODEL, [VENDOR, LG], [TYPE, TABLET]], [/(lm(?:-?f100[nv]?|-[\w\.]+)(?= bui|\))|nexus [45])/i, /\blg[-e;\/ ]+((?!browser|netcast|android tv)\w+)/i, /\blg-?([\d\w]+) bui/i], [MODEL, [VENDOR, LG], [TYPE, MOBILE]], [
          // Lenovo
          /(ideatab[-\w ]+)/i, /lenovo ?(s[56]000[-\w]+|tab(?:[\w ]+)|yt[-\d\w]{6}|tb[-\d\w]{6})/i], [MODEL, [VENDOR, "Lenovo"], [TYPE, TABLET]], [
          // Nokia
          /(?:maemo|nokia).*(n900|lumia \d+)/i, /nokia[-_ ]?([-\w\.]*)/i], [[MODEL, /_/g, " "], [VENDOR, "Nokia"], [TYPE, MOBILE]], [
          // Google
          /(pixel c)\b/i // Google Pixel C
          ], [MODEL, [VENDOR, GOOGLE], [TYPE, TABLET]], [/droid.+; (pixel[\daxl ]{0,6})(?: bui|\))/i // Google Pixel
          ], [MODEL, [VENDOR, GOOGLE], [TYPE, MOBILE]], [
          // Sony
          /droid.+ (a?\d[0-2]{2}so|[c-g]\d{4}|so[-gl]\w+|xq-a\w[4-7][12])(?= bui|\).+chrome\/(?![1-6]{0,1}\d\.))/i], [MODEL, [VENDOR, SONY], [TYPE, MOBILE]], [/sony tablet [ps]/i, /\b(?:sony)?sgp\w+(?: bui|\))/i], [[MODEL, "Xperia Tablet"], [VENDOR, SONY], [TYPE, TABLET]], [
          // OnePlus
          / (kb2005|in20[12]5|be20[12][59])\b/i, /(?:one)?(?:plus)? (a\d0\d\d)(?: b|\))/i], [MODEL, [VENDOR, "OnePlus"], [TYPE, MOBILE]], [
          // Amazon
          /(alexa)webm/i, /(kf[a-z]{2}wi)( bui|\))/i,
          // Kindle Fire without Silk
          /(kf[a-z]+)( bui|\)).+silk\//i // Kindle Fire HD
          ], [MODEL, [VENDOR, AMAZON], [TYPE, TABLET]], [/((?:sd|kf)[0349hijorstuw]+)( bui|\)).+silk\//i // Fire Phone
          ], [[MODEL, /(.+)/g, "Fire Phone $1"], [VENDOR, AMAZON], [TYPE, MOBILE]], [
          // BlackBerry
          /(playbook);[-\w\),; ]+(rim)/i // BlackBerry PlayBook
          ], [MODEL, VENDOR, [TYPE, TABLET]], [/\b((?:bb[a-f]|st[hv])100-\d)/i, /\(bb10; (\w+)/i // BlackBerry 10
          ], [MODEL, [VENDOR, BLACKBERRY], [TYPE, MOBILE]], [
          // Asus
          /(?:\b|asus_)(transfo[prime ]{4,10} \w+|eeepc|slider \w+|nexus 7|padfone|p00[cj])/i], [MODEL, [VENDOR, ASUS], [TYPE, TABLET]], [/ (z[bes]6[027][012][km][ls]|zenfone \d\w?)\b/i], [MODEL, [VENDOR, ASUS], [TYPE, MOBILE]], [
          // HTC
          /(nexus 9)/i // HTC Nexus 9
          ], [MODEL, [VENDOR, "HTC"], [TYPE, TABLET]], [/(htc)[-;_ ]{1,2}([\w ]+(?=\)| bui)|\w+)/i,
          // HTC

          // ZTE
          /(zte)[- ]([\w ]+?)(?: bui|\/|\))/i, /(alcatel|geeksphone|nexian|panasonic|sony(?!-bra))[-_ ]?([-\w]*)/i // Alcatel/GeeksPhone/Nexian/Panasonic/Sony
          ], [VENDOR, [MODEL, /_/g, " "], [TYPE, MOBILE]], [
          // Acer
          /droid.+; ([ab][1-7]-?[0178a]\d\d?)/i], [MODEL, [VENDOR, "Acer"], [TYPE, TABLET]], [
          // Meizu
          /droid.+; (m[1-5] note) bui/i, /\bmz-([-\w]{2,})/i], [MODEL, [VENDOR, "Meizu"], [TYPE, MOBILE]], [
          // Sharp
          /\b(sh-?[altvz]?\d\d[a-ekm]?)/i], [MODEL, [VENDOR, SHARP], [TYPE, MOBILE]], [
          // MIXED
          /(blackberry|benq|palm(?=\-)|sonyericsson|acer|asus|dell|meizu|motorola|polytron)[-_ ]?([-\w]*)/i,
          // BlackBerry/BenQ/Palm/Sony-Ericsson/Acer/Asus/Dell/Meizu/Motorola/Polytron
          /(hp) ([\w ]+\w)/i,
          // HP iPAQ
          /(asus)-?(\w+)/i,
          // Asus
          /(microsoft); (lumia[\w ]+)/i,
          // Microsoft Lumia
          /(lenovo)[-_ ]?([-\w]+)/i,
          // Lenovo
          /(jolla)/i,
          // Jolla
          /(oppo) ?([\w ]+) bui/i // OPPO
          ], [VENDOR, MODEL, [TYPE, MOBILE]], [/(archos) (gamepad2?)/i,
          // Archos
          /(hp).+(touchpad(?!.+tablet)|tablet)/i,
          // HP TouchPad
          /(kindle)\/([\w\.]+)/i,
          // Kindle
          /(nook)[\w ]+build\/(\w+)/i,
          // Nook
          /(dell) (strea[kpr\d ]*[\dko])/i,
          // Dell Streak
          /(le[- ]+pan)[- ]+(\w{1,9}) bui/i,
          // Le Pan Tablets
          /(trinity)[- ]*(t\d{3}) bui/i,
          // Trinity Tablets
          /(gigaset)[- ]+(q\w{1,9}) bui/i,
          // Gigaset Tablets
          /(vodafone) ([\w ]+)(?:\)| bui)/i // Vodafone
          ], [VENDOR, MODEL, [TYPE, TABLET]], [/(surface duo)/i // Surface Duo
          ], [MODEL, [VENDOR, MICROSOFT], [TYPE, TABLET]], [/droid [\d\.]+; (fp\du?)(?: b|\))/i // Fairphone
          ], [MODEL, [VENDOR, "Fairphone"], [TYPE, MOBILE]], [/(u304aa)/i // AT&T
          ], [MODEL, [VENDOR, "AT&T"], [TYPE, MOBILE]], [/\bsie-(\w*)/i // Siemens
          ], [MODEL, [VENDOR, "Siemens"], [TYPE, MOBILE]], [/\b(rct\w+) b/i // RCA Tablets
          ], [MODEL, [VENDOR, "RCA"], [TYPE, TABLET]], [/\b(venue[\d ]{2,7}) b/i // Dell Venue Tablets
          ], [MODEL, [VENDOR, "Dell"], [TYPE, TABLET]], [/\b(q(?:mv|ta)\w+) b/i // Verizon Tablet
          ], [MODEL, [VENDOR, "Verizon"], [TYPE, TABLET]], [/\b(?:barnes[& ]+noble |bn[rt])([\w\+ ]*) b/i // Barnes & Noble Tablet
          ], [MODEL, [VENDOR, "Barnes & Noble"], [TYPE, TABLET]], [/\b(tm\d{3}\w+) b/i], [MODEL, [VENDOR, "NuVision"], [TYPE, TABLET]], [/\b(k88) b/i // ZTE K Series Tablet
          ], [MODEL, [VENDOR, "ZTE"], [TYPE, TABLET]], [/\b(nx\d{3}j) b/i // ZTE Nubia
          ], [MODEL, [VENDOR, "ZTE"], [TYPE, MOBILE]], [/\b(gen\d{3}) b.+49h/i // Swiss GEN Mobile
          ], [MODEL, [VENDOR, "Swiss"], [TYPE, MOBILE]], [/\b(zur\d{3}) b/i // Swiss ZUR Tablet
          ], [MODEL, [VENDOR, "Swiss"], [TYPE, TABLET]], [/\b((zeki)?tb.*\b) b/i // Zeki Tablets
          ], [MODEL, [VENDOR, "Zeki"], [TYPE, TABLET]], [/\b([yr]\d{2}) b/i, /\b(dragon[- ]+touch |dt)(\w{5}) b/i // Dragon Touch Tablet
          ], [[VENDOR, "Dragon Touch"], MODEL, [TYPE, TABLET]], [/\b(ns-?\w{0,9}) b/i // Insignia Tablets
          ], [MODEL, [VENDOR, "Insignia"], [TYPE, TABLET]], [/\b((nxa|next)-?\w{0,9}) b/i // NextBook Tablets
          ], [MODEL, [VENDOR, "NextBook"], [TYPE, TABLET]], [/\b(xtreme\_)?(v(1[045]|2[015]|[3469]0|7[05])) b/i // Voice Xtreme Phones
          ], [[VENDOR, "Voice"], MODEL, [TYPE, MOBILE]], [/\b(lvtel\-)?(v1[12]) b/i // LvTel Phones
          ], [[VENDOR, "LvTel"], MODEL, [TYPE, MOBILE]], [/\b(ph-1) /i // Essential PH-1
          ], [MODEL, [VENDOR, "Essential"], [TYPE, MOBILE]], [/\b(v(100md|700na|7011|917g).*\b) b/i // Envizen Tablets
          ], [MODEL, [VENDOR, "Envizen"], [TYPE, TABLET]], [/\b(trio[-\w\. ]+) b/i // MachSpeed Tablets
          ], [MODEL, [VENDOR, "MachSpeed"], [TYPE, TABLET]], [/\btu_(1491) b/i // Rotor Tablets
          ], [MODEL, [VENDOR, "Rotor"], [TYPE, TABLET]], [/(shield[\w ]+) b/i // Nvidia Shield Tablets
          ], [MODEL, [VENDOR, "Nvidia"], [TYPE, TABLET]], [/(sprint) (\w+)/i // Sprint Phones
          ], [VENDOR, MODEL, [TYPE, MOBILE]], [/(kin\.[onetw]{3})/i // Microsoft Kin
          ], [[MODEL, /\./g, " "], [VENDOR, MICROSOFT], [TYPE, MOBILE]], [/droid.+; (cc6666?|et5[16]|mc[239][23]x?|vc8[03]x?)\)/i // Zebra
          ], [MODEL, [VENDOR, ZEBRA], [TYPE, TABLET]], [/droid.+; (ec30|ps20|tc[2-8]\d[kx])\)/i], [MODEL, [VENDOR, ZEBRA], [TYPE, MOBILE]], [
          ///////////////////
          // CONSOLES
          ///////////////////

          /(ouya)/i,
          // Ouya
          /(nintendo) ([wids3utch]+)/i // Nintendo
          ], [VENDOR, MODEL, [TYPE, CONSOLE]], [/droid.+; (shield) bui/i // Nvidia
          ], [MODEL, [VENDOR, "Nvidia"], [TYPE, CONSOLE]], [/(playstation [345portablevi]+)/i // Playstation
          ], [MODEL, [VENDOR, SONY], [TYPE, CONSOLE]], [/\b(xbox(?: one)?(?!; xbox))[\); ]/i // Microsoft Xbox
          ], [MODEL, [VENDOR, MICROSOFT], [TYPE, CONSOLE]], [
          ///////////////////
          // SMARTTVS
          ///////////////////

          /smart-tv.+(samsung)/i // Samsung
          ], [VENDOR, [TYPE, SMARTTV]], [/hbbtv.+maple;(\d+)/i], [[MODEL, /^/, "SmartTV"], [VENDOR, SAMSUNG], [TYPE, SMARTTV]], [/(nux; netcast.+smarttv|lg (netcast\.tv-201\d|android tv))/i // LG SmartTV
          ], [[VENDOR, LG], [TYPE, SMARTTV]], [/(apple) ?tv/i // Apple TV
          ], [VENDOR, [MODEL, APPLE + " TV"], [TYPE, SMARTTV]], [/crkey/i // Google Chromecast
          ], [[MODEL, CHROME + "cast"], [VENDOR, GOOGLE], [TYPE, SMARTTV]], [/droid.+aft(\w)( bui|\))/i // Fire TV
          ], [MODEL, [VENDOR, AMAZON], [TYPE, SMARTTV]], [/\(dtv[\);].+(aquos)/i, /(aquos-tv[\w ]+)\)/i // Sharp
          ], [MODEL, [VENDOR, SHARP], [TYPE, SMARTTV]], [/(bravia[\w ]+)( bui|\))/i // Sony
          ], [MODEL, [VENDOR, SONY], [TYPE, SMARTTV]], [/(mitv-\w{5}) bui/i // Xiaomi
          ], [MODEL, [VENDOR, XIAOMI], [TYPE, SMARTTV]], [/\b(roku)[\dx]*[\)\/]((?:dvp-)?[\d\.]*)/i,
          // Roku
          /hbbtv\/\d+\.\d+\.\d+ +\([\w ]*; *(\w[^;]*);([^;]*)/i // HbbTV devices
          ], [[VENDOR, trim], [MODEL, trim], [TYPE, SMARTTV]], [/\b(android tv|smart[- ]?tv|opera tv|tv; rv:)\b/i // SmartTV from Unidentified Vendors
          ], [[TYPE, SMARTTV]], [
          ///////////////////
          // WEARABLES
          ///////////////////

          /((pebble))app/i // Pebble
          ], [VENDOR, MODEL, [TYPE, WEARABLE]], [/droid.+; (glass) \d/i // Google Glass
          ], [MODEL, [VENDOR, GOOGLE], [TYPE, WEARABLE]], [/droid.+; (wt63?0{2,3})\)/i], [MODEL, [VENDOR, ZEBRA], [TYPE, WEARABLE]], [/(quest( 2)?)/i // Oculus Quest
          ], [MODEL, [VENDOR, FACEBOOK], [TYPE, WEARABLE]], [
          ///////////////////
          // EMBEDDED
          ///////////////////

          /(tesla)(?: qtcarbrowser|\/[-\w\.]+)/i // Tesla
          ], [VENDOR, [TYPE, EMBEDDED]], [
          ////////////////////
          // MIXED (GENERIC)
          ///////////////////

          /droid .+?; ([^;]+?)(?: bui|\) applew).+? mobile safari/i // Android Phones from Unidentified Vendors
          ], [MODEL, [TYPE, MOBILE]], [/droid .+?; ([^;]+?)(?: bui|\) applew).+?(?! mobile) safari/i // Android Tablets from Unidentified Vendors
          ], [MODEL, [TYPE, TABLET]], [/\b((tablet|tab)[;\/]|focus\/\d(?!.+mobile))/i // Unidentifiable Tablet
          ], [[TYPE, TABLET]], [/(phone|mobile(?:[;\/]| [ \w\/\.]*safari)|pda(?=.+windows ce))/i // Unidentifiable Mobile
          ], [[TYPE, MOBILE]], [/(android[-\w\. ]{0,9});.+buil/i // Generic Android Device
          ], [MODEL, [VENDOR, "Generic"]]],
          engine: [[/windows.+ edge\/([\w\.]+)/i // EdgeHTML
          ], [VERSION, [NAME, EDGE + "HTML"]], [/webkit\/537\.36.+chrome\/(?!27)([\w\.]+)/i // Blink
          ], [VERSION, [NAME, "Blink"]], [/(presto)\/([\w\.]+)/i,
          // Presto
          /(webkit|trident|netfront|netsurf|amaya|lynx|w3m|goanna)\/([\w\.]+)/i,
          // WebKit/Trident/NetFront/NetSurf/Amaya/Lynx/w3m/Goanna
          /ekioh(flow)\/([\w\.]+)/i,
          // Flow
          /(khtml|tasman|links)[\/ ]\(?([\w\.]+)/i,
          // KHTML/Tasman/Links
          /(icab)[\/ ]([23]\.[\d\.]+)/i // iCab
          ], [NAME, VERSION], [/rv\:([\w\.]{1,9})\b.+(gecko)/i // Gecko
          ], [VERSION, NAME]],
          os: [[
          // Windows
          /microsoft (windows) (vista|xp)/i // Windows (iTunes)
          ], [NAME, VERSION], [/(windows) nt 6\.2; (arm)/i,
          // Windows RT
          /(windows (?:phone(?: os)?|mobile))[\/ ]?([\d\.\w ]*)/i,
          // Windows Phone
          /(windows)[\/ ]?([ntce\d\. ]+\w)(?!.+xbox)/i], [NAME, [VERSION, strMapper, windowsVersionMap]], [/(win(?=3|9|n)|win 9x )([nt\d\.]+)/i], [[NAME, "Windows"], [VERSION, strMapper, windowsVersionMap]], [
          // iOS/macOS
          /ip[honead]{2,4}\b(?:.*os ([\w]+) like mac|; opera)/i,
          // iOS
          /cfnetwork\/.+darwin/i], [[VERSION, /_/g, "."], [NAME, "iOS"]], [/(mac os x) ?([\w\. ]*)/i, /(macintosh|mac_powerpc\b)(?!.+haiku)/i // Mac OS
          ], [[NAME, "Mac OS"], [VERSION, /_/g, "."]], [
          // Mobile OSes
          /droid ([\w\.]+)\b.+(android[- ]x86|harmonyos)/i // Android-x86/HarmonyOS
          ], [VERSION, NAME], [
          // Android/WebOS/QNX/Bada/RIM/Maemo/MeeGo/Sailfish OS
          /(android|webos|qnx|bada|rim tablet os|maemo|meego|sailfish)[-\/ ]?([\w\.]*)/i, /(blackberry)\w*\/([\w\.]*)/i,
          // Blackberry
          /(tizen|kaios)[\/ ]([\w\.]+)/i,
          // Tizen/KaiOS
          /\((series40);/i // Series 40
          ], [NAME, VERSION], [/\(bb(10);/i // BlackBerry 10
          ], [VERSION, [NAME, BLACKBERRY]], [/(?:symbian ?os|symbos|s60(?=;)|series60)[-\/ ]?([\w\.]*)/i // Symbian
          ], [VERSION, [NAME, "Symbian"]], [/mozilla\/[\d\.]+ \((?:mobile|tablet|tv|mobile; [\w ]+); rv:.+ gecko\/([\w\.]+)/i // Firefox OS
          ], [VERSION, [NAME, FIREFOX + " OS"]], [/web0s;.+rt(tv)/i, /\b(?:hp)?wos(?:browser)?\/([\w\.]+)/i // WebOS
          ], [VERSION, [NAME, "webOS"]], [
          // Google Chromecast
          /crkey\/([\d\.]+)/i // Google Chromecast
          ], [VERSION, [NAME, CHROME + "cast"]], [/(cros) [\w]+ ([\w\.]+\w)/i // Chromium OS
          ], [[NAME, "Chromium OS"], VERSION], [
          // Console
          /(nintendo|playstation) ([wids345portablevuch]+)/i,
          // Nintendo/Playstation
          /(xbox); +xbox ([^\);]+)/i,
          // Microsoft Xbox (360, One, X, S, Series X, Series S)

          // Other
          /\b(joli|palm)\b ?(?:os)?\/?([\w\.]*)/i,
          // Joli/Palm
          /(mint)[\/\(\) ]?(\w*)/i,
          // Mint
          /(mageia|vectorlinux)[; ]/i,
          // Mageia/VectorLinux
          /([kxln]?ubuntu|debian|suse|opensuse|gentoo|arch(?= linux)|slackware|fedora|mandriva|centos|pclinuxos|red ?hat|zenwalk|linpus|raspbian|plan 9|minix|risc os|contiki|deepin|manjaro|elementary os|sabayon|linspire)(?: gnu\/linux)?(?: enterprise)?(?:[- ]linux)?(?:-gnu)?[-\/ ]?(?!chrom|package)([-\w\.]*)/i,
          // Ubuntu/Debian/SUSE/Gentoo/Arch/Slackware/Fedora/Mandriva/CentOS/PCLinuxOS/RedHat/Zenwalk/Linpus/Raspbian/Plan9/Minix/RISCOS/Contiki/Deepin/Manjaro/elementary/Sabayon/Linspire
          /(hurd|linux) ?([\w\.]*)/i,
          // Hurd/Linux
          /(gnu) ?([\w\.]*)/i,
          // GNU
          /\b([-frentopcghs]{0,5}bsd|dragonfly)[\/ ]?(?!amd|[ix346]{1,2}86)([\w\.]*)/i,
          // FreeBSD/NetBSD/OpenBSD/PC-BSD/GhostBSD/DragonFly
          /(haiku) (\w+)/i // Haiku
          ], [NAME, VERSION], [/(sunos) ?([\w\.\d]*)/i // Solaris
          ], [[NAME, "Solaris"], VERSION], [/((?:open)?solaris)[-\/ ]?([\w\.]*)/i,
          // Solaris
          /(aix) ((\d)(?=\.|\)| )[\w\.])*/i,
          // AIX
          /\b(beos|os\/2|amigaos|morphos|openvms|fuchsia|hp-ux)/i,
          // BeOS/OS2/AmigaOS/MorphOS/OpenVMS/Fuchsia/HP-UX
          /(unix) ?([\w\.]*)/i // UNIX
          ], [NAME, VERSION]]
        };

        /////////////////
        // Constructor
        ////////////////

        var UAParser = function (ua, extensions) {
          if (typeof ua === OBJ_TYPE) {
            extensions = ua;
            ua = undefined$1;
          }
          if (!(this instanceof UAParser)) {
            return new UAParser(ua, extensions).getResult();
          }
          var _ua = ua || (typeof window !== UNDEF_TYPE && window.navigator && window.navigator.userAgent ? window.navigator.userAgent : EMPTY);
          var _rgxmap = extensions ? extend(regexes, extensions) : regexes;
          this.getBrowser = function () {
            var _browser = {};
            _browser[NAME] = undefined$1;
            _browser[VERSION] = undefined$1;
            rgxMapper.call(_browser, _ua, _rgxmap.browser);
            _browser.major = majorize(_browser.version);
            return _browser;
          };
          this.getCPU = function () {
            var _cpu = {};
            _cpu[ARCHITECTURE] = undefined$1;
            rgxMapper.call(_cpu, _ua, _rgxmap.cpu);
            return _cpu;
          };
          this.getDevice = function () {
            var _device = {};
            _device[VENDOR] = undefined$1;
            _device[MODEL] = undefined$1;
            _device[TYPE] = undefined$1;
            rgxMapper.call(_device, _ua, _rgxmap.device);
            return _device;
          };
          this.getEngine = function () {
            var _engine = {};
            _engine[NAME] = undefined$1;
            _engine[VERSION] = undefined$1;
            rgxMapper.call(_engine, _ua, _rgxmap.engine);
            return _engine;
          };
          this.getOS = function () {
            var _os = {};
            _os[NAME] = undefined$1;
            _os[VERSION] = undefined$1;
            rgxMapper.call(_os, _ua, _rgxmap.os);
            return _os;
          };
          this.getResult = function () {
            return {
              ua: this.getUA(),
              browser: this.getBrowser(),
              engine: this.getEngine(),
              os: this.getOS(),
              device: this.getDevice(),
              cpu: this.getCPU()
            };
          };
          this.getUA = function () {
            return _ua;
          };
          this.setUA = function (ua) {
            _ua = typeof ua === STR_TYPE && ua.length > UA_MAX_LENGTH ? trim(ua, UA_MAX_LENGTH) : ua;
            return this;
          };
          this.setUA(_ua);
          return this;
        };
        UAParser.VERSION = LIBVERSION;
        UAParser.BROWSER = enumerize([NAME, VERSION, MAJOR]);
        UAParser.CPU = enumerize([ARCHITECTURE]);
        UAParser.DEVICE = enumerize([MODEL, VENDOR, TYPE, CONSOLE, MOBILE, SMARTTV, TABLET, WEARABLE, EMBEDDED]);
        UAParser.ENGINE = UAParser.OS = enumerize([NAME, VERSION]);

        ///////////
        // Export
        //////////

        // check js environment
        {
          // nodejs env
          if (module.exports) {
            exports = module.exports = UAParser;
          }
          exports.UAParser = UAParser;
        }

        // jQuery/Zepto specific (optional)
        // Note:
        //   In AMD env the global scope should be kept clean, but jQuery is an exception.
        //   jQuery always exports to global scope, unless jQuery.noConflict(true) is used,
        //   and we should catch that.
        var $ = typeof window !== UNDEF_TYPE && (window.jQuery || window.Zepto);
        if ($ && !$.ua) {
          var parser = new UAParser();
          $.ua = parser.getResult();
          $.ua.get = function () {
            return parser.getUA();
          };
          $.ua.set = function (ua) {
            parser.setUA(ua);
            var result = parser.getResult();
            for (var prop in result) {
              $.ua[prop] = result[prop];
            }
          };
        }
      })(typeof window === "object" ? window : commonjsGlobal);
    });

    var SessionStorage = /** @class */ (function () {
        function SessionStorage() {
            this.globalScope = getGlobalScope();
        }
        SessionStorage.prototype.get = function (key) {
            var _a;
            return (_a = this.globalScope) === null || _a === void 0 ? void 0 : _a.sessionStorage.getItem(key);
        };
        SessionStorage.prototype.put = function (key, value) {
            var _a;
            (_a = this.globalScope) === null || _a === void 0 ? void 0 : _a.sessionStorage.setItem(key, value);
        };
        SessionStorage.prototype.delete = function (key) {
            var _a;
            (_a = this.globalScope) === null || _a === void 0 ? void 0 : _a.sessionStorage.removeItem(key);
        };
        return SessionStorage;
    }());

    var DefaultUserProvider = /** @class */ (function () {
        function DefaultUserProvider(userProvider, apiKey) {
            var _a, _b, _c;
            this.globalScope = getGlobalScope();
            this.ua = new uaParser.UAParser(typeof ((_a = this.globalScope) === null || _a === void 0 ? void 0 : _a.navigator) !== 'undefined'
                ? (_b = this.globalScope) === null || _b === void 0 ? void 0 : _b.navigator.userAgent
                : null).getResult();
            this.localStorage = new LocalStorage();
            this.sessionStorage = new SessionStorage();
            this.userProvider = userProvider;
            this.apiKey = apiKey;
            this.storageKey = "EXP_".concat((_c = this.apiKey) === null || _c === void 0 ? void 0 : _c.slice(0, 10), "_DEFAULT_USER_PROVIDER");
        }
        DefaultUserProvider.prototype.getUser = function () {
            var _a, _b, _c, _d, _e;
            var user = ((_a = this.userProvider) === null || _a === void 0 ? void 0 : _a.getUser()) || {};
            return __assign$2({ language: this.getLanguage(), platform: 'Web', os: this.getOs(this.ua), device_model: this.getDeviceModel(this.ua), device_category: (_c = (_b = this.ua.device) === null || _b === void 0 ? void 0 : _b.type) !== null && _c !== void 0 ? _c : 'desktop', referring_url: (_e = (_d = this.globalScope) === null || _d === void 0 ? void 0 : _d.document) === null || _e === void 0 ? void 0 : _e.referrer.replace(/\/$/, ''), cookie: this.getCookie(), browser: this.getBrowser(this.ua), landing_url: this.getLandingUrl(), first_seen: this.getFirstSeen(), url_param: this.getUrlParam() }, user);
        };
        DefaultUserProvider.prototype.getLanguage = function () {
            return ((typeof navigator !== 'undefined' &&
                ((navigator.languages && navigator.languages[0]) ||
                    navigator.language)) ||
                '');
        };
        DefaultUserProvider.prototype.getOs = function (ua) {
            var _a, _b;
            return [(_a = ua.browser) === null || _a === void 0 ? void 0 : _a.name, (_b = ua.browser) === null || _b === void 0 ? void 0 : _b.major]
                .filter(function (e) { return e !== null && e !== undefined; })
                .join(' ');
        };
        DefaultUserProvider.prototype.getDeviceModel = function (ua) {
            var _a;
            return (_a = ua.os) === null || _a === void 0 ? void 0 : _a.name;
        };
        DefaultUserProvider.prototype.getBrowser = function (ua) {
            var _a;
            var browser = (_a = ua.browser) === null || _a === void 0 ? void 0 : _a.name;
            // Normalize for Chrome, Firefox, Safari, Edge, and Opera.
            if (browser === null || browser === void 0 ? void 0 : browser.includes('Chrom'))
                browser = 'Chrome'; // Chrome, Chrome Mobile, Chromium, etc
            if (browser === null || browser === void 0 ? void 0 : browser.includes('Firefox'))
                browser = 'Firefox'; // Firefox, Firefox Mobile, etc
            if (browser === null || browser === void 0 ? void 0 : browser.includes('Safari'))
                browser = 'Safari'; // Safari, Safari Mobile
            if (browser === null || browser === void 0 ? void 0 : browser.includes('Edge'))
                browser = 'Edge'; // Edge
            if (browser === null || browser === void 0 ? void 0 : browser.includes('Opera'))
                browser = 'Opera'; // Opera, Opera Mobi, etc
            return browser;
        };
        DefaultUserProvider.prototype.getCookie = function () {
            var _a, _b, _c, _d, _e;
            if (!((_b = (_a = this.globalScope) === null || _a === void 0 ? void 0 : _a.document) === null || _b === void 0 ? void 0 : _b.cookie)) {
                return undefined;
            }
            return Object.fromEntries((_e = (_d = (_c = this.globalScope) === null || _c === void 0 ? void 0 : _c.document) === null || _d === void 0 ? void 0 : _d.cookie) === null || _e === void 0 ? void 0 : _e.split('; ').map(function (c) { return c.split('='); }));
        };
        DefaultUserProvider.prototype.getLandingUrl = function () {
            var _a, _b;
            try {
                var sessionUser = JSON.parse(this.sessionStorage.get(this.storageKey) || '{}');
                if (!sessionUser.landing_url) {
                    sessionUser.landing_url = (_b = (_a = this.globalScope) === null || _a === void 0 ? void 0 : _a.location) === null || _b === void 0 ? void 0 : _b.href.replace(/\/$/, '');
                    this.sessionStorage.put(this.storageKey, JSON.stringify(sessionUser));
                }
                return sessionUser.landing_url;
            }
            catch (_c) {
                return undefined;
            }
        };
        DefaultUserProvider.prototype.getFirstSeen = function () {
            try {
                var localUser = JSON.parse(this.localStorage.get(this.storageKey) || '{}');
                if (!localUser.first_seen) {
                    localUser.first_seen = (Date.now() / 1000).toString();
                    this.localStorage.put(this.storageKey, JSON.stringify(localUser));
                }
                return localUser.first_seen;
            }
            catch (_a) {
                return undefined;
            }
        };
        DefaultUserProvider.prototype.getUrlParam = function () {
            var e_1, _a;
            var _b, _c, _d;
            if (!this.globalScope) {
                return {};
            }
            var params = {};
            try {
                for (var _e = __values$2(new URL((_c = (_b = this.globalScope) === null || _b === void 0 ? void 0 : _b.location) === null || _c === void 0 ? void 0 : _c.href)
                    .searchParams), _f = _e.next(); !_f.done; _f = _e.next()) {
                    var _g = __read$2(_f.value, 2), name_1 = _g[0], value = _g[1];
                    params[name_1] = __spreadArray$1(__spreadArray$1([], __read$2(((_d = params[name_1]) !== null && _d !== void 0 ? _d : [])), false), __read$2(value.split(',')), false);
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (_f && !_f.done && (_a = _e.return)) _a.call(_e);
                }
                finally { if (e_1) throw e_1.error; }
            }
            return Object.entries(params).reduce(function (acc, _a) {
                var _b = __read$2(_a, 2), name = _b[0], value = _b[1];
                acc[name] = value.length == 1 ? value[0] : value;
                return acc;
            }, {});
        };
        return DefaultUserProvider;
    }());

    var instances = {};
    var getInstanceName = function (config) {
        return (config === null || config === void 0 ? void 0 : config.instanceName) || Defaults.instanceName;
    };
    /**
     * Initializes a singleton {@link ExperimentClient} identified by the configured
     * instance name.
     *
     * @param apiKey The deployment API Key
     * @param config See {@link ExperimentConfig} for config options
     */
    var initialize = function (apiKey, config) {
        // Store instances by appending the instance name and api key. Allows for
        // initializing multiple default instances for different api keys.
        var instanceName = getInstanceName(config);
        var instanceKey = "".concat(instanceName, ".").concat(apiKey);
        if (!instances[instanceKey]) {
            config = __assign$2(__assign$2({}, config), { userProvider: new DefaultUserProvider(config === null || config === void 0 ? void 0 : config.userProvider, apiKey) });
            instances[instanceKey] = new ExperimentClient(apiKey, config);
        }
        return instances[instanceKey];
    };
    /**
     * Initialize a singleton {@link ExperimentClient} which automatically
     * integrates with the installed and initialized instance of the amplitude
     * analytics SDK.
     *
     * You must be using amplitude-js SDK version 8.17.0+ for this integration to
     * work.
     *
     * @param apiKey The deployment API Key
     * @param config See {@link ExperimentConfig} for config options
     */
    var initializeWithAmplitudeAnalytics = function (apiKey, config) {
        var instanceName = getInstanceName(config);
        var client = initialize(apiKey, config);
        client.addPlugin(new AmplitudeIntegrationPlugin(apiKey, AnalyticsConnector.getInstance(instanceName), 10000));
        return client;
    };
    /**
     * Provides factory methods for storing singleton instances of {@link ExperimentClient}
     * @category Core Usage
     */
    var Experiment = {
        initialize: initialize,
        initializeWithAmplitudeAnalytics: initializeWithAmplitudeAnalytics,
    };

    /**
     * A stub {@link Client} implementation that does nothing for all methods
     */
    var StubExperimentClient = /** @class */ (function () {
        function StubExperimentClient() {
        }
        StubExperimentClient.prototype.getUser = function () {
            return {};
        };
        StubExperimentClient.prototype.start = function (user) {
            return __awaiter$1(this, void 0, void 0, function () {
                return __generator$1(this, function (_a) {
                    return [2 /*return*/];
                });
            });
        };
        StubExperimentClient.prototype.stop = function () { };
        StubExperimentClient.prototype.setUser = function (user) { };
        StubExperimentClient.prototype.fetch = function (user) {
            return __awaiter$1(this, void 0, void 0, function () {
                return __generator$1(this, function (_a) {
                    return [2 /*return*/, this];
                });
            });
        };
        StubExperimentClient.prototype.getUserProvider = function () {
            return null;
        };
        StubExperimentClient.prototype.setUserProvider = function (uerProvider) {
            return this;
        };
        StubExperimentClient.prototype.variant = function (key, fallback) {
            return Defaults.fallbackVariant;
        };
        StubExperimentClient.prototype.all = function () {
            return {};
        };
        StubExperimentClient.prototype.clear = function () { };
        StubExperimentClient.prototype.exposure = function (key) { };
        return StubExperimentClient;
    }());

    exports.AmplitudeAnalyticsProvider = AmplitudeAnalyticsProvider;
    exports.AmplitudeIntegrationPlugin = AmplitudeIntegrationPlugin;
    exports.AmplitudeUserProvider = AmplitudeUserProvider;
    exports.Experiment = Experiment;
    exports.ExperimentClient = ExperimentClient;
    exports.StubExperimentClient = StubExperimentClient;

    Object.defineProperty(exports, '__esModule', { value: true });

}));
