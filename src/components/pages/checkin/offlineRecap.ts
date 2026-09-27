/**
 * Offline recap submit queue for walk-up `/checkin/:code`.
 *
 * Clock-in already queues when the stockroom has no bars. Recap Submit used
 * to die on a live fetch — photos + answers gone from the BA's point of
 * view. Same localStorage family as the clock-in queue and the recap draft:
 * keep the tap, retry signed-URL PUTs, POST once the phone is back, and do
 * not clear the draft until the server ACKs.
 *
 * `id` is the idempotency key. A double flush (online + visibility) must
 * not file two recaps.
 */

import {
  isOfflineClockFailure,
  newIdempotencyKey,
  formatSavedClockTime,
  type StorageLike,
} from "./offlineClock";
import { browserPlayableContentType } from "@/utils/recapFileUrl";

export const RECAP_FETCH_TIMEOUT_MS = 20_000;
export const PHOTO_PUT_ATTEMPTS = 3;
export const PHOTO_URL_TIMEOUT_MS = 20_000;
const PHOTO_PUT_MIN_TIMEOUT_MS = 45_000;
// Slowest link we'll wait out: one bar of LTE inside a big-box store.
const PHOTO_PUT_MIN_BYTES_PER_SEC = 32_000;

export const NO_SIGNAL_PHOTO_MESSAGE =
  "No signal — photos are still on this screen. Tap Retry once you have bars.";

// A stalled request on weak-but-present signal never errors on its own; the
// tile sat on "UPLOADING" forever and Submit stayed blocked. Named
// TimeoutError so isOfflineClockFailure treats it as connectivity.
export class PhotoUploadTimeoutError extends Error {
  constructor() {
    super(NO_SIGNAL_PHOTO_MESSAGE);
    this.name = "TimeoutError";
  }
}

export function photoPutTimeoutMs(bytes: number): number {
  return Math.max(
    PHOTO_PUT_MIN_TIMEOUT_MS,
    Math.ceil((bytes / PHOTO_PUT_MIN_BYTES_PER_SEC) * 1000),
  );
}

async function fetchWithDeadline(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...init, signal: ctrl.signal });
  } catch (error) {
    if (ctrl.signal.aborted) throw new PhotoUploadTimeoutError();
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export type PendingRecapFile = {
  id: string;
  blobName: string | null;
  category: string | null;
  filename: string;
  contentType: string;
};

export type PendingRecap = {
  v: 1;
  id: string;
  code: string;
  token: string;
  submittedAt: string;
  queuedAt: number;
  fieldValues: { customFieldId: string; value: string }[];
  files: PendingRecapFile[];
  productSamples: { productId: string; quantity: number }[];
  totalEngagements: number | null;
  forceNew?: boolean;
  shiftLabel?: string;
  secondShift?: boolean;
  usedCorpoCard?: boolean | null;
};

export type PhotoBlobStore = {
  put(id: string, file: File): Promise<void>;
  get(id: string): Promise<File | null>;
  delete(ids: string[]): Promise<void>;
};

const memoryStore = new Map<string, string>();
const memoryStorage: StorageLike = {
  getItem: (key) => memoryStore.get(key) ?? null,
  setItem: (key, value) => {
    memoryStore.set(key, value);
  },
  removeItem: (key) => {
    memoryStore.delete(key);
  },
};

function liveStorage(): StorageLike {
  try {
    if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
  } catch {
    /* Safari private mode throws on even *reading* localStorage */
  }
  return memoryStorage;
}

export const pendingRecapKey = (code: string) => `@spark.checkin.pendingRecap/${code}`;

export function memoryPhotoStore(): PhotoBlobStore {
  const blobs = new Map<string, File>();
  return {
    async put(id, file) {
      blobs.set(id, file);
    },
    async get(id) {
      return blobs.get(id) ?? null;
    },
    async delete(ids) {
      for (const id of ids) blobs.delete(id);
    },
  };
}

const IDB_NAME = "spark-checkin";
const IDB_STORE = "recap-photos";

function openRecapPhotoDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("no indexedDB"));
      return;
    }
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("idb open failed"));
  });
}

