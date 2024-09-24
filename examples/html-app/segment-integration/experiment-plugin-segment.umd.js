(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
    typeof define === 'function' && define.amd ? define(['exports'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.Experiment = {}));
})(this, (function (exports) { 'use strict';

    var safeGlobal = typeof globalThis !== 'undefined'
        ? globalThis
        : typeof global !== 'undefined'
            ? global
            : self;

    /**
     * Copied and modified from https://github.com/segmentio/snippet/blob/master/template/snippet.js
     *
     * This function will set up proxy stubs for functions used by the segment plugin
     *
     * @param instanceKey the key for the analytics instance on the global object.
     */
    var snippetInstance = function (instanceKey) {
        // define the key where the global analytics object will be accessible
        // customers can safely set this to be something else if need be
        var key = instanceKey || 'analytics';
        // Create a queue, but don't obliterate an existing one!
        var analytics = (safeGlobal[key] = safeGlobal[key] || []);
        // If the real analytics.js is already on the page return.
        if (analytics.initialize) {
            return analytics;
        }
        var fn = 'ready';
        if (analytics[fn]) {
            return analytics;
        }
        var factory = function (fn) {
            return function () {
                if (safeGlobal[key].initialized) {
                    // Sometimes users assigned analytics to a variable before analytics is
                    // done loading, resulting in a stale reference. If so, proxy any calls
                    // to the 'real' analytics instance.
                    // eslint-disable-next-line prefer-spread,prefer-rest-params
                    return safeGlobal[key][fn].apply(safeGlobal[key], arguments);
                }
                // eslint-disable-next-line prefer-rest-params
                var args = Array.prototype.slice.call(arguments);
                args.unshift(fn);
                analytics.push(args);
                return analytics;
            };
        };
        // Use the predefined factory, or our own factory to stub the function.
        (analytics.factory || factory)(fn);
        return analytics;
    };

    var segmentIntegrationPlugin = function (options) {
        if (options === void 0) { options = {}; }
        var getInstance = function () {
            return options.instance || snippetInstance(options.instanceKey);
        };
        getInstance();
        var plugin = {
            name: '@amplitude/experiment-plugin-segment',
            type: 'integration',
            setup: function () {
                var instance = getInstance();
                return new Promise(function (resolve) { return instance.ready(function () { return resolve(); }); });
            },
            getUser: function () {
                var instance = getInstance();
                if (instance.initialized) {
                    return {
                        user_id: instance.user().id(),
                        device_id: instance.user().anonymousId(),
                        user_properties: instance.user().traits(),
                    };
                }
                var get = function (key) {
                    return JSON.parse(safeGlobal.localStorage.getItem(key)) || undefined;
                };
                return {
                    user_id: get('ajs_user_id'),
                    device_id: get('ajs_anonymous_id'),
                    user_properties: get('ajs_user_traits'),
                };
            },
            track: function (event) {
                var instance = getInstance();
                if (!instance.initialized)
                    return false;
                instance.track(event.eventType, event.eventProperties);
                return true;
            },
        };
        if (options.skipSetup) {
            plugin.setup = undefined;
        }
        return plugin;
    };

    exports.plugin = segmentIntegrationPlugin;
    exports.segmentIntegrationPlugin = segmentIntegrationPlugin;

    Object.defineProperty(exports, '__esModule', { value: true });

}));
