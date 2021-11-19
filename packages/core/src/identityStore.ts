const ID_OP_SET = '$set';
const ID_OP_UNSET = '$unset';
const ID_OP_SET_ONCE = '$setOnce';
const ID_OP_ADD = '$add';
const ID_OP_APPEND = '$append';
const ID_OP_PREPEND = '$prepend';
const ID_OP_CLEAR_ALL = '$clearAll';

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
    const self: IdentityStore = this;
    const actingIdentity: Identity = Object.assign(this.identity);
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
            case ID_OP_SET_ONCE:
              for (const [key, value] of Object.entries(properties)) {
                if (!actingIdentity.userProperties[key]) {
                  actingProperties[key] = value;
                }
              }
              break;
            case ID_OP_ADD:
              for (const [key, value] of Object.entries(properties)) {
                const actingValue = actingProperties[key];
                if (
                  typeof actingValue === 'number' &&
                  typeof value === 'number'
                ) {
                  actingProperties[key] = actingValue + value;
                }
              }
              break;
            case ID_OP_APPEND:
              for (const [key, value] of Object.entries(properties)) {
                const actingValue = actingProperties[key];
                if (Array.isArray(actingValue) && Array.isArray(value)) {
                  actingProperties[key] = actingValue.push(...value);
                }
              }
              break;
            case ID_OP_PREPEND:
              for (const [key, value] of Object.entries(properties)) {
                const actingValue = actingProperties[key];
                if (Array.isArray(actingValue) && Array.isArray(value)) {
                  actingProperties[key] = value.push(...actingValue);
                }
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
    return editor;
  }

  getIdentity(): Identity {
    return Object.assign(this.identity);
  }

  setIdentity(identity: Identity): void {
    const originalIdentity = Object.assign(this.identity);
    this.identity = Object.assign(identity);
    if (originalIdentity != identity) {
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
