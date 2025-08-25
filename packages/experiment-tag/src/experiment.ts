import { AnalyticsConnector } from '@amplitude/analytics-connector';
import {
  EvaluationFlag,
  getGlobalScope,
  isLocalStorageAvailable,
  safeGlobal,
} from '@amplitude/experiment-core';
import {
  Experiment,
  Variant,
  AmplitudeIntegrationPlugin,
  ExperimentClient,
  Variants,
} from '@amplitude/experiment-js-client';
import * as FeatureExperiment from '@amplitude/experiment-js-client';
import mutate, { MutationController } from 'dom-mutator';

import { MessageBus } from './message-bus';
import { PageChangeEvent, SubscriptionManager } from './subscriptions';
import {
  Defaults,
  WebExperimentClient,
  WebExperimentConfig,
  WebExperimentUser,
} from './types';
import {
  ApplyVariantsOptions,
  PageObject,
  PageObjects,
  PreviewVariantsOptions,
  RevertVariantsOptions,
} from './types';
import { getInjectUtils } from './util/inject-utils';
import { VISUAL_EDITOR_SESSION_KEY, WindowMessenger } from './util/messenger';
import {
  getStorageItem,
  setStorageItem,
  removeStorageItem,
} from './util/storage';
import {
  getUrlParams,
  removeQueryParams,
  urlWithoutParamsAndAnchor,
  concatenateQueryParamsOf,
  matchesUrl,
} from './util/url';
import { UUID } from './util/uuid';
import { convertEvaluationVariantToVariant } from './util/variant';

const MUTATE_ACTION = 'mutate';
export const INJECT_ACTION = 'inject';
const REDIRECT_ACTION = 'redirect';
const PREVIEW_MODE_PARAM = 'PREVIEW';
export const PREVIEW_SEGMENT_NAME = 'Preview';
export const PREVIEW_MODE_SESSION_KEY = 'amp-preview-mode';
const VISUAL_EDITOR_PARAM = 'VISUAL_EDITOR';

safeGlobal.Experiment = FeatureExperiment;

export class DefaultWebExperimentClient implements WebExperimentClient {
  private readonly apiKey: string;
  private readonly initialFlags: [];
  private readonly config: WebExperimentConfig;
  private readonly globalScope: typeof globalThis;
  private readonly experimentClient: ExperimentClient;
  private appliedInjections: Set<string> = new Set();
  appliedMutations: {
    [experiment: string]: {
      [variantKey: string]: {
        [actionType: string]: {
          [id: string]: MutationController;
        };
      };
    };
  } = {};
  private previousUrl: string | undefined = undefined;
  // Cache to track exposure for the current URL, should be cleared on URL change
  private urlExposureCache: {
    [url: string]: {
      [flagKey: string]: string | undefined; // variant
    };
  } = {};
  private flagVariantMap: {
    [flagKey: string]: {
      [variantKey: string]: Variant;
    };
  } = {};
  private readonly localFlagKeys: string[] = [];
  private remoteFlagKeys: string[] = [];
  private isRemoteBlocking = false;
  private customRedirectHandler: ((url: string) => void) | undefined;
  private isRunning = false;
  private readonly messageBus: MessageBus;
  private pageObjects: PageObjects;
  private activePages: PageObjects = {};
  private subscriptionManager: SubscriptionManager | undefined;
  private isVisualEditorMode = false;
  private previewFlags: Record<string, string> = {};

