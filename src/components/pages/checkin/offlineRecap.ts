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
  // Reject on our own clock. Aborting the fetch is not enough: iOS Safari
  // often never settles a PUT whose body is a photo, so the tile stayed on
  // "uploading" and Submit stayed disabled until the BA gave up.
  const ctrl = new AbortController();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ctrl.abort();
      reject(new PhotoUploadTimeoutError());
    }, timeoutMs);
    fetchImpl(url, { ...init, signal: ctrl.signal }).then(
      (response) => {
        clearTimeout(timer);
        resolve(response);
      },
      (error: unknown) => {
        clearTimeout(timer);
        if (ctrl.signal.aborted) reject(new PhotoUploadTimeoutError());
        else reject(error);
      },
    );
  });
}

export type PendingRecapFile = {
  id: string;
  blobName: string | null;
  category: string | null;
  filename: string;
  contentType: string;
  sha256?: string;
  /** Failed upload attempts that were NOT connectivity (rate limit, 5xx). */
  attempts?: number;
};

/** After this many non-connectivity failures a photo is given up on, so one
 *  permanently bad file cannot hold the whole recap hostage. */
export const PHOTO_FLUSH_MAX_ATTEMPTS = 3;

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
  storeName?: string;
  storeNumber?: string;
  /** Multi-brand walk-up: one entry per other brand sampled; [] = single brand. */
  coBrands?: {
    tenantId: string;
    fieldValues: { customFieldId: string; value: string }[];
    productSamples: { productId: string; quantity: number }[];
  }[];
  /** Set when the server refused this recap for good (see
   *  classifyRecapResponse). The answers and photos stay on the device, but
   *  nothing retries until the BA taps Try again or edits and resubmits. */
  rejected?: RecapRejection;
};

export type RecapRejection = { status: number; message: string; at: number };

export type RecapSendOutcome = "sent" | "transient" | "permanent";

/**
 * What a recap POST response means for the queue.
 *
 * - sent: filed, or the server already has it (409 / `already`).
 * - transient: no answer, a timeout, a rate limit or a server fault. Worth
 *   trying again on the next tick, as before.
 * - permanent: the server read the recap and said no (4xx other than 408 /
 *   429, or a 2xx carrying `success: false`). The same bytes will get the
 *   same answer, so retrying every tick only hides the problem from the BA.
 */
export function classifyRecapResponse(res: {
  ok: boolean;
  status: number;
  already?: boolean;
}): RecapSendOutcome {
  if (res.ok || res.already || res.status === 409) return "sent";
  if (isOfflineClockFailure({ status: res.status })) return "transient";
  if (res.status >= 400 && res.status < 500) return "permanent";
  if (res.status >= 200 && res.status < 300) return "permanent";
  return "transient";
}

/**
 * A live Submit that got this status back should go to the on-phone queue
 * rather than show an error over the form. Same line the queue itself draws
 * (classifyRecapResponse "transient"): no answer, a timeout, a rate limit,
 * or any 5xx — including a Cloud Run 500/502/504 HTML page the phone can't
 * even read. The live path used to queue only 0/408/429/502/503/504, so a
 * plain 500 left the BA staring at "Couldn't submit" with no retry.
 */
export function shouldQueueRecapResponse(status: number): boolean {
  return classifyRecapResponse({ ok: false, status }) === "transient";
}

/** Background retry for a queued recap while the page is open. `online` and
 *  `visibilitychange` were the only triggers, and neither fires for a phone
 *  that keeps one weak bar with the page in front of the BA. */
export const QUEUE_RETRY_DELAYS_MS = [15_000, 30_000, 60_000, 120_000, 300_000];

export function queueRetryDelayMs(attempt: number): number {
  const i = Math.max(0, Math.min(attempt, QUEUE_RETRY_DELAYS_MS.length - 1));
  return QUEUE_RETRY_DELAYS_MS[i];
}

export const NO_PHOTOS_SENT_MESSAGE =
  "None of the photos for this recap could be uploaded from this phone";

/** Copy for a recap the server refused. Nothing here is lost: say so. */
export function rejectedRecapBanner(rejection: RecapRejection): string {
  const reason = rejection.message.trim().replace(/[.!\s]+$/, "");
  return (
    (reason
      ? `This recap could not be sent: ${reason}. `
      : "This recap could not be sent. ") +
    "Your answers are saved on this phone. Tap to try again or contact Ignite."
  );
}

/** The right line for a queued recap: still waiting to send, or refused. */
export function pendingRecapBanner(pending: PendingRecap): string {
  return pending.rejected
    ? rejectedRecapBanner(pending.rejected)
    : offlineRecapBanner(pending.submittedAt);
}

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

