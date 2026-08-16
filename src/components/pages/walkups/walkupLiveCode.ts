/**
 * Persist the live per-event walk-up code on this device.
 *
 * The API only returns the code from generateWalkupCode — there is no Event
 * field to re-read. Without this, a refresh shows Generate even though a
 * code is already live, and ops reprint a new one by accident.
 */

import type { StorageLike } from "@/components/pages/checkin/offlineClock";

export type LiveWalkupCode = {
  code: string;
  expiresAt: string | null;
};

export const walkupLiveKey = (eventUuid: string) => `@spark.walkup.live/${eventUuid}`;

function liveStorage(): StorageLike | null {
  try {
    if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
  } catch {
    /* Safari private mode */
  }
  return null;
}

export function readLiveWalkupCode(
  eventUuid: string,
  storage: StorageLike | null = liveStorage(),
): LiveWalkupCode | null {
  if (!eventUuid || !storage) return null;
  try {
    const raw = storage.getItem(walkupLiveKey(eventUuid));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LiveWalkupCode;
    if (!parsed?.code) return null;
    return { code: parsed.code, expiresAt: parsed.expiresAt ?? null };
  } catch {
    return null;
  }
}

export function writeLiveWalkupCode(
  eventUuid: string,
  live: LiveWalkupCode,
  storage: StorageLike | null = liveStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(walkupLiveKey(eventUuid), JSON.stringify(live));
  } catch {
    /* private mode — the in-memory panel state still holds this session */
  }
}

export function clearLiveWalkupCode(
  eventUuid: string,
  storage: StorageLike | null = liveStorage(),
): void {
  if (!storage) return;
  try {
    storage.removeItem(walkupLiveKey(eventUuid));
  } catch {
    /* disposable */
  }
}