  constructor(
    apiKey: string,
    initialFlags: string,
    pageObjects: string,
    config: WebExperimentConfig = {},
  ) {
    const globalScope = getGlobalScope();
    if (!globalScope || !isLocalStorageAvailable()) {
      throw new Error(
        'Amplitude Web Experiment Client could not be initialized.',
      );
    }
    this.globalScope = globalScope;
    this.apiKey = apiKey;
    this.initialFlags = JSON.parse(initialFlags);
    this.pageObjects = JSON.parse(pageObjects);
    // merge config with defaults and experimentConfig (if provided)
    this.config = {
      ...Defaults,
      ...config,
      ...(this.globalScope.experimentConfig ?? {}),
    };

    const urlParams = getUrlParams();

    let previewFlags: Record<string, string> = {};
    // explicit URL params takes precedence over session storage
    if (urlParams[PREVIEW_MODE_PARAM]) {
      Object.keys(urlParams).forEach((key) => {
        if (key !== 'PREVIEW' && urlParams[key]) {
          previewFlags[key] = urlParams[key];
        }
      });
    } else {
      previewFlags =
        getStorageItem('sessionStorage', PREVIEW_MODE_SESSION_KEY) || {};
    }

    this.initialFlags.forEach((flag: EvaluationFlag) => {
      const { key, variants, metadata = {} } = flag;

      this.flagVariantMap[key] = {};
      Object.keys(variants).forEach((variantKey) => {
        this.flagVariantMap[key][variantKey] =
          convertEvaluationVariantToVariant(variants[variantKey]);
      });

      // Update initialFlags to force variant if in preview mode
      if (key in previewFlags && previewFlags[key] in variants) {
        this.previewFlags[key] = previewFlags[key];

        const previewSegment = {
          metadata: { segmentName: PREVIEW_SEGMENT_NAME },
          variant: previewFlags[key],
        };

        flag.segments = [previewSegment];
        metadata.evaluationMode = 'local';
      }

      if (metadata.evaluationMode !== 'local') {
        this.remoteFlagKeys.push(key);
      }

      flag.metadata = metadata;
    });

    if (Object.keys(this.previewFlags).length > 0) {
      if (urlParams[PREVIEW_MODE_PARAM]) {
        setStorageItem(
          'sessionStorage',
          PREVIEW_MODE_SESSION_KEY,
          this.previewFlags,
        );
        const previewParamsToRemove = [
          ...Object.keys(this.previewFlags),
          PREVIEW_MODE_PARAM,
        ];
        this.globalScope.history.replaceState(
          {},
          '',
          removeQueryParams(
            this.globalScope.location.href,
            previewParamsToRemove,
          ),
        );
      }
    }

    const initialFlagsString = JSON.stringify(this.initialFlags);

    // initialize the experiment
    this.experimentClient = Experiment.initialize(this.apiKey, {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      internalInstanceNameSuffix: 'web',
      initialFlags: initialFlagsString,
      // timeout for fetching remote flags
      fetchTimeoutMillis: 1000,
      pollOnStart: false,
      fetchOnStart: false,
      automaticExposureTracking: false,
      ...this.config,
    });
    // Get all the locally available flag keys from the SDK.
    const variants = this.experimentClient.all();
    this.localFlagKeys = Object.keys(variants).filter(
      (key) => variants[key]?.metadata?.evaluationMode === 'local',
    );
    this.messageBus = new MessageBus();
  }

