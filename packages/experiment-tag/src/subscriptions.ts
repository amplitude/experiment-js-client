import {
  EvaluationCondition,
  getGlobalScope,
  EvaluationEngine,
} from '@amplitude/experiment-core';

import { MessageBus, MessageType } from './message-bus';
import { WebExperimentStore } from './store';
import { DebouncedMutationManager } from './mutation-manager';

export type PageObject = {
  // TODO: should conditions be AND or OR?
  // TODO: page targeting should be translated into conditions differently
  conditions?: EvaluationCondition[][];
  trigger: {
    type: MessageType;
    properties: Record<string, unknown>;
  };
  triggerSource?: string;
  experiments: Record<string, string[]>;
};

const evaluationEngine = new EvaluationEngine();
const globalScope = getGlobalScope();

// const locationSub = (_: MessageBus) => {
//   const history = window.history;
//
//   const pushState = history.pushState;
//   const replaceState = history.replaceState;
//
//   let cancelled = false;
//   let oldHref = document.location.href;
//
//   history.pushState = function (...args) {
//     pushState.apply(history, args);
//     if (cancelled) return;
//     if (oldHref === document.location.href) return;
//
//     oldHref = document.location.href;
//     // NOTE: spreading window.location into new object here triggers subscribers to _.location
//     // without this, since window.location seems to be a singleton, subscribers would not be triggered
//     _.location = ref({ ...window.location });
//   };
//
//   history.replaceState = function (...args) {
//     replaceState.apply(history, args);
//     if (cancelled) return;
//     if (oldHref === document.location.href) return;
//
//     oldHref = document.location.href;
//     // NOTE: spreading window.location into new object here triggers subscribers to _.location
//     // without this, since window.location seems to be a singleton, subscribers would not be triggered
//     _.location = ref({ ...window.location });
//   };
//
//   const checkHrefChange = () => {
//     if (oldHref !== document.location.href) {
//       oldHref = document.location.href;
//       _.location = ref({ ...window.location });
//     }
//   };
//
//   window.addEventListener('hashchange', checkHrefChange);
//
//   return () => {
//     // NOTE: unfortunately, it is not possible to uninstall our pushState and replaceState intermediaries
//     // because someone else may be holding a reference to them, or even may have replaced them in a similar
//     // fashion. If we just restore the original functions, any subsequent changes to pushState and replaceState
//     // would be overwritten.
//     //
//     // Instead, we simply cancel the effects and leave them in place.
//     window.removeEventListener('hashchange', checkHrefChange);
//     cancelled = true;
//   };
// };

export const initSubscriptions = (_: MessageBus, pageObjects: PageObject[]) => {
  setupLocationChangePublisher(_);
  setupSDKManualPublisher(_);
  setupMutationObserverPublisher(_);
  setupMessageBusTriggerSubscriptions(_);
  setupPageObjectSubscriptions(_, pageObjects);

  // fire location_change upon landing on page
  _.publish('location_change', {});
};

// TODO: figure out event queue for before SDKs are initialized?
const setupSDKManualPublisher = (_: MessageBus) => {
  globalScope?.document.addEventListener('manual_trigger', (event) => {
    // @ts-ignore
    // send message to MessageBus for view trigger
    _.publish('manual_trigger', {
      // @ts-ignore
      name: event.detail.name,
    });
  });
};

const setupMutationObserverPublisher = (_: MessageBus) => {
  const mutationManager = new DebouncedMutationManager(
    document.documentElement,
    (mutationList) => {
      _.publish('dom_mutation', { mutationList });
    },
    [],
  );
  return mutationManager.observe();
};

// TODO: fix in reference to assistance-browser
const setupLocationChangePublisher = (_: MessageBus) => {
  if (!globalScope) {
    return;
  }
  // Add URL change listener for back/forward navigation
  globalScope.addEventListener('popstate', () => {
    _.publish('location_change', {});
  });

  const handleUrlChange = () => {
    _.publish('location_change', {});
    globalScope.webExperiment.previousUrl = globalScope.location.href;
  };

  // Create wrapper functions for pushState and replaceState
  const wrapHistoryMethods = () => {
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    // Wrapper for pushState
    history.pushState = function (...args) {
      // Call the original pushState
      const result = originalPushState.apply(this, args);
      // Revert mutations and apply variants
      handleUrlChange();
      return result;
    };

    // Wrapper for replaceState
    history.replaceState = function (...args) {
      // Call the original replaceState
      const result = originalReplaceState.apply(this, args);
      // Revert mutations and apply variants
      handleUrlChange();
      return result;
    };
  };

  // Initialize the wrapper
  wrapHistoryMethods();

  window.addEventListener('hashchange', handleUrlChange);
};

const setupMessageBusTriggerSubscriptions = (_: MessageBus) => {
  //
};

const setupPageObjectSubscriptions = (
  _: MessageBus,
  pageObjects: PageObject[],
) => {
  // iterate through pageObjects, each object should be subscribed to the relevant trigger
  for (const page of pageObjects) {
    // subscribe to relevant triggers via message bus
    _.subscribe(page.trigger.type, (payload) => {
      // get variant and apply variant actions
      applyVariantActions(page, payload);
    });
  }
};

const applyVariantActions = (page: PageObject, message: any) => {
  if (!globalScope) {
    return;
  }
  // check if page is active
  if (isPageObjectActive(page, message)) {
    // TODO: avoid evaluating all variants for each callback -> use cached variants?
    globalScope.webExperiment.applyVariants({ flagKeys: page.experiments });
    console.log('variants applied');
  } else {
    // if page is not active, revert variants (if they were applied)
    globalScope.webExperiment.revertVariants({ flagKeys: page.experiments });
    console.log('variants reverted');
  }
};

const isPageObjectActive = (page: PageObject, message) => {
  if (!globalScope) {
    return false;
  }
  // check conditions
  if (page.conditions) {
    // evaluate conditions
    const matchConditions = evaluationEngine.evaluateConditions(
      {
        context: { page: { url: globalScope.location.href } },
        result: {},
      },
      page.conditions,
    );
    if (!matchConditions) {
      return false;
    }
  }

  // check if page is active
  if (page.trigger.type === 'immediately') {
    return true;
  } else if (page.trigger.type === 'location_change') {
    // TODO: handle location change message - what needs to be checked?
    return true;
  } else if (page.trigger.type === 'manual_trigger') {
    return message.name === page.trigger.properties.name;
  } else if (page.trigger.type === 'analytics_event') {
    // TODO: check event and event properties match
    return true;
  } else if (page.trigger.type === 'dom_mutation') {
    // TODO: take care of flicker on landing
    const element = globalScope.document.querySelector(
      // @ts-ignore
      page.trigger.properties.selector,
    );
    if (element) {
      const style = window.getComputedStyle(element);
      const isDisplayNone = style.display === 'none';
      const isVisibilityHidden = style.visibility === 'hidden';
      const isHidden = isDisplayNone || isVisibilityHidden;
      if (!isHidden) {
        return true;
      }
    }
    return false;
  }
};
