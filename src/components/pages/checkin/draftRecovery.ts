/**
 * Getting a BA's recap back after the page lost her session.
 *
 * The answers draft and its photos are keyed by link + session token, so the
 * next shift starts clean. That same key hides them when a BA loses the page
 * mid-recap and has to identify again: the new session gets a new token and
 * an empty form, while her answers sit on the phone under the old one. To her
 * it looks like everything is gone (FAMUS, Nov 2026).
 *
 * This finds the newest draft on this phone for the same link from another
 * session and copies it — answers, photo list and photo bytes — under the
 * current session, so the form opens with it. Copy, not move: if anything
 * fails half way the original is still there.
 *
 * Also what the crash screen reads to say "your recap is saved on this
 * phone" (CheckinErrorBoundary).
 */
import type { StorageLike } from "./offlineClock";
import { livePhotoStore, liveStorage, readPendingRecap, type PhotoBlobStore } from "./offlineRecap";
import {
  asRecapDraft,
  draftHasAnswers,
  draftStorageKey,
  draftTokenTail,
  type RecapDraft,
} from "./recapDraft";
import { draftPhotoBlobId, readDraftPhotos, writeDraftPhotos } from "./photoDraft";

/** Older drafts are a previous shift's leftovers, not this one's. */
export const OTHER_SESSION_DRAFT_MAX_AGE_MS = 36 * 60 * 60 * 1000;

const DRAFT_PREFIX = "@spark.checkin.draft/";

export type StorageWithKeys = StorageLike & {
  readonly length?: number;
  key?(index: number): string | null;
};

export function storageKeys(storage: StorageWithKeys): string[] {
  const out: string[] = [];
  try {
    const n = typeof storage.length === "number" ? storage.length : 0;
    for (let i = 0; i < n; i++) {
      const k = storage.key?.(i);
      if (k) out.push(k);
    }
  } catch {
    /* storage blocked — nothing to find */
  }
  return out;
}

export type OtherSessionDraft = { tail: string; draft: RecapDraft; photoCount: number };

/**
 * Newest draft with answers for `code` under a session other than `token`.
 * Only the shift scope: a "file another" draft belongs to that filing.
 */
export function findOtherSessionDraft(
  code: string,
  token: string | null,
  storage: StorageWithKeys = liveStorage() as StorageWithKeys,
  nowMs: number = Date.now(),
): OtherSessionDraft | null {
  if (!code) return null;
  const mine = token ? draftTokenTail(token) : "";
  const prefix = `${DRAFT_PREFIX}${code}/`;
  let best: OtherSessionDraft | null = null;
  for (const key of storageKeys(storage)) {
    if (!key.startsWith(prefix)) continue;
    const tail = key.slice(prefix.length);
    if (!tail || tail.includes("/") || tail === mine) continue;
    let draft: RecapDraft | null = null;
    try {
      const raw = storage.getItem(key);
      draft = raw ? asRecapDraft(JSON.parse(raw) as unknown) : null;
    } catch {
      draft = null;
    }
    if (!draft || !draftHasAnswers(draft)) continue;
    if (draft.savedAt && nowMs - draft.savedAt > OTHER_SESSION_DRAFT_MAX_AGE_MS) continue;
    if (!best || draft.savedAt > best.draft.savedAt) {
      best = { tail, draft, photoCount: readDraftPhotos(code, tail, storage).length };
    }
  }
  return best;
}

/**
 * Copy the other session's draft under `token`. Resolves true when the text
 * draft was written (photos are best effort: a photo whose bytes can't be
 * copied keeps its uploaded blob name if it has one).
 */