  /**
   * Start the web experiment client.
   */
  public async start() {
    if (this.isRunning) {
      return;
    }
    const urlParams = getUrlParams();
    this.isVisualEditorMode =
      urlParams[VISUAL_EDITOR_PARAM] === 'true' ||
      getStorageItem('sessionStorage', VISUAL_EDITOR_SESSION_KEY) !== null;
    this.subscriptionManager = new SubscriptionManager(
      this,
      this.messageBus,
      this.pageObjects,
      {
        ...this.config,
        isVisualEditorMode: this.isVisualEditorMode,
      },
      this.globalScope,
    );
    this.subscriptionManager.initSubscriptions();

    // if in visual edit mode, remove the query param
    if (this.isVisualEditorMode) {
      WindowMessenger.setup();
      this.globalScope.history.replaceState(
        {},
        '',
        removeQueryParams(this.globalScope.location.href, [
          VISUAL_EDITOR_PARAM,
        ]),
      );
      // fire url_change upon landing on page, set updateActivePagesOnly to not trigger variant actions
      this.messageBus.publish('url_change', { updateActivePages: true });
      this.isRunning = true;
      return;
    }

    // fire url_change upon landing on page, set updateActivePagesOnly to not trigger variant actions
    this.messageBus.publish('url_change', { updateActivePages: true });

    const experimentStorageName = `EXP_${this.apiKey.slice(0, 10)}`;
    const user =
      getStorageItem<WebExperimentUser>(
        'localStorage',
        experimentStorageName,
      ) || {};

    // if web_exp_id does not exist:
    // 1. if device_id exists, migrate device_id to web_exp_id and remove device_id
    // 2. if device_id does not exist, create a new web_exp_id
    // 3. if both device_id and web_exp_id exist, remove device_id
    if (!user.web_exp_id) {
      user.web_exp_id = user.device_id || UUID();
      delete user.device_id;
      setStorageItem('localStorage', experimentStorageName, user);
    } else if (user.web_exp_id && user.device_id) {
      delete user.device_id;
      setStorageItem('localStorage', experimentStorageName, user);
    }

    // evaluate variants for page targeting
    const variants: Variants = this.getVariants();

    for (const [flagKey, variant] of Object.entries(variants)) {
      // only apply anti-flicker for remote flags active on the page
      if (
        this.remoteFlagKeys.includes(flagKey) &&
        variant.metadata?.blockingEvaluation &&
        Object.keys(this.activePages).includes(flagKey)
      ) {
        this.isRemoteBlocking = true;
        // Apply anti-flicker CSS to prevent UI flicker
        this.applyAntiFlickerCss();
      }
    }

    // If no integration has been set, use an Amplitude integration.
    if (!this.globalScope.experimentIntegration) {
      const connector = AnalyticsConnector.getInstance('$default_instance');
      this.globalScope.experimentIntegration = new AmplitudeIntegrationPlugin(
        this.apiKey,
        connector,
        1000,
      );
    }
    this.globalScope.experimentIntegration.type = 'integration';
    this.experimentClient.addPlugin(this.globalScope.experimentIntegration);
    this.experimentClient.setUser(user);

    if (!this.isRemoteBlocking) {
      // Remove anti-flicker css if remote flags are not blocking
      this.globalScope.document.getElementById?.('amp-exp-css')?.remove();
    }

    // apply local variants
    this.applyVariants({ flagKeys: this.localFlagKeys });

    if (this.remoteFlagKeys.length === 0) {
      this.isRunning = true;
      return;
    }

    await this.fetchRemoteFlags();
    // apply remote variants - if fetch is unsuccessful, fallback order: 1. localStorage flags, 2. initial flags
    this.applyVariants({ flagKeys: this.remoteFlagKeys });
    this.isRunning = true;
  }

  /**
   * Get singleton of the {@link DefaultWebExperimentClient} if it has already been initialized.
   * If not, initialize the client and return the instance.
   * @param apiKey
   * @param initialFlags
   * @param pageObjects
   * @param config
   */
  static getInstance(
    apiKey: string,
    initialFlags: string,
    pageObjects: string,
    config: WebExperimentConfig = {},
  ): DefaultWebExperimentClient {
    const globalScope = getGlobalScope();
    if (!globalScope) {
      throw new Error(
        'Amplitude Web Experiment Client could not be initialized.',
      );
    }
    // if the client has already been initialized, return the existing instance
    if (globalScope?.webExperiment) {
      return globalScope.webExperiment;
    }
    const webExperiment = new DefaultWebExperimentClient(
      apiKey,
      initialFlags,
      pageObjects,
      config,
    );
    globalScope.webExperiment = webExperiment;
    return webExperiment;
  }

  /**
   * Get the underlying {@link ExperimentClient} instance.
   */
  public getExperimentClient(): ExperimentClient {
    return this.experimentClient;
  }

