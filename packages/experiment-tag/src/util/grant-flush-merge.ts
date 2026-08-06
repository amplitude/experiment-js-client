import type { StorageType } from './storage';

/**
 * When the client runs under pending, gated reads hide durable identity the
 * visitor already consented to on an earlier visit. A grant that blindly
 * flushes the pending buffer would overwrite that sticky state — merge device
 * values in for the fields that must survive.
 */
export const mergePendingJsonWithDevice = (
  storageType: StorageType,
  key: string,
  pendingJson: string,
  readDeviceJson: (storageType: StorageType, key: string) => string | null,
): string => {
  const deviceJson = readDeviceJson(storageType, key);
  if (!deviceJson) {
    return pendingJson;
  }
  try {
    const pending = JSON.parse(pendingJson) as Record<string, unknown>;
    const device = JSON.parse(deviceJson) as Record<string, unknown>;

    if (key.endsWith('_DEFAULT_USER_PROVIDER')) {
      return JSON.stringify({
        ...pending,
        ...(device.first_seen !== undefined
          ? { first_seen: device.first_seen }
          : {}),
      });
    }

    if (key.endsWith('_rtbt_events')) {
      const pendingStore = pending as {
        events?: { uuid: string }[];
        nextId?: number;
      };
      const deviceStore = device as {
        events?: { uuid: string }[];
        nextId?: number;
      };
      const byUuid = new Map<string, unknown>();
      for (const event of deviceStore.events ?? []) {
        byUuid.set(event.uuid, event);
      }
      for (const event of pendingStore.events ?? []) {
        byUuid.set(event.uuid, event);
      }
      const events = [...byUuid.values()] as { uuid: string }[];
      return JSON.stringify({
        events,
        nextId: Math.max(
          pendingStore.nextId ?? 1,
          deviceStore.nextId ?? 1,
          events.length + 1,
        ),
      });
    }

    if (/^EXP_[^_]+$/.test(key)) {
      return JSON.stringify({
        ...pending,
        ...(device.web_exp_id !== undefined
          ? { web_exp_id: device.web_exp_id }
          : {}),
        ...(device.web_exp_id_v2 !== undefined
          ? { web_exp_id_v2: device.web_exp_id_v2 }
          : {}),
        ...(device.device_id !== undefined
          ? { device_id: device.device_id }
          : {}),
      });
    }
  } catch {
    return pendingJson;
  }
  return pendingJson;
};

/** Same merge rules for JSON held in a cross-subdomain identity cookie. */
export const mergeIdentityCookieJson = (
  deviceJson: string | undefined,
  pendingJson: string,
): string => {
  if (!deviceJson) {
    return pendingJson;
  }
  try {
    const device = JSON.parse(deviceJson) as Record<string, unknown>;
    const pending = JSON.parse(pendingJson) as Record<string, unknown>;
    return JSON.stringify({
      ...pending,
      ...(device.web_exp_id_v2 !== undefined
        ? { web_exp_id_v2: device.web_exp_id_v2 }
        : {}),
      ...(device.first_seen !== undefined
        ? { first_seen: device.first_seen }
        : {}),
    });
  } catch {
    return pendingJson;
  }
};