export function idbPhotoStore(): PhotoBlobStore {
  return {
    async put(id, file) {
      const db = await openRecapPhotoDb();
      try {
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(IDB_STORE, "readwrite");
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error ?? new Error("idb put failed"));
          tx.objectStore(IDB_STORE).put(
            { blob: file, name: file.name, type: file.type },
            id,
          );
        });
      } finally {
        db.close();
      }
    },
    async get(id) {
      const db = await openRecapPhotoDb();
      try {
        const row = await new Promise<{ blob: Blob; name: string; type: string } | File | null>(
          (resolve, reject) => {
            const tx = db.transaction(IDB_STORE, "readonly");
            const req = tx.objectStore(IDB_STORE).get(id);
            req.onsuccess = () => resolve((req.result as { blob: Blob; name: string; type: string } | File | null) ?? null);
            req.onerror = () => reject(req.error ?? new Error("idb get failed"));
          },
        );
        if (!row) return null;
        if (row instanceof File) return row;
        return new File([row.blob], row.name || "photo.jpg", {
          type: row.type || "image/jpeg",
        });
      } finally {
        db.close();
      }
    },
    async delete(ids) {
      if (!ids.length) return;
      const db = await openRecapPhotoDb();
      try {
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(IDB_STORE, "readwrite");
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error ?? new Error("idb delete failed"));
          const store = tx.objectStore(IDB_STORE);
          for (const id of ids) store.delete(id);
        });
      } finally {
        db.close();
      }
    },
  };
}

const fallbackPhotoStore = memoryPhotoStore();

export function livePhotoStore(): PhotoBlobStore {
  try {
    if (typeof indexedDB !== "undefined") return idbPhotoStore();
  } catch {
    /* private mode */
  }
  return fallbackPhotoStore;
}

export function offlineRecapBanner(iso: string): string {
  const when = formatSavedClockTime(iso);
  return when
    ? `No service — recap saved. We'll send when you're back. Time saved: ${when}.`
    : "No service — recap saved. We'll send when you're back.";
}