  /**
   * Apply evaluated variants to the page.
   * @param options
   */
  public applyVariants(options?: ApplyVariantsOptions) {
    const { flagKeys } = options || {};
    const variants = this.getVariants();
    if (Object.keys(variants).length === 0) {
      return;
    }
    const currentUrl = urlWithoutParamsAndAnchor(
      this.globalScope.location.href,
    );
    // Initialize the cache if on a new URL
    if (!this.urlExposureCache?.[currentUrl]) {
      this.urlExposureCache = {};
      this.urlExposureCache[currentUrl] = {};
    }

    this.fireStoredRedirectImpressions();

    for (const key in variants) {
      if (flagKeys && !flagKeys.includes(key)) {
        continue;
      }
      const variant = variants[key];
      const variantKey = variant.key || '';

      // Check if the variant key has changed for this experiment
      // If so, revert all mutations for this experiment
      if (this.appliedMutations[key]) {
        const appliedVariantKeys = Object.keys(this.appliedMutations[key]);
        if (
          appliedVariantKeys.length > 0 &&
          !appliedVariantKeys.includes(variantKey)
        ) {
          // Variant key has changed, revert all mutations for this experiment
          this.revertVariants({ flagKeys: [key] });
          // Clean up the applied mutations for this experiment
          delete this.appliedMutations[key];
        }
      }

      const isWebExperimentation = variant.metadata?.deliveryMethod === 'web';
      if (isWebExperimentation) {
        const payloadIsArray = Array.isArray(variant.payload);
        // TODO: update to handle impression tracking when control variant redirect is supported
        if (variant.key === 'off' || variant.key === 'control') {
          if (this.isActionActiveOnPage(key, undefined)) {
            this.exposureWithDedupe(key, variant);
          }
          if (variant.key === 'off') {
            // revert all applied mutations and injections
            this.revertVariants({ flagKeys: [key] });
            continue;
          }
        }

        if (payloadIsArray) {
          this.handleVariantAction(key, variant);
        }
      }
    }
  }

  /**
   * Revert variant actions applied by the experiment.
   * @param options
   */
  public revertVariants(options?: RevertVariantsOptions) {
    if (!this.appliedMutations) return;

    let { flagKeys } = options || {};
    if (!flagKeys) {
      flagKeys = Object.keys(this.appliedMutations);
    }

    for (const key of flagKeys) {
      const variantMap = this.appliedMutations[key];
      if (!variantMap) continue;

      for (const variantKey in variantMap) {
        const typeMap = variantMap[variantKey];
        if (!typeMap) continue;

        for (const actionType in typeMap) {
          for (const id in typeMap[actionType]) {
            typeMap[actionType][id]?.revert?.();
          }
        }
      }
      delete this.appliedMutations[key];
    }
  }

  /**
   * Preview the effect of a variant on the page.
   * @param options
   */
  public previewVariants(options: PreviewVariantsOptions) {
    const { keyToVariant } = options;
    if (!keyToVariant) {
      return;
    }

    this.revertVariants({ flagKeys: Object.keys(keyToVariant) });

    for (const key in keyToVariant) {
      const variant = keyToVariant[key];
      const flag = this.flagVariantMap[key];
      if (!flag) {
        return;
      }
      const variantObject = flag[variant];
      if (!variantObject) {
        return;
      }
      const payload = variantObject.payload;
      if (!payload || !Array.isArray(payload)) {
        return;
      }
      this.handleVariantAction(key, variantObject);
    }
  }

  /**
   * Get all variants for the current web experiment user context.
   */
  public getVariants(): Variants {
    const variants: Variants = {};
    for (const key of [...this.localFlagKeys, ...this.remoteFlagKeys]) {
      variants[key] = this.experimentClient.variant(key);
    }
    return variants;
  }

  /**
   * Get the list of experiments with active mutations or injects on the current page.
   */
  public getActiveExperiments(): string[] {
    return Object.keys(this.appliedMutations);
  }

  /**
   * Get a map of active page view objects.
   */
  public getActivePages(): PageObjects {
    return this.activePages;
  }