export function liveStorage(): StorageLike {
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
          // A full device (QuotaExceededError) aborts the transaction without
          // an error event — without this the put never settles.
          tx.onabort = () => reject(tx.error ?? new Error("idb put aborted"));
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
          tx.onabort = () => reject(tx.error ?? new Error("idb delete aborted"));
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
    ? `Saved on your phone — we'll send your recap when you have signal. You don't need to fill it in again. Saved at ${when}.`
    : "Saved on your phone — we'll send your recap when you have signal. You don't need to fill it in again.";
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
    storeName?: string;
    storeNumber?: string;
    coBrands?: PendingRecap["coBrands"];
    submittedAt?: string;
    nowMs?: number;
    photoFiles?: Record<string, File>;
    /** The key the live send already used, so a queued retry of a send whose
     *  answer was lost is recognised by the server instead of filed again. */
    id?: string;
  },
  storage: StorageLike = liveStorage(),
  photos: PhotoBlobStore = livePhotoStore(),
): Promise<PendingRecap> {
  const existing = readPendingRecap(args.code, storage);
  const nowMs = args.nowMs ?? Date.now();
  const submittedAt = args.submittedAt ?? new Date(nowMs).toISOString();
  const pending: PendingRecap = {
    v: 1,
    id:
      existing && existing.token === args.token
        ? existing.id
        : args.id || newIdempotencyKey(),
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
    storeName: args.storeName,
    storeNumber: args.storeNumber,
    coBrands: args.coBrands,
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

export type RecapFlushResult = "none" | "flushed" | "retry" | "already" | "rejected";

function markRecapRejected(
  pending: PendingRecap,
  rejection: { status: number; message?: string },
  storage: StorageLike,
): void {
  writePendingRecap(
    {
      ...pending,
      rejected: {
        status: rejection.status,
        message: String(rejection.message ?? "").trim(),
        at: Date.now(),
      },
    },
    storage,
  );
}

/**
 * The BA tapped Try again on a refused recap: lift the hold so the next
 * flush posts it again, and give photos that were given up on a fresh run.
 * Returns the row as it now stands (null if there is nothing queued).
 */
export function clearRecapRejection(
  code: string,
  storage: StorageLike = liveStorage(),
): PendingRecap | null {
  const pending = readPendingRecap(code, storage);
  if (!pending || !pending.rejected) return pending;
  const rest: PendingRecap = { ...pending };
  delete rest.rejected;
  return writePendingRecap(
    {
      ...rest,
      files: rest.files.map((f) => (f.blobName ? f : { ...f, attempts: 0 })),
    },
    storage,
  );
}

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
      message?: string;
    }>;
    putPhoto: (file: File, token: string) => Promise<{ blobName: string }>;
  },
  storage: StorageLike = liveStorage(),
  photos: PhotoBlobStore = livePhotoStore(),
): Promise<RecapFlushResult> {
  const existing = inflightRecap.get(args.code);
  if (existing) return existing;
  const p = flushRecapOnce(args, storage, photos).finally(() =>
    inflightRecap.delete(args.code),
  );
  inflightRecap.set(args.code, p);
  return p;
}

// One flush per link at a time — see the same guard in offlineClock.ts. Two
// concurrent flushes filed the same recap (and its photos) twice.
const inflightRecap = new Map<string, Promise<RecapFlushResult>>();

async function flushRecapOnce(
  args: Parameters<typeof flushPendingRecap>[0],
  storage: StorageLike,
  photos: PhotoBlobStore,
): Promise<RecapFlushResult> {
  const pending = readPendingRecap(args.code, storage);
  if (!pending) return "none";
  // Refused for good: held on the device until the BA asks for another try.
  if (pending.rejected) return "rejected";

  const files = pending.files.map((f) => ({ ...f }));
  for (const file of files) {
    if (file.blobName) continue;
    if ((file.attempts ?? 0) >= PHOTO_FLUSH_MAX_ATTEMPTS) continue; // given up
    let blob: File | null | undefined;
    try {
      blob = await photos.get(file.id);
    } catch {
      blob = null;
    }
    if (!blob) continue; // bytes are gone from this device: nothing to send
    try {
      const { blobName } = await args.putPhoto(blob, pending.token);
      file.blobName = blobName;
      writePendingRecap({ ...pending, files }, storage);
    } catch (error) {
      if (isOfflineClockFailure({ error })) return "retry";
      // A rate limit or server blip is not a reason to file the recap
      // WITHOUT this photo and then delete it. Hold the recap and try the
      // photo again next flush; only give up after repeated failures.
      file.attempts = (file.attempts ?? 0) + 1;
      writePendingRecap({ ...pending, files }, storage);
      if (file.attempts < PHOTO_FLUSH_MAX_ATTEMPTS) return "retry";
    }
  }

  const uploaded = files.filter((f) => f.blobName);
  if (uploaded.length === 0) {
    // Every photo is either given up on or no longer on this device, so no
    // later tick can change the answer. This used to "retry" silently
    // forever without making a single request.
    markRecapRejected({ ...pending, files }, { status: 0, message: NO_PHOTOS_SENT_MESSAGE }, storage);
    return "rejected";
  }

  try {
    const res = await args.postRecap({
      session: pending.token,
      idempotencyKey: pending.id,
      fieldValues: pending.fieldValues,
      files: uploaded.map((f) => ({
        blobName: f.blobName,
        category: f.category,
        ...(f.sha256 ? { sha256: f.sha256 } : {}),
      })),
      productSamples: pending.productSamples,
      totalEngagements: pending.totalEngagements,
      usedCorpoCard: pending.usedCorpoCard,
      ...(pending.storeName
        ? { storeName: pending.storeName, storeNumber: pending.storeNumber ?? "" }
        : {}),
      ...(pending.coBrands ? { coBrands: pending.coBrands } : {}),
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
    if (classifyRecapResponse(res) === "permanent") {
      // Keep everything (answers, photos, draft) and stop the loop. The page
      // shows why, with a way to try again.
      markRecapRejected({ ...pending, files }, res, storage);
      return "rejected";
    }
    return "retry";
  } catch {
    // Thrown = the request never got an answer. Always worth another try.
    return "retry";
  }
}
