export const RELAY_STORAGE_KEY = 'EXP_EventStore';
export const RELAY_MIGRATED_KEY = 'EXP_MigratedOrigins';
export const RELAY_LOCK_KEY = 'EXP_WriteLock';
export const RELAY_READY_MESSAGE = 'AMP_RELAY_READY';
export const RELAY_RPC_TIMEOUT_MS = 2000;

export type RelayMessageType =
  | 'WRITE_EVENT'
  | 'READ_EVENTS'
  | 'MIGRATE_EVENTS'
  | 'CHECK_MIGRATED'
  | 'MIGRATE_ACK';

export interface RelayEventRecord {
  id: number;
  event_type: string;
  timestamp: number;
  session_id: string;
  properties: Record<string, unknown>;
}

export interface RelayEventStorage {
  events: RelayEventRecord[];
  nextId: number;
}

export interface RelayRequest {
  type: RelayMessageType;
  requestId: string;
  apiKey: string;
  payload?: unknown;
}

export interface RelayResponse {
  requestId: string;
  ok: boolean;
  payload?: unknown;
  error?: string;
}

export interface MigratePayload {
  sourceOrigin: string;
  store: RelayEventStorage;
}

export interface WriteEventPayload {
  event: RelayEventRecord;
}
