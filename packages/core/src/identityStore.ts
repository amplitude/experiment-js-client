export type Identity = {
  userId?: string;
  deviceId?: string;
  userProperties?: Record<string, unknown>;
};

export type IdentityListener = (identity: Identity) => void;

export interface IdentityStore {
  editIdentity(): IdentityEditor;
  getIdentity(): Identity;
  setIdentity(identity: Identity): void;
  addIdentityListener(listener: IdentityListener): void;
  removeIdentityListener(listener: IdentityListener): void;
}

export interface IdentityEditor {
  setUserId(userId: string): IdentityEditor;
  setDeviceId(deviceId: string): IdentityEditor;
  setUserProperties(userProperties: Record<string, unknown>): IdentityEditor;
  updateUserProperties(
    actions: Record<string, Record<string, unknown>>,
  ): IdentityEditor;
  commit(): void;
}

export class IdentityStoreImpl implements IdentityStore {
  private identity: Identity = {};
  private listeners = new Set<IdentityListener>();

  editIdentity(): IdentityEditor {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    const actingIdentity = Object.assign(this.identity);
    const editor: IdentityEditor = {
      setUserId: function (userId: string): IdentityEditor {
        actingIdentity.userId = userId;
        return this;
      },
      setDeviceId: function (deviceId: string): IdentityEditor {
        actingIdentity.deviceId = deviceId;
        return this;
      },
      setUserProperties: function (
        userProperties: Record<string, unknown>,
      ): IdentityEditor {
        actingIdentity.userProperties = userProperties;
        return this;
      },
      updateUserProperties: function (
        actions: Record<string, Record<string, unknown>>,
      ): IdentityEditor {
        for (const [action, properties] of Object.entries(actions)) {
          // TODO update logic
          throw Error(`${action}, ${properties}`);
        }
        return this;
      },
      commit: function (): void {
        self.setIdentity(actingIdentity);
        return this;
      },
    };
    return editor;
  }
  getIdentity(): Identity {
    return Object.assign(this.identity);
  }
  setIdentity(identity: Identity): void {
    this.identity = Object.assign(identity);
  }
  addIdentityListener(listener: IdentityListener): void {
    this.listeners.add(listener);
  }
  removeIdentityListener(listener: IdentityListener): void {
    this.listeners.delete(listener);
  }
}
