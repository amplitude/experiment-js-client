import {
  AnalyticsConnector,
  ApplicationContextProvider,
  EventBridge,
  IdentityStore,
} from '@amplitude/analytics-connector';
import { safeGlobal } from '@amplitude/experiment-core';

import { ExperimentConfig } from '../config';
import { Client } from '../types/client';
import {
  ExperimentEvent,
  ExperimentPluginType,
  IntegrationPlugin,
} from '../types/plugin';
import { ExperimentUser, UserProperties } from '../types/user';
import {
  AmplitudeState,
  parseAmplitudeCookie,
  parseAmplitudeLocalStorage,
  parseAmplitudeSessionStorage,
} from '../util/state';

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
export class AmplitudeIntegrationPlugin implements IntegrationPlugin {
  readonly type: ExperimentPluginType;
  private readonly apiKey: string | undefined;
  private readonly identityStore: IdentityStore;
  private readonly eventBridge: EventBridge;
  private readonly contextProvider: ApplicationContextProvider;
  private readonly timeoutMillis: number;

  constructor(
    apiKey: string | undefined,
    connector: AnalyticsConnector,
    timeoutMillis: number,
  ) {
    this.type = 'integration' as ExperimentPluginType;
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

  async setup?(config?: ExperimentConfig, client?: Client) {
    // Setup automatic fetch on amplitude identity change.
    if (config?.automaticFetchOnAmplitudeIdentityChange) {
      this.identityStore.addIdentityListener(() => {
        client?.fetch();
      });
    }
    return this.waitForConnectorIdentity(this.timeoutMillis);
  }

  getUser(): ExperimentUser {
    const identity = this.identityStore.getIdentity();
    return {
      user_id: identity.userId,
      device_id: identity.deviceId,
      user_properties: identity.userProperties as UserProperties,
      version: this.contextProvider.versionName,
    };
  }

  track(event: ExperimentEvent): boolean {
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
  }

  private loadPersistedState(): boolean {
    // Avoid reading state if the api key is undefined or an experiment
    // deployment.
    if (!this.apiKey || this.apiKey.startsWith('client-')) {
      return false;
    }
    // New cookie format
    let user = parseAmplitudeCookie(this.apiKey, true);
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
  }

  private commitIdentityToConnector(user: AmplitudeState) {
    const editor = this.identityStore.editIdentity();
    editor.setDeviceId(user.deviceId);
    if (user.userId) {
      editor.setUserId(user.userId);
    }
    editor.commit();
  }

  private async waitForConnectorIdentity(ms: number): Promise<void> {
    const identity = this.identityStore.getIdentity();
    if (!identity.userId && !identity.deviceId) {
      return Promise.race([
        new Promise<void>((resolve) => {
          const listener = () => {
            resolve();
            this.identityStore.removeIdentityListener(listener);
          };
          this.identityStore.addIdentityListener(listener);
        }),
        new Promise<void>((_, reject) => {
          safeGlobal.setTimeout(
            reject,
            ms,
            'Timed out waiting for Amplitude Analytics SDK to initialize.',
          );
        }),
      ]);
    }
  }
}