  /**
   * Add a subscriber to the page change event.
   * @param callback
   * @returns An unsubscribe function to remove the subscriber.
   */

  public addPageChangeSubscriber(
    callback: (event: PageChangeEvent) => void,
  ): (() => void) | undefined {
    if (this.subscriptionManager) {
      return this.subscriptionManager.addPageChangeSubscriber(callback);
    }
  }

  /**
   * When in visual editor mode, update the current page objects and reinitialize subscriptions and active pages.
   *
   * @param {PageObjects} pageObjects - The new set of page objects to be set.
   */

  public setPageObjects(pageObjects: PageObjects) {
    if (this.isVisualEditorMode) {
      this.pageObjects = pageObjects;
      this.subscriptionManager?.setPageObjects(pageObjects);
      this.activePages = {};
      this.messageBus.unsubscribeAll();
      this.subscriptionManager?.initSubscriptions();
      // update active pages
      this.messageBus.publish('url_change', { updateActivePages: true });
    }
  }

  /**
   * Set a custom redirect handler.
   */
  public setRedirectHandler(handler: (url: string) => void) {
    this.customRedirectHandler = handler;
  }

  private async fetchRemoteFlags() {
    try {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      await this.experimentClient.doFlags();
    } catch (error) {
      console.warn('Error fetching remote flags:', error);
    }
  }

  private handleVariantAction(key: string, variant: Variant) {
    for (const action of variant.payload) {
      if (action.action === REDIRECT_ACTION) {
        this.handleRedirect(action, key, variant);
      } else if (action.action === MUTATE_ACTION) {
        this.handleMutate(action, key, variant);
      } else if (action.action === INJECT_ACTION) {
        this.handleInject(action, key, variant);
      }
    }
  }

  private handleRedirect(action, flagKey: string, variant: Variant) {
    if (!this.isActionActiveOnPage(flagKey, action?.data?.metadata?.scope)) {
      return;
    }

    const referrerUrl = urlWithoutParamsAndAnchor(
      this.previousUrl || this.globalScope.document.referrer,
    );
    const redirectUrl = action?.data?.url;

    const currentUrl = urlWithoutParamsAndAnchor(
      this.globalScope.location.href,
    );

    // prevent infinite redirection loop
    if (currentUrl === referrerUrl) {
      return;
    }

    const targetUrl = concatenateQueryParamsOf(
      this.globalScope.location.href,
      redirectUrl,
    );

    if (this.globalScope.location.href === targetUrl) {
      return;
    }

    this.storeRedirectImpressions(flagKey, variant, redirectUrl);

    // set previous url - relevant for SPA if redirect happens before push/replaceState is complete
    this.previousUrl = this.globalScope.location.href;

    // perform redirection
    if (this.customRedirectHandler) {
      this.customRedirectHandler(targetUrl);
      return;
    }
    this.globalScope.location.replace(targetUrl);
  }

  private handleMutate(action, flagKey: string, variant: Variant) {
    const mutations = action.data?.mutations || [];
    const variantKey = variant.key || '';

    if (mutations.length === 0) {
      return;
    }

    const mutationControllers: Record<number, MutationController> = {};

    mutations.forEach((m, index) => {
      // Check if mutation is scoped to page
      if (!this.isActionActiveOnPage(flagKey, m?.metadata?.scope)) {
        // Revert and delete the mutation if it exists
        if (
          this.appliedMutations[flagKey]?.[variantKey]?.[MUTATE_ACTION]?.[index]
        ) {
          this.appliedMutations[flagKey]?.[variantKey]?.[MUTATE_ACTION]?.[
            index
          ]?.revert();
          delete this.appliedMutations[flagKey][variantKey][MUTATE_ACTION][
            index
          ];
        }
      } else {
        // always track exposure if mutation is active
        this.exposureWithDedupe(flagKey, variant);
        // Check if mutation has already been applied
        if (
          !this.appliedMutations[flagKey]?.[variantKey]?.[MUTATE_ACTION]?.[
            index
          ]
        ) {
          // Apply mutation
          mutationControllers[index] = mutate.declarative(m);
        }
      }
    });

    this.appliedMutations[flagKey] ??= {};
    this.appliedMutations[flagKey][variantKey] ??= {};
    // Merge instead of overwriting if there are existing mutations
    this.appliedMutations[flagKey][variantKey][MUTATE_ACTION] = {
      ...this.appliedMutations[flagKey][variantKey][MUTATE_ACTION],
      ...mutationControllers,
    };

    // Delete empty objects safely
    if (
      Object.keys(
        this.appliedMutations[flagKey][variantKey][MUTATE_ACTION] || {},
      ).length === 0
    ) {
      delete this.appliedMutations[flagKey][variantKey][MUTATE_ACTION];
    }
    if (
      Object.keys(this.appliedMutations[flagKey][variantKey] || {}).length === 0
    ) {
      delete this.appliedMutations[flagKey];
    }
  }

