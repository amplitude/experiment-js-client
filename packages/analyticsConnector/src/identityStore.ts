const ID_OP_SET = '$set';
const ID_OP_UNSET = '$unset';
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isEqual = (obj1: any, obj2: any): boolean => {
  const primitive = ['string', 'number', 'boolean', 'undefined'];
  const typeA = typeof obj1;
  const typeB = typeof obj2;
  if (typeA !== typeB) {
    return false;
  }
  for (const p of primitive) {
    if (p === typeA) {
      return obj1 === obj2;
    }
  }
  if (primitive.includes(typeA)) {
    return obj1 === obj2;
  }
  //if got here - objects
  if (obj1.length !== obj2.length) {
    return false;
  }
  //check if arrays
  const isArrayA = Array.isArray(obj1);
  const isArrayB = Array.isArray(obj2);
  if (isArrayA !== isArrayB) {
    return false;
  }
  if (isArrayA && isArrayB) {
    //arrays
    for (let i = 0; i < obj1.length; i++) {
      if (!isEqual(obj1[i], obj2[i])) {
        return false;
      }
    }
  } else {
    //objects
    const sorted1 = Object.keys(obj1).sort();
    const sorted2 = Object.keys(obj2).sort();
    if (!isEqual(sorted1, sorted2)) {
      return false;
    }
    //compare object values
    let result = true;
    Object.keys(obj1).forEach((key) => {
      if (!isEqual(obj1[key], obj2[key])) {
        result = false;
      }
    });
    return result;
  }
  return true;
};
