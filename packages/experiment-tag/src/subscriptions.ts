import {
  EvaluationCondition,
  getGlobalScope,
  EvaluationEngine,
} from '@amplitude/experiment-core';

import { MessageBus, MessageType } from './message-bus';

export type PageObject = {
  // TODO: should conditions be AND or OR?
  // TODO: page targeting should be translated into conditions differently
  conditions?: EvaluationCondition[][];
  trigger: {
    type: MessageType;
    properties: Record<string, unknown>;
  };
  triggerSource?: string;
  experiments: string[];
};

const evaluationEngine = new EvaluationEngine();
const globalScope = getGlobalScope();

export const initSubscriptions = (_: MessageBus, pageObjects: PageObject[]) => {
  console.log('initSubscriptions');
  setupLocationChangePublisher(_);
  setupSDKManualPublisher(_);
  setupMutationObserverPublisher(_);
  setupMessageBusTriggerSubscriptions(_);
  setupPageObjectSubscriptions(_, pageObjects);
};

const setupSDKManualPublisher = (_: MessageBus) => {
  // TODO: figure out how these messages are fired
  // either calling a method on the client or via postMessage
};

const setupMutationObserverPublisher = (_: MessageBus) => {
  //
};

const setupLocationChangePublisher = (_: MessageBus) => {
  //
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
  if (!isPageObjectActive(page, message)) {
    return;
  }
  // TODO: avoid evaluating all variants for each callback
  globalScope.webExperiment.applyVariants({ flagKeys: page.experiments });
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
    // TODO: handle location change message
  } else if (page.trigger.type === 'sdk_trigger') {
    return (message.name = page.trigger.properties.name);
  } else if (page.trigger.type === 'analytics_event') {
    // TODO: check event and event properties match
    return true;
  } else if (page.trigger.type === 'dom_mutation') {
    // TODO: check if element appeared
    return true;
  }
};
