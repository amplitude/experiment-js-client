/** Outcome of non-blocking relay iframe init + relay merge. */
export type RelaySyncResult =
  | { status: 'behaviors_changed' }
  | { status: 'unchanged' }
  | { status: 'unavailable' }
  | { status: 'sync_failed' };