export async function adoptOtherSessionDraft(
  code: string,
  fromTail: string,
  token: string,
  storage: StorageLike = liveStorage(),
  blobs: PhotoBlobStore = livePhotoStore(),
): Promise<boolean> {
  if (!code || !fromTail || !token) return false;
  let raw: string | null = null;
  try {
    raw = storage.getItem(`${DRAFT_PREFIX}${code}/${fromTail}`);
  } catch {
    raw = null;
  }
  const draft = raw ? asRecapDraft(JSON.parse(raw) as unknown) : null;
  if (!draft) return false;
  const photos = readDraftPhotos(code, fromTail, storage);
  for (const photo of photos) {
    try {
      const file = await blobs.get(draftPhotoBlobId(code, fromTail, photo.id));
      if (file) await blobs.put(draftPhotoBlobId(code, token, photo.id), file);
    } catch {
      /* quota / private mode — the photo list still carries uploaded names */
    }
  }
  writeDraftPhotos(code, token, photos, storage);
  try {
    // Keep its savedAt so the restore banner tells the truth about when.
    storage.setItem(
      draftStorageKey(code, token),
      JSON.stringify({ ...draft, photos: draft.photos ?? photos }),
    );
    return true;
  } catch {
    return false;
  }
}

/** What the crash screen can promise is still on this phone for `code`. */
export type SavedOnPhone = {
  /** A submitted recap waiting for signal. */
  queuedRecap: boolean;
  /** A recap the server refused; held here. */
  refusedRecap: boolean;
  /** Typed answers / photos not yet submitted. */
  draft: boolean;
};

export function readSavedOnPhone(
  code: string,
  storage: StorageWithKeys = liveStorage() as StorageWithKeys,
): SavedOnPhone {
  const pending = code ? readPendingRecap(code, storage) : null;
  let draft = false;
  if (code) {
    const prefix = `${DRAFT_PREFIX}${code}/`;
    const photoPrefix = `@spark.checkin.draftPhotos/${code}/`;
    for (const key of storageKeys(storage)) {
      if (key.startsWith(photoPrefix)) {
        draft = true;
        break;
      }
      if (!key.startsWith(prefix)) continue;
      try {
        const raw = storage.getItem(key);
        if (raw && draftHasAnswers(asRecapDraft(JSON.parse(raw) as unknown))) {
          draft = true;
          break;
        }
      } catch {
        /* unreadable entry — not a promise we can make */
      }
    }
  }
  return {
    queuedRecap: Boolean(pending && !pending.rejected),
    refusedRecap: Boolean(pending?.rejected),
    draft,
  };
}

/** The crash screen's words. Never says "lost". */
export function crashScreenCopy(saved: SavedOnPhone): { title: string; body: string } {
  if (saved.queuedRecap) {
    return {
      title: "Your recap is saved on this phone",
      body: "We'll send it as soon as you have signal. Tap Send now to try right away. You don't need to fill it in again.",
    };
  }
  if (saved.refusedRecap || saved.draft) {
    return {
      title: "Your recap is saved on this phone",
      body: "Your answers and photos are still here. Tap Try again to reopen the form — you don't need to start over.",
    };
  }
  return {
    title: "This page hit a snag",
    body: "Nothing you sent is lost. Tap Try again to reload the page.",
  };
}

/** `/checkin/AB-123` → `AB-123`. */
export function checkinCodeFromPath(pathname: string): string {
  const m = /^\/checkin\/([^/?#]+)/.exec(pathname || "");
  if (!m) return "";
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return m[1];
  }
}

function savedTime(savedAt: number): string {
  const d = new Date(savedAt);
  if (!savedAt || Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/** Shown when the form reopened with the BA's own saved answers. */
export function restoredDraftBanner(savedAt: number): string {
  const when = savedTime(savedAt);
  return when
    ? `Welcome back — your answers and photos from ${when} are still here. Pick up where you left off.`
    : "Welcome back — your answers and photos are still here. Pick up where you left off.";
}

/** Offer for answers this phone kept under an earlier session on this link. */
export function otherSessionDraftBanner(found: OtherSessionDraft): string {
  const when = savedTime(found.draft.savedAt);
  const photos =
    found.photoCount > 0
      ? ` and ${found.photoCount} photo${found.photoCount === 1 ? "" : "s"}`
      : "";
  return `This phone has a recap you started earlier${when ? ` (saved ${when})` : ""}: your answers${photos}. Restore it so you don't have to start over?`;
}