  private handleInject(action, flagKey: string, variant: Variant) {
    const variantKey = variant.key || '';

    if (!this.isActionActiveOnPage(flagKey, action?.metadata?.scope)) {
      this.appliedMutations[flagKey]?.[variantKey]?.[
        INJECT_ACTION
      ]?.[0]?.revert();
      return;
    }
    // Validate and transform ID
    let id = action.data.id;
    if (!id || typeof id !== 'string' || id.length === 0) {
      return;
    }
    // Replace the `-` characters in the UUID to support function name
    id = id.replace(/-/g, '');
    // Check for repeat invocations
    if (this.appliedInjections.has(id)) {
      return;
    }
    // Create JS
    const rawJs = action.data.js;
    let script: HTMLScriptElement | undefined;
    if (rawJs) {
      script = this.globalScope.document.createElement('script');
      if (script) {
        script.innerHTML = `function ${id}(html, utils, id){${rawJs}};`;
        script.id = `js-${id}`;
        this.globalScope.document.head.appendChild(script);
      }
    }
    // Create CSS
    const rawCss = action.data.css;
    let style: HTMLStyleElement | undefined;
    if (rawCss) {
      style = this.globalScope.document.createElement('style');
      if (style) {
        style.innerHTML = rawCss;
        style.id = `css-${id}`;
        this.globalScope.document.head.appendChild(style);
      }
    }
    // Create HTML
    const rawHtml = action.data.html;
    let html: Element | undefined;
    if (rawHtml) {
      html =
        new DOMParser().parseFromString(rawHtml, 'text/html').body
          .firstElementChild ?? undefined;
    }
    // Inject
    const utils = getInjectUtils();
    this.appliedInjections.add(id);
    try {
      const fn = this.globalScope[id];
      if (fn && typeof fn === 'function') {
        fn(html, utils, id);
      }
    } catch (e) {
      script?.remove();
      console.error(
        `Experiment inject failed for ${flagKey} variant ${variant.key}. Reason:`,
        e,
      );
    }
    // Push mutation to remove CSS and any custom state cleanup set in utils.
    this.appliedMutations[flagKey] ??= {};
    this.appliedMutations[flagKey][variantKey] ??= {};
    this.appliedMutations[flagKey][variantKey][INJECT_ACTION] ??= {};

    // Push the mutation
    this.appliedMutations[flagKey][variantKey][INJECT_ACTION][id] = {
      revert: () => {
        utils.remove?.();
        style?.remove();
        script?.remove();
        this.appliedInjections.delete(id);
      },
    };
    this.exposureWithDedupe(flagKey, variant);
  }