export function readPendingRecap(
  code: string,
  storage: StorageLike = liveStorage(),
): PendingRecap | null {
  if (!code) return null;
  try {
    const raw = storage.getItem(pendingRecapKey(code));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingRecap;
    if (!parsed || parsed.v !== 1 || parsed.code !== code) return null;
    if (!parsed.id || !parsed.token || !Array.isArray(parsed.files)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writePendingRecap(
  pending: PendingRecap,
  storage: StorageLike = liveStorage(),
): PendingRecap | null {
  try {
    storage.setItem(pendingRecapKey(pending.code), JSON.stringify(pending));
    return pending;
  } catch {
    return null;
  }
}

export function clearPendingRecap(code: string, storage: StorageLike = liveStorage()): void {
  try {
    storage.removeItem(pendingRecapKey(code));
  } catch {
    /* disposable */
  }
}

export async function enqueueRecap(
  args: {
    code: string;
    token: string;
    fieldValues: PendingRecap["fieldValues"];
    files: PendingRecapFile[];
    productSamples: PendingRecap["productSamples"];
    totalEngagements: number | null;
    forceNew?: boolean;
    shiftLabel?: string;
    secondShift?: boolean;
    usedCorpoCard?: boolean | null;
    submittedAt?: string;
    nowMs?: number;
    photoFiles?: Record<string, File>;
  },
  storage: StorageLike = liveStorage(),
  photos: PhotoBlobStore = livePhotoStore(),
): Promise<PendingRecap> {
  const existing = readPendingRecap(args.code, storage);
  const nowMs = args.nowMs ?? Date.now();
  const submittedAt = args.submittedAt ?? new Date(nowMs).toISOString();
  const pending: PendingRecap = {
    v: 1,
    id: existing && existing.token === args.token ? existing.id : newIdempotencyKey(),
    code: args.code,
    token: args.token,
    submittedAt: existing && existing.token === args.token ? existing.submittedAt : submittedAt,
    queuedAt: existing && existing.token === args.token ? existing.queuedAt : nowMs,
    fieldValues: args.fieldValues,
    files: args.files,
    productSamples: args.productSamples,
    totalEngagements: args.totalEngagements,
    forceNew: args.forceNew,
    shiftLabel: args.shiftLabel,
    secondShift: args.secondShift,
    usedCorpoCard: args.usedCorpoCard,
  };
  writePendingRecap(pending, storage);
  if (args.photoFiles) {
    for (const [id, file] of Object.entries(args.photoFiles)) {
      try {
        await photos.put(id, file);
      } catch {
        /* quota / private — flush can still send blobNames that already landed */
      }
    }
  }
  return pending;
}

export type RecapFlushResult = "none" | "flushed" | "retry" | "already";

const UPLOAD_NAME_EXT = new Set([
  "jpg",
  "jpeg",
  "png",
  "heic",
  "heif",
  "webp",
  "gif",
  "avif",
  "mp4",
  "mov",
  "m4v",
  "webm",
  "3gp",
]);

function checkinUploadFilename(name: string, contentType: string): string {
  const clean = name.split("?")[0]?.split("#")[0] ?? "";
  const dot = clean.lastIndexOf(".");
  const ext = dot >= 0 ? clean.slice(dot + 1).toLowerCase() : "";
  if (UPLOAD_NAME_EXT.has(ext)) return clean || "photo.jpg";
  const suffix =
    contentType === "image/png"
      ? "png"
      : contentType === "image/heic"
        ? "heic"
        : contentType === "image/heif"
          ? "heif"
          : contentType === "image/webp"
            ? "webp"
            : contentType === "video/webm"
              ? "webm"
              : contentType.startsWith("video/")
                ? "mp4"
                : "jpg";
  const base = (clean.replace(/\.[^.]+$/, "") || "photo").replace(/\.+$/, "") || "photo";
  return `${base}.${suffix}`;
}

/**
 * Mint a signed URL and PUT the file. Fresh URL each attempt so an expired
 * signature is not a dead end. Network / gateway failures retry; 4xx other
 * than 408 do not loop forever.
 */
export async function putCheckinPhoto(args: {
  code: string;
  token: string;
  file: File;
  apiOrigin: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: { url?: number; put?: number };
}): Promise<{ blobName: string }> {
  const fetchImpl = args.fetchImpl ?? fetch;
  const contentType = browserPlayableContentType({
    type: args.file.type,
    name: args.file.name || "photo.jpg",
  });
  const filename = checkinUploadFilename(args.file.name || "photo.jpg", contentType);
  // Stamp the blob type to the signed type. Chrome on Android will PUT the
  // File's own type and ignore a mismatched Content-Type header, which 403s
  // a v4 signature (the .mov → video/mp4 rewrite hit this).
  const body =
    args.file.type === contentType && args.file.name === filename
      ? args.file
      : new File([args.file], filename, { type: contentType });
  const urlTimeoutMs = args.timeoutMs?.url ?? PHOTO_URL_TIMEOUT_MS;
  const putTimeoutMs = args.timeoutMs?.put ?? photoPutTimeoutMs(body.size);
  let lastError: unknown = new Error("upload failed");

  for (let attempt = 0; attempt < PHOTO_PUT_ATTEMPTS; attempt++) {
    try {
      const urlRes = await fetchWithDeadline(
        fetchImpl,
        `${args.apiOrigin}/api/public/checkin/${encodeURIComponent(args.code)}/upload-url`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session: args.token,
            filename,
            contentType,
          }),
        },
        urlTimeoutMs,
      );
      let meta: { uploadUrl?: string; blobName?: string; message?: string } = {};
      try {
        meta = (await urlRes.json()) as typeof meta;
      } catch {
        meta = {};
      }
      if (!urlRes.ok || !meta.uploadUrl || !meta.blobName) {
        const detail =
          meta.message ||
          (urlRes.status === 429
            ? "Too many photo uploads — wait a minute, then tap Retry."
            : "Couldn't prepare that photo for upload.");
        if (isOfflineClockFailure({ status: urlRes.status })) {
          lastError = new Error(detail);
          // Rate limits need breathing room; thrashing 3 remints makes it worse.
          if (urlRes.status === 429 && attempt + 1 < PHOTO_PUT_ATTEMPTS) {
            await new Promise((r) => setTimeout(r, 2500 * (attempt + 1)));
          }
          continue;
        }
        throw new Error(detail);
      }
      const put = await fetchWithDeadline(
        fetchImpl,
        meta.uploadUrl,
        {
          method: "PUT",
          headers: { "Content-Type": contentType },
          body,
        },
        putTimeoutMs,
      );
      if (put.ok) return { blobName: meta.blobName };
      if (put.status === 401 || put.status === 403 || isOfflineClockFailure({ status: put.status })) {
        lastError = new Error("upload failed");
        continue;
      }
      throw new Error("upload failed");
    } catch (error) {
      lastError = error;
      // Re-trying a stalled link just triples the wait before Retry shows.
      if (error instanceof PhotoUploadTimeoutError) throw error;
      if (!isOfflineClockFailure({ error })) throw error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("upload failed");
}

export async function flushPendingRecap(
  args: {
    code: string;
    postRecap: (body: Record<string, unknown>) => Promise<{
      ok: boolean;
      status: number;
      already?: boolean;
    }>;
    putPhoto: (file: File, token: string) => Promise<{ blobName: string }>;
  },
  storage: StorageLike = liveStorage(),
  photos: PhotoBlobStore = livePhotoStore(),
): Promise<RecapFlushResult> {
  const pending = readPendingRecap(args.code, storage);
  if (!pending) return "none";

  const files = pending.files.map((f) => ({ ...f }));
  for (const file of files) {
    if (file.blobName) continue;
    try {
      const blob = await photos.get(file.id);
      if (!blob) continue;
      const { blobName } = await args.putPhoto(blob, pending.token);
      file.blobName = blobName;
      writePendingRecap({ ...pending, files }, storage);
    } catch (error) {
      if (isOfflineClockFailure({ error })) return "retry";
      // Leave this shot behind; others may still file.
    }
  }

  const uploaded = files.filter((f) => f.blobName);
  if (uploaded.length === 0) return "retry";

  try {
    const res = await args.postRecap({
      session: pending.token,
      idempotencyKey: pending.id,
      fieldValues: pending.fieldValues,
      files: uploaded.map((f) => ({ blobName: f.blobName, category: f.category })),
      productSamples: pending.productSamples,
      totalEngagements: pending.totalEngagements,
      usedCorpoCard: pending.usedCorpoCard,
      forceNew: pending.forceNew,
      ...(pending.forceNew && pending.shiftLabel
        ? { shiftLabel: pending.shiftLabel, secondShift: pending.secondShift ?? true }
        : {}),
    });
    if (res.ok || res.already || res.status === 409) {
      try {
        await photos.delete(pending.files.map((f) => f.id));
      } catch {
        /* leftover blobs are cheaper than a stuck queue */
      }
      clearPendingRecap(args.code, storage);
      return res.already ? "already" : "flushed";
    }
    if (isOfflineClockFailure({ status: res.status })) return "retry";
    return "retry";
  } catch (error) {
    if (isOfflineClockFailure({ error })) return "retry";
    return "retry";
  }
}
