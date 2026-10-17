/**
 * Walk-up recap answers saved on the device.
 *
 * Keyed by the check-in code plus the session token's tail, and by scope.
 * A reload inside one shift restores the draft. The next shift mints a new
 * token, so it does not inherit the previous day's answers. "File another"
 * uses the additional scope so a second filing on the same event stays
 * separate from the open shift.
 *
 * Photos stay in photoDraft.ts (compressed bytes in IndexedDB). This module
 * only remembers that they exist, including blob names that already uploaded.
 */
import type { StorageLike } from "./offlineClock";
import { liveStorage } from "./offlineRecap";
import { clearDraftPhotos, readDraftPhotos, type DraftPhoto } from "./photoDraft";

export type DraftScope = "shift" | "additional";

export type StoreIdentityDraft = {
  name: string;
  number: string;
  noNumber: boolean;
};

export type CoBrandDraft = {
  enabled: boolean | null;
  selected: string[];
  values: Record<string, Record<string, string | string[]>>;
  samples: Record<string, Record<string, string>>;
};

export type RecapDraft = {
  v: 1;
  savedAt: number;
  values: Record<string, string | string[]>;
  samples: Record<string, string>;
  engagements: string;
  usedCorpoCard?: boolean | null;
  store?: StoreIdentityDraft;
  /** Metadata only. Bytes stay in the photo draft store. */
  photos?: DraftPhoto[];
  coBrands?: CoBrandDraft;
};

export const draftTokenTail = (token: string) => token.slice(-24);

/** Shift scope keeps the original key so a draft already on a phone restores. */
export const draftStorageKey = (
  code: string,
  token: string,
  scope: DraftScope = "shift",
) => {
  const tail = draftTokenTail(token);
  return scope === "additional"
    ? `@spark.checkin.draft/${code}/${tail}/additional`
    : `@spark.checkin.draft/${code}/${tail}`;
};

function storeOf(storage?: StorageLike): StorageLike {
  return storage ?? liveStorage();
}

function isScope(scope: DraftScope | undefined): DraftScope {
  return scope === "additional" ? "additional" : "shift";
}

export function asRecapDraft(raw: unknown): RecapDraft | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Partial<RecapDraft>;
  if (d.v != null && d.v !== 1) return null;
  if (!d.values || typeof d.values !== "object" || Array.isArray(d.values)) return null;
  return {
    v: 1,
    savedAt: typeof d.savedAt === "number" && Number.isFinite(d.savedAt) ? d.savedAt : 0,
    values: d.values,
    samples: d.samples && typeof d.samples === "object" ? d.samples : {},
    engagements: typeof d.engagements === "string" ? d.engagements : "",
    usedCorpoCard:
      d.usedCorpoCard === true || d.usedCorpoCard === false ? d.usedCorpoCard : null,
    ...(d.store ? { store: d.store } : {}),
    ...(Array.isArray(d.photos) ? { photos: d.photos } : {}),
    ...(d.coBrands ? { coBrands: d.coBrands } : {}),
  };
}

export function readDraft(
  code: string,
  token: string,
  scope: DraftScope = "shift",
  storage?: StorageLike,
): RecapDraft | null {
  if (!code || !token) return null;
  try {
    const raw = storeOf(storage).getItem(draftStorageKey(code, token, isScope(scope)));
    if (!raw) return null;
    return asRecapDraft(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

export function writeDraft(
  code: string,
  token: string,
  draft: Omit<RecapDraft, "v" | "savedAt">,
  scope: DraftScope = "shift",
  storage?: StorageLike,
): number | null {
  if (!code || !token) return null;
  try {
    const payload: RecapDraft = { v: 1, savedAt: Date.now(), ...draft };
    storeOf(storage).setItem(
      draftStorageKey(code, token, isScope(scope)),
      JSON.stringify(payload),
    );
    return payload.savedAt;
  } catch {
    return null;
  }
}

export function clearDraft(code: string, token: string, storage?: StorageLike): void {
  try {
    const s = storeOf(storage);
    s.removeItem(draftStorageKey(code, token, "shift"));
    s.removeItem(draftStorageKey(code, token, "additional"));
  } catch {
    /* the draft is disposable */
  }
  if (!storage) void clearDraftPhotos(code, token);
}

export function draftHasAnswers(d: RecapDraft | null | undefined): boolean {
  if (!d) return false;
  if ((d.photos ?? []).some((p) => p && (p.blobName || p.id))) return true;
  if ((d.engagements || "").trim()) return true;
  if (d.usedCorpoCard === true || d.usedCorpoCard === false) return true;
  if (d.store && (d.store.name.trim() || d.store.number.trim())) return true;
  if (Object.keys(d.samples || {}).some((k) => (d.samples[k] || "").trim())) return true;
  if (d.coBrands) {
    if (d.coBrands.enabled === true || d.coBrands.enabled === false) return true;
    if ((d.coBrands.selected ?? []).length > 0) return true;
  }
  return Object.values(d.values || {}).some((v) =>
    Array.isArray(v) ? v.length > 0 : Boolean(String(v || "").trim()),
  );
}

/** True when this session already has answers or photos waiting on-device. */
export function hasRecapDraft(
  code: string,
  token: string,
  storage?: StorageLike,
): boolean {
  if (!storage && readDraftPhotos(code, token).length > 0) return true;
  return draftHasAnswers(readDraft(code, token, "shift", storage));
}

/** Newer savedAt wins. A tie keeps the device copy. */
export function pickRestoredDraft(
  local: RecapDraft | null,
  server: RecapDraft | null,
): RecapDraft | null {
  if (!local) return server;
  if (!server) return local;
  return local.savedAt >= server.savedAt ? local : server;
}

export function draftSavedLabel(savedAt: number): string {
  const d = new Date(savedAt);
  if (Number.isNaN(d.getTime())) return "Draft saved";
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `Draft saved · ${time}`;
}
