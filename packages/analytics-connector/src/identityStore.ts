import { isEqual } from './util/equals';

const ID_OP_SET = '$set';
const ID_OP_UNSET = '$unset';
const ID_OP_CLEAR_ALL = '$clearAll';

// Polyfill for Object.entries
if (!Object.entries) {
  Object.entries = function (obj) {
    const ownProps = Object.keys(obj);
    let i = ownProps.length;
    const resArray = new Array(i);
    while (i--) {
      resArray[i] = [ownProps[i], obj[ownProps[i]]];
    }
    return resArray;
  };
}

export type Identity = {
  userId?: string;
  deviceId?: string;
  userProperties?: Record<string, unknown>;
  optOut?: boolean;
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
  setOptOut(optOut: boolean): IdentityEditor;
  updateUserProperties(
    actions: Record<string, Record<string, unknown>>,
  ): IdentityEditor;
  commit(): void;
}

export class IdentityStoreImpl implements IdentityStore {
  private identity: Identity = { userProperties: {} };
  private listeners = new Set<IdentityListener>();

  editIdentity(): IdentityEditor {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self: IdentityStore = this;
    const actingUserProperties = { ...this.identity.userProperties };
    const actingIdentity: Identity = {
      ...this.identity,
      userProperties: actingUserProperties,
    };
    return {
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

      setOptOut(optOut: boolean): IdentityEditor {
        actingIdentity.optOut = optOut;
        return this;
      },

      updateUserProperties: function (
        actions: Record<string, Record<string, unknown>>,
      ): IdentityEditor {
        let actingProperties = actingIdentity.userProperties || {};
        for (const [action, properties] of Object.entries(actions)) {
          switch (action) {
            case ID_OP_SET:
              for (const [key, value] of Object.entries(properties)) {
                actingProperties[key] = value;
              }
              break;
            case ID_OP_UNSET:
              for (const key of Object.keys(properties)) {
                delete actingProperties[key];
              }
              break;
            case ID_OP_CLEAR_ALL:
              actingProperties = {};
              break;
          }
        }
        actingIdentity.userProperties = actingProperties;
        return this;
      },

      commit: function (): void {
        self.setIdentity(actingIdentity);
        return this;
      },
    };
  }

  getIdentity(): Identity {
    return { ...this.identity };
  }

  setIdentity(identity: Identity): void {
    const originalIdentity = { ...this.identity };
    this.identity = { ...identity };
    if (!isEqual(originalIdentity, this.identity)) {
      this.listeners.forEach((listener) => {
        listener(identity);
      });
    }
  }

  addIdentityListener(listener: IdentityListener): void {
    this.listeners.add(listener);
  }

  removeIdentityListener(listener: IdentityListener): void {
    this.listeners.delete(listener);
  }
}
