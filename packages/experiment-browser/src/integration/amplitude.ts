import {
  ApplicationContextProvider,
  EventBridge,
  IdentityStore,
} from '@amplitude/analytics-connector';
import { safeGlobal } from '@amplitude/experiment-core';

import { ExperimentEvent, IntegrationPlugin } from '../types/plugin';
import { ExperimentUser, UserProperties } from '../types/user';
import {
  AmplitudeState,
  parseAmplitudeCookie,
  parseAmplitudeLocalStorage,
  parseAmplitudeSessionStorage,
} from '../util/state';

export class AmplitudeIntegrationPlugin implements IntegrationPlugin {
  type: 'integration';
  private readonly apiKey: string | undefined;
  private readonly identityStore: IdentityStore;
  private readonly eventBridge: EventBridge;
  private readonly contextProvider: ApplicationContextProvider;
  private readonly timeoutMillis: number;

  setup: (() => Promise<void>) | undefined = undefined;

  constructor(
    apiKey: string | undefined,
    identityStore: IdentityStore,
    eventBridge: EventBridge,
    contextProvider: ApplicationContextProvider,
    timeoutMillis: number,
  ) {
    this.apiKey = apiKey;
    this.identityStore = identityStore;
    this.eventBridge = eventBridge;
    this.contextProvider = contextProvider;
    this.timeoutMillis = timeoutMillis;
    const userLoaded = this.loadPersistedState();
    if (!userLoaded) {
      this.setup = async (): Promise<void> => {
        return this.waitForConnectorIdentity(this.timeoutMillis);
      };
    }
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
    if (!this.apiKey) {
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
