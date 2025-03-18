import { getGlobalScope, EvaluationEngine } from '@amplitude/experiment-core';

import {
  MessageBus,
  MessagePayloads,
  AnalyticsEventPayload,
  ManualTriggerPayload,
  MessageType,
} from './message-bus';
import { DebouncedMutationManager } from './mutation-manager';
import { PageObject, PageObjects } from './types';

const evaluationEngine = new EvaluationEngine();

type initOptions = {
  useDefaultNavigationHandler?: boolean;
};

export const initSubscriptions = (
  _: MessageBus,
  pageObjects: PageObjects,
  options: initOptions,
) => {
  if (!options.useDefaultNavigationHandler) {
    setupLocationChangePublisher(_);
  }
  // setupMutationObserverPublisher(_);
  // setupSDKManualPublisher(_);
  // setupMessageBusTriggerSubscriptions(_);
  setupPageObjectSubscriptions(_, pageObjects);
};

// TODO: figure out event queue for before SDKs are initialized?
// const setupSDKManualPublisher = (_: MessageBus) => {
// const globalScope = getGlobalScope();
// globalScope?.document.addEventListener('manual_trigger', (event) => {
//   // @ts-ignore
//   // send message to MessageBus for view trigger
//   _.publish('manual', {
//     // @ts-ignore
//     name: event.detail.name,
//   });
// });
// };

const setupMutationObserverPublisher = (_: MessageBus) => {
  const globalScope = getGlobalScope();
  if (!globalScope) {
    return;
  }
  const mutationManager = new DebouncedMutationManager(
    globalScope.document.documentElement,
    (mutationList) => {
      _.publish('element_appeared', { mutationList });
    },
    [],
  );
  return mutationManager.observe();
};

// TODO: fix in reference to assistance-browser
const setupLocationChangePublisher = (_: MessageBus) => {
  const globalScope = getGlobalScope();
  if (!globalScope) {
    return;
  }
  // Add URL change listener for back/forward navigation
  globalScope.addEventListener('popstate', () => {
    _.publish('url_change');
  });

  const handleUrlChange = () => {
    _.publish('url_change');
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

// const setupMessageBusTriggerSubscriptions = (_: MessageBus) => {
//
// };

const setupPageObjectSubscriptions = (
  _: MessageBus,
  pageObjects: PageObjects,
) => {
  const globalScope = getGlobalScope();
  // iterate through pageObjects, each object should be subscribed to the relevant trigger
  for (const [experiment, pages] of Object.entries(pageObjects)) {
    for (const [pageName, page] of Object.entries(pages)) {
      _.subscribe(
        page.trigger.type,
        (payload) => {
          // get variant and apply variant actions
          if (isPageObjectActive(page, payload)) {
            globalScope?.webExperiment.updateActivePages(
              experiment,
              pageName,
              true,
            );
          } else {
            globalScope?.webExperiment.updateActivePages(
              experiment,
              pageName,
              false,
            );
          }
        },
        undefined,
        (payload) => {
          if (!('updateActivePages' in payload) || !payload.updateActivePages) {
            globalScope?.webExperiment.applyVariants();
          }
        },
      );
    }
  }
};

const isPageObjectActive = <T extends MessageType>(
  page: PageObject,
  message: MessagePayloads[T],
): boolean => {
  const globalScope = getGlobalScope();
  if (!globalScope) {
    return false;
  }

  // Check conditions
  if (page.conditions) {
    const url = globalScope.location.href;
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

  // Check if page is active
  switch (page.trigger.type) {
    case 'url_change':
      return true;

    case 'manual':
      return (
        (message as ManualTriggerPayload).name === page.trigger.properties.name
      );

    case 'analytics_event': {
      const eventMessage = message as AnalyticsEventPayload;
      return (
        eventMessage.event_type === page.trigger.properties.event_type &&
        Object.entries(page.trigger.properties.event_properties || {}).every(
          ([key, value]) => eventMessage.event_properties[key] === value,
        )
      );
    }

    //TODO: fix to check payload?
    case 'element_appeared': {
      // const mutationMessage = message as DomMutationPayload;
      const element = globalScope.document.querySelector(
        page.trigger.properties.selector as string,
      );
      if (element) {
        const style = window.getComputedStyle(element);
        return style.display !== 'none' && style.visibility !== 'hidden';
      }
      return false;
    }

    default:
      return false;
  }
};
