/**
 * Recap photos that survive the walk-up page being reloaded.
 *
 * "Take photo" hands the phone to the camera app. iOS Safari and Android
 * Chrome routinely discard the backgrounded tab for memory while the camera
 * is up and reload it on return, so the shot just taken — and every photo
 * before it — vanished, while the typed answers came back from the text
 * draft. The library picker opens in-page, which is why picking from the
 * photo reel kept working.
 *
 * Bytes go to IndexedDB (the offline recap queue's store, under draft-scoped
 * keys); the per-photo list goes to localStorage. Keyed by code + session
 * token like the text draft, so the next shift starts clean.
 */
import type { StorageLike } from "./offlineClock";
import { liveStorage, livePhotoStore, type PhotoBlobStore } from "./offlineRecap";

export type DraftPhoto = {
  id: string;
  /** Set once the GCS PUT landed; null means it still has to upload. */
  blobName: string | null;
  category: string | null;
  name: string;
  type: string;
};

export type RestoredDraftPhoto = { photo: DraftPhoto; file: File | null };

const tokenTail = (token: string) => token.slice(-24);

export const draftPhotosKey = (code: string, token: string) =>
  `@spark.checkin.draftPhotos/${code}/${tokenTail(token)}`;

export const draftPhotoBlobId = (code: string, token: string, id: string) =>
  `draft/${code}/${tokenTail(token)}/${id}`;

function isDraftPhoto(raw: unknown): raw is DraftPhoto {
  if (!raw || typeof raw !== "object") return false;
  const p = raw as Record<string, unknown>;
  return (
    typeof p.id === "string" &&
    p.id !== "" &&
    (p.blobName === null || typeof p.blobName === "string") &&
    (p.category === null || typeof p.category === "string")
  );
}

export function readDraftPhotos(
  code: string,
  token: string,
  storage: StorageLike = liveStorage(),
): DraftPhoto[] {
  if (!code || !token) return [];
  try {
    const raw = storage.getItem(draftPhotosKey(code, token));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isDraftPhoto).map((p) => ({
      id: p.id,
      blobName: p.blobName || null,
      category: p.category ?? null,
      name: typeof p.name === "string" ? p.name : "",
      type: typeof p.type === "string" ? p.type : "",
    }));
  } catch {
    return [];
  }
}

export function writeDraftPhotos(
  code: string,
  token: string,
  photos: DraftPhoto[],
  storage: StorageLike = liveStorage(),
): void {
  if (!code || !token) return;
  try {
    if (photos.length === 0) storage.removeItem(draftPhotosKey(code, token));
    else storage.setItem(draftPhotosKey(code, token), JSON.stringify(photos));
  } catch {
    /* quota / private mode — the in-memory photos still submit */
  }
}

export async function saveDraftPhotoFile(
  code: string,
  token: string,
  id: string,
  file: File,
  blobs: PhotoBlobStore = livePhotoStore(),
): Promise<void> {
  if (!code || !token) return;
  try {
    await blobs.put(draftPhotoBlobId(code, token, id), file);
  } catch {
    /* quota / private mode — losing the reload safety net must not fail the upload */
  }
}

export async function deleteDraftPhotoFiles(
  code: string,
  token: string,
  ids: string[],
  blobs: PhotoBlobStore = livePhotoStore(),
): Promise<void> {
  if (!code || !token || ids.length === 0) return;
  try {
    await blobs.delete(ids.map((id) => draftPhotoBlobId(code, token, id)));
  } catch {
    /* leftover blobs are harmless */
  }
}

/**
 * Photos to put back on the form. A photo whose bytes are gone is still kept
 * when it already uploaded (it files fine, it just has no preview); one that
 * never uploaded and has no bytes is unrecoverable and dropped.
 */
export async function loadDraftPhotos(
  code: string,
  token: string,
  storage: StorageLike = liveStorage(),
  blobs: PhotoBlobStore = livePhotoStore(),
): Promise<RestoredDraftPhoto[]> {
  const out: RestoredDraftPhoto[] = [];
  for (const photo of readDraftPhotos(code, token, storage)) {
    let file: File | null = null;
    try {
      file = await blobs.get(draftPhotoBlobId(code, token, photo.id));
    } catch {
      file = null;
    }
    if (!file && !photo.blobName) continue;
    out.push({ photo, file });
  }
  return out;
}

export async function clearDraftPhotos(
  code: string,
  token: string,
  storage: StorageLike = liveStorage(),
  blobs: PhotoBlobStore = livePhotoStore(),
): Promise<void> {
  const ids = readDraftPhotos(code, token, storage).map((p) => p.id);
  try {
    storage.removeItem(draftPhotosKey(code, token));
  } catch {
    /* disposable */
  }
  await deleteDraftPhotoFiles(code, token, ids, blobs);
}

// Which recap the BA had open, so a reload drops them back into it instead
// of on the clock screen. sessionStorage: it outlives a tab discard, not a
// closed tab — a BA who comes back later gets "Continue your recap" instead.
export type OpenRecapKind = "existing" | "new";

const openRecapKey = (code: string, token: string) =>
  `@spark.checkin.recapOpen/${code}/${tokenTail(token)}`;

function sessionStore(): StorageLike | null {
  try {
    if (typeof window !== "undefined" && window.sessionStorage) return window.sessionStorage;
  } catch {
    /* Safari private mode */
  }
  return null;
}

export function readOpenRecap(
  code: string,
  token: string,
  storage: StorageLike | null = sessionStore(),
): OpenRecapKind | null {
  if (!storage || !code || !token) return null;
  try {
    const raw = storage.getItem(openRecapKey(code, token));
    return raw === "existing" || raw === "new" ? raw : null;
  } catch {
    return null;
  }
}

export function writeOpenRecap(
  code: string,
  token: string,
  kind: OpenRecapKind | null,
  storage: StorageLike | null = sessionStore(),
): void {
  if (!storage || !code || !token) return;
  try {
    if (kind) storage.setItem(openRecapKey(code, token), kind);
    else storage.removeItem(openRecapKey(code, token));
  } catch {
    /* disposable */
  }
}