  private exposureWithDedupe(
    key: string,
    variant: Variant,
    forceVariant?: boolean,
  ) {
    const currentUrl = urlWithoutParamsAndAnchor(
      this.globalScope.location.href,
    );

    // if on the same base URL, only track exposure if variant has changed or has not been tracked
    const hasTrackedVariant =
      this.urlExposureCache?.[currentUrl]?.[key] === variant.key;

    if (!hasTrackedVariant) {
      if (forceVariant) {
        const variantAndSource = {
          variant: variant,
          source: 'local-evaluation',
          hasDefaultVariant: false,
        };
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        this.experimentClient.exposureInternal(key, variantAndSource);
      } else {
        this.experimentClient.exposure(key);
      }
      this.urlExposureCache[currentUrl][key] = variant.key;
    }
  }

  private applyAntiFlickerCss() {
    if (!this.globalScope.document.getElementById('amp-exp-css')) {
      const id = 'amp-exp-css';
      const s = document.createElement('style');
      s.id = id;
      s.innerText =
        '* { visibility: hidden !important; background-image: none !important; }';
      document.head.appendChild(s);
      this.globalScope.window.setTimeout(function () {
        s.remove();
      }, 1000);
    }
  }

  updateActivePages(flagKey: string, page: PageObject, isActive: boolean) {
    if (!this.activePages[flagKey]) {
      this.activePages[flagKey] = {};
    }
    if (isActive) {
      this.activePages[flagKey][page.id] = page;
    } else {
      delete this.activePages[flagKey][page.id];
      if (Object.keys(this.activePages[flagKey]).length === 0) {
        delete this.activePages[flagKey];
      }
    }
  }

  private isActionActiveOnPage(
    flagKey: string,
    scope: string[] | undefined,
  ): boolean {
    const flagPages = this.activePages[flagKey];

    // If no scope is provided, assume variant is active if the flag has any active pages
    if (!scope) {
      return !!flagPages && Object.values(flagPages).some(Boolean);
    }

    // If scope is provided, check if any scoped page is active
    return scope.some((pageId) => flagPages?.[pageId] ?? false);
  }

  private storeRedirectImpressions(
    flagKey: string,
    variant: Variant,
    redirectUrl: string,
  ) {
    const redirectStorageKey = `EXP_${this.apiKey.slice(0, 10)}_REDIRECT`;
    // Store the current flag and variant for exposure tracking after redirect
    const storedRedirects =
      getStorageItem('sessionStorage', redirectStorageKey) || {};
    storedRedirects[flagKey] = { redirectUrl, variant };
    setStorageItem('sessionStorage', redirectStorageKey, storedRedirects);
  }

  private fireStoredRedirectImpressions() {
    // Check for stored redirects and process them
    const redirectStorageKey = `EXP_${this.apiKey.slice(0, 10)}_REDIRECT`;
    const storedRedirects =
      getStorageItem('sessionStorage', redirectStorageKey) || {};

    // If we have stored redirects, track exposures for them
    if (Object.keys(storedRedirects).length > 0) {
      for (const storedFlagKey in storedRedirects) {
        const { redirectUrl, variant } = storedRedirects[storedFlagKey];
        const currentUrl = urlWithoutParamsAndAnchor(
          this.globalScope.location.href,
        );
        const strippedRedirectUrl = urlWithoutParamsAndAnchor(redirectUrl);
        if (matchesUrl([currentUrl], strippedRedirectUrl)) {
          // Force variant to ensure original evaluation result is tracked
          this.exposureWithDedupe(storedFlagKey, variant, true);

          // Remove this flag from stored redirects
          delete storedRedirects[storedFlagKey];
        }
      }
    }

    // Update or clear the storage
    if (Object.keys(storedRedirects).length > 0) {
      // track exposure with timeout of 500ms
      this.globalScope.setTimeout(() => {
        const redirects =
          getStorageItem('sessionStorage', redirectStorageKey) || {};
        for (const storedFlagKey in redirects) {
          this.exposureWithDedupe(
            storedFlagKey,
            redirects[storedFlagKey].variant,
            true,
          );
        }
        removeStorageItem('sessionStorage', redirectStorageKey);
      }, 500);
    } else {
      removeStorageItem('sessionStorage', redirectStorageKey);
    }
  }
}
