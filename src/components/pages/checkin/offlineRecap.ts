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

export const RECAP_FETCH_TIMEOUT_MS = 20_000;
export const PHOTO_PUT_ATTEMPTS = 3;

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
}): Promise<{ blobName: string }> {
  const fetchImpl = args.fetchImpl ?? fetch;
  const filename = args.file.name || "photo.jpg";
  const contentType = args.file.type || "image/jpeg";
  let lastError: unknown = new Error("upload failed");

  for (let attempt = 0; attempt < PHOTO_PUT_ATTEMPTS; attempt++) {
    try {
      const urlRes = await fetchImpl(
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
      );
      let meta: { uploadUrl?: string; blobName?: string; message?: string } = {};
      try {
        meta = (await urlRes.json()) as typeof meta;
      } catch {
        meta = {};
      }
      if (!urlRes.ok || !meta.uploadUrl || !meta.blobName) {
        if (isOfflineClockFailure({ status: urlRes.status })) {
          lastError = new Error(meta.message || "no url");
          continue;
        }
        throw new Error(meta.message || "no url");
      }
      const put = await fetchImpl(meta.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body: args.file,
      });
      if (put.ok) return { blobName: meta.blobName };
      if (put.status === 401 || put.status === 403 || isOfflineClockFailure({ status: put.status })) {
        lastError = new Error("upload failed");
        continue;
      }
      throw new Error("upload failed");
    } catch (error) {
      lastError = error;
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
