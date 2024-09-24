import { safeGlobal } from './global';

/**
 * Copied and modified from https://github.com/segmentio/snippet/blob/master/template/snippet.js
 *
 * This function will set up proxy stubs for functions used by the segment plugin
 *
 * @param instanceKey the key for the analytics instance on the global object.
 */
export const snippetInstance = (instanceKey: string | undefined) => {
  // define the key where the global analytics object will be accessible
  // customers can safely set this to be something else if need be
  const key = instanceKey || 'analytics';

  // Create a queue, but don't obliterate an existing one!
  const analytics = (safeGlobal[key] = safeGlobal[key] || []);

  // If the real analytics.js is already on the page return.
  if (analytics.initialize) {
    return analytics;
  }
  const fn = 'ready';
  if (analytics[fn]) {
    return analytics;
  }
  const factory = function (fn) {
    return function () {
      if (safeGlobal[key].initialized) {
        // Sometimes users assigned analytics to a variable before analytics is
        // done loading, resulting in a stale reference. If so, proxy any calls
        // to the 'real' analytics instance.
        // eslint-disable-next-line prefer-spread,prefer-rest-params
        return safeGlobal[key][fn].apply(safeGlobal[key], arguments);
      }
      // eslint-disable-next-line prefer-rest-params
      const args = Array.prototype.slice.call(arguments);
      args.unshift(fn);
      analytics.push(args);
      return analytics;
    };
  };
  // Use the predefined factory, or our own factory to stub the function.
  analytics[fn] = (analytics.factory || factory)(fn);
  return analytics;
};
