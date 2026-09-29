import { describe, it, expect } from "vitest";
import {
  clearPendingRecap,
  enqueueRecap,
  flushPendingRecap,
  memoryPhotoStore,
  offlineRecapBanner,
  pendingRecapKey,
  photoPutTimeoutMs,
  PhotoUploadTimeoutError,
  putCheckinPhoto,
  readPendingRecap,
  writePendingRecap,
  type PendingRecap,
} from "./offlineRecap";
import { formatSavedClockTime, isOfflineClockFailure, type StorageLike } from "./offlineClock";

class MemoryStorage implements StorageLike {
  private store = new Map<string, string>();
  getItem(key: string) {
    return this.store.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.store.set(key, value);
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
}

const THREE_PM = "2026-08-15T15:00:00.000-07:00";
const THREE_PM_MS = new Date(THREE_PM).getTime();

function sampleFile(name = "table.jpg") {
  return new File([new Uint8Array([1, 2, 3])], name, { type: "image/jpeg" });
}

describe("offlineRecapBanner", () => {
  it("names the tap time a BA with no bars sees", () => {
    const iso = new Date(THREE_PM).toISOString();
    const when = formatSavedClockTime(iso);
    expect(offlineRecapBanner(iso)).toBe(
      `No service — recap saved. We'll send when you're back. Time saved: ${when}.`,
    );
  });
});

describe("pending recap queue", () => {
  it("saves the form + an idempotency key next to the clock-in queue", async () => {
    const storage = new MemoryStorage();
    const photos = memoryPhotoStore();
    const pending = await enqueueRecap(
      {
        code: "FF-YMMK3Q",
        token: "sess-1",
        fieldValues: [{ customFieldId: "f1", value: "Feel Free" }],
        files: [
          {
            id: "p1",
            blobName: "already-up",
            category: "table",
            filename: "table.jpg",
            contentType: "image/jpeg",
          },
        ],
        productSamples: [],
        totalEngagements: 40,
        submittedAt: new Date(THREE_PM).toISOString(),
        nowMs: THREE_PM_MS,
      },
      storage,
      photos,
    );
    expect(pending.id).toBeTruthy();
    expect(pending.queuedAt).toBe(THREE_PM_MS);
    expect(readPendingRecap("FF-YMMK3Q", storage)?.id).toBe(pending.id);
    expect(storage.getItem(pendingRecapKey("FF-YMMK3Q"))).toContain(pending.id);
  });

  it("keeps the same idempotency key when the BA taps Submit twice", async () => {
    const storage = new MemoryStorage();
    const photos = memoryPhotoStore();
    const first = await enqueueRecap(
      {
        code: "LD-1",
        token: "t",
        fieldValues: [{ customFieldId: "f1", value: "a" }],
        files: [
          {
            id: "p1",
            blobName: "b1",
            category: null,
            filename: "a.jpg",
            contentType: "image/jpeg",
          },
        ],
        productSamples: [],
        totalEngagements: null,
        nowMs: THREE_PM_MS,
      },
      storage,
      photos,
    );
    const second = await enqueueRecap(
      {
        code: "LD-1",
        token: "t",
        fieldValues: [{ customFieldId: "f1", value: "b" }],
        files: [
          {
            id: "p1",
            blobName: "b1",
            category: null,
            filename: "a.jpg",
            contentType: "image/jpeg",
          },
        ],
        productSamples: [],
        totalEngagements: 12,
        nowMs: THREE_PM_MS + 60_000,
      },
      storage,
      photos,
    );
    expect(second.id).toBe(first.id);
    expect(second.submittedAt).toBe(first.submittedAt);
    expect(second.totalEngagements).toBe(12);
    expect(second.fieldValues[0]?.value).toBe("b");
  });

  it("clears after a successful flush and ignores a second flush", async () => {
    const storage = new MemoryStorage();
    const photos = memoryPhotoStore();
    const pending = await enqueueRecap(
      {
        code: "TW-1",
        token: "tok",
        fieldValues: [],
        files: [
          {
            id: "p1",
            blobName: "blob-1",
            category: null,
            filename: "a.jpg",
            contentType: "image/jpeg",
          },
        ],
        productSamples: [],
        totalEngagements: null,
        nowMs: THREE_PM_MS,
      },
      storage,
      photos,
    );
    const calls: Record<string, unknown>[] = [];
    const first = await flushPendingRecap(
      {
        code: "TW-1",
        postRecap: async (body) => {
          calls.push(body);
          return { ok: true, status: 200 };
        },
        putPhoto: async () => {
          throw new Error("must not re-put an already-uploaded shot");
        },
      },
      storage,
      photos,
    );
    expect(first).toBe("flushed");
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      idempotencyKey: pending.id,
      session: "tok",
    });
    expect(readPendingRecap("TW-1", storage)).toBeNull();

    const second = await flushPendingRecap(
      {
        code: "TW-1",
        postRecap: async () => {
          throw new Error("must not post again");
        },
        putPhoto: async () => ({ blobName: "x" }),
      },
      storage,
      photos,
    );
    expect(second).toBe("none");
  });

  it("sends the typed store name + number when the queued recap flushes", async () => {
    const storage = new MemoryStorage();
    const photos = memoryPhotoStore();
    await enqueueRecap(
      {
        code: "TH-2HRV3D",
        token: "tok",
        fieldValues: [],
        files: [
          {
            id: "p1",
            blobName: "blob-1",
            category: null,
            filename: "a.jpg",
            contentType: "image/jpeg",
          },
        ],
        productSamples: [],
        totalEngagements: null,
        storeName: "Total Wine & More",
        storeNumber: "1234",
        nowMs: THREE_PM_MS,
      },
      storage,
      photos,
    );
    const calls: Record<string, unknown>[] = [];
    await flushPendingRecap(
      {
        code: "TH-2HRV3D",
        postRecap: async (body) => {
          calls.push(body);
          return { ok: true, status: 200 };
        },
        putPhoto: async () => ({ blobName: "x" }),
      },
      storage,
      photos,
    );
    expect(calls[0]).toMatchObject({
      storeName: "Total Wine & More",
      storeNumber: "1234",
    });
  });

  it("treats already-filed as success so a double flush cannot double-submit", async () => {
    const storage = new MemoryStorage();
    const photos = memoryPhotoStore();
    await enqueueRecap(
      {
        code: "TW-2",
        token: "tok",
        fieldValues: [],
        files: [
          {
            id: "p1",
            blobName: "blob-1",
            category: null,
            filename: "a.jpg",
            contentType: "image/jpeg",
          },
        ],
        productSamples: [],
        totalEngagements: null,
        nowMs: THREE_PM_MS,
      },
      storage,
      photos,
    );
    const result = await flushPendingRecap(
      {
        code: "TW-2",
        postRecap: async () => ({ ok: true, status: 200, already: true }),
        putPhoto: async () => ({ blobName: "x" }),
      },
      storage,
      photos,
    );
    expect(result).toBe("already");
    expect(readPendingRecap("TW-2", storage)).toBeNull();
  });

  it("retries a signed-URL PUT for a photo that never left the phone", async () => {
    const storage = new MemoryStorage();
    const photos = memoryPhotoStore();
    const file = sampleFile();
    await enqueueRecap(
      {
        code: "TW-3",
        token: "tok",
        fieldValues: [],
        files: [
          {
            id: "p-pending",
            blobName: null,
            category: "shelf",
            filename: "shelf.jpg",
            contentType: "image/jpeg",
          },
        ],
        productSamples: [],
        totalEngagements: null,
        photoFiles: { "p-pending": file },
        nowMs: THREE_PM_MS,
      },
      storage,
      photos,
    );
    const puts: string[] = [];
    const result = await flushPendingRecap(
      {
        code: "TW-3",
        postRecap: async (body) => {
          const files = body.files as { blobName: string; category: string | null }[];
          expect(files).toEqual([{ blobName: "gcs-1", category: "shelf" }]);
          return { ok: true, status: 200 };
        },
        putPhoto: async (got) => {
          puts.push(got.name);
          return { blobName: "gcs-1" };
        },
      },
      storage,
      photos,
    );
    expect(result).toBe("flushed");
    expect(puts).toEqual(["table.jpg"]);
    expect(readPendingRecap("TW-3", storage)).toBeNull();
  });

  it("keeps the pending row when the flush is still offline", async () => {
    const storage = new MemoryStorage();
    const photos = memoryPhotoStore();
    const pending = await enqueueRecap(
      {
        code: "TW-4",
        token: "tok",
        fieldValues: [],
        files: [
          {
            id: "p1",
            blobName: "blob-1",
            category: null,
            filename: "a.jpg",
            contentType: "image/jpeg",
          },
        ],
        productSamples: [],
        totalEngagements: null,
        nowMs: THREE_PM_MS,
      },
      storage,
      photos,
    );
    const result = await flushPendingRecap(
      {
        code: "TW-4",
        postRecap: async () => {
          throw new TypeError("Failed to fetch");
        },
        putPhoto: async () => ({ blobName: "x" }),
      },
      storage,
      photos,
    );
    expect(result).toBe("retry");
    expect(readPendingRecap("TW-4", storage)?.id).toBe(pending.id);
  });

  it("round-trips a pending row through JSON storage", () => {
    const storage = new MemoryStorage();
    const row: PendingRecap = {
      v: 1,
      id: "abc",
      code: "X",
      token: "t",
      submittedAt: new Date(THREE_PM).toISOString(),
      queuedAt: THREE_PM_MS,
      fieldValues: [],
      files: [],
      productSamples: [],
      totalEngagements: null,
    };
    writePendingRecap(row, storage);
    expect(readPendingRecap("X", storage)).toEqual(row);
    clearPendingRecap("X", storage);
    expect(readPendingRecap("X", storage)).toBeNull();
  });
});

describe("putCheckinPhoto", () => {
  it("mints a fresh signed URL and PUTs the file", async () => {
    const calls: { url: string; method: string }[] = [];
    const blobName = await putCheckinPhoto({
      code: "FF-1",
      token: "tok",
      file: sampleFile(),
      apiOrigin: "https://api.example",
      fetchImpl: async (input, init) => {
        const url = String(input);
        calls.push({ url, method: (init?.method as string) || "GET" });
        if (url.includes("/upload-url")) {
          return new Response(
            JSON.stringify({
              uploadUrl: "https://signed.example/put",
              blobName: "gcs/photo.jpg",
            }),
            { status: 200 },
          );
        }
        return new Response(null, { status: 200 });
      },
    });
    expect(blobName).toEqual({ blobName: "gcs/photo.jpg" });
    expect(calls).toEqual([
      { url: "https://api.example/api/public/checkin/FF-1/upload-url", method: "POST" },
      { url: "https://signed.example/put", method: "PUT" },
    ]);
  });

  it("uploads iPhone .mov as video/mp4 so Chrome can play it", async () => {
    let signedType = "";
    let putType = "";
    await putCheckinPhoto({
      code: "KA-1",
      token: "tok",
      file: new File([new Uint8Array([1])], "activation.mov", {
        type: "video/quicktime",
      }),
      apiOrigin: "https://api.example",
      fetchImpl: async (input, init) => {
        const url = String(input);
        const headers = new Headers(init?.headers);
        if (url.includes("/upload-url")) {
          signedType = JSON.parse(String(init?.body)).contentType;
          return new Response(
            JSON.stringify({
              uploadUrl: "https://signed.example/put",
              blobName: "checkin/activation.mov",
            }),
            { status: 200 },
          );
        }
        putType = headers.get("Content-Type") || "";
        return new Response(null, { status: 200 });
      },
    });
    expect(signedType).toBe("video/mp4");
    expect(putType).toBe("video/mp4");
  });

  it("signs Android octet-stream JPEGs as image/jpeg so upload-url accepts them", async () => {
    let signedType = "";
    let filename = "";
    let putType = "";
    let bodyType = "";
    await putCheckinPhoto({
      code: "TH-1",
      token: "tok",
      file: new File([new Uint8Array([0xff, 0xd8])], "IMG_1.jpg", {
        type: "application/octet-stream",
      }),
      apiOrigin: "https://api.example",
      fetchImpl: async (input, init) => {
        const url = String(input);
        const headers = new Headers(init?.headers);
        if (url.includes("/upload-url")) {
          const parsed = JSON.parse(String(init?.body)) as {
            contentType: string;
            filename: string;
          };
          signedType = parsed.contentType;
          filename = parsed.filename;
          return new Response(
            JSON.stringify({
              uploadUrl: "https://signed.example/put",
              blobName: "checkin/IMG_1.jpg",
            }),
            { status: 200 },
          );
        }
        putType = headers.get("Content-Type") || "";
        bodyType = init?.body instanceof Blob ? init.body.type : "";
        return new Response(null, { status: 200 });
      },
    });
    expect(signedType).toBe("image/jpeg");
    expect(filename).toBe("IMG_1.jpg");
    expect(putType).toBe("image/jpeg");
    expect(bodyType).toBe("image/jpeg");
  });

  it("retries the PUT after a gateway failure, with a new signed URL", async () => {
    let puts = 0;
    const blobName = await putCheckinPhoto({
      code: "FF-1",
      token: "tok",
      file: sampleFile(),
      apiOrigin: "https://api.example",
      fetchImpl: async (input, init) => {
        const url = String(input);
        if (url.includes("/upload-url")) {
          return new Response(
            JSON.stringify({
              uploadUrl: `https://signed.example/put-${puts}`,
              blobName: "gcs/photo.jpg",
            }),
            { status: 200 },
          );
        }
        puts += 1;
        if (puts === 1) return new Response(null, { status: 503 });
        return new Response(null, { status: (init?.method === "PUT" ? 200 : 200) });
      },
    });
    expect(blobName).toEqual({ blobName: "gcs/photo.jpg" });
    expect(puts).toBe(2);
  });

  it("surfaces MIME rejects immediately without burning offline retries", async () => {
    let mints = 0;
    await expect(
      putCheckinPhoto({
        code: "FF-1",
        token: "tok",
        file: sampleFile(),
        apiOrigin: "https://api.example",
        fetchImpl: async (input) => {
          if (String(input).includes("/upload-url")) {
            mints += 1;
            return new Response(
              JSON.stringify({ message: "Only photo and video uploads are allowed here." }),
              { status: 400 },
            );
          }
          return new Response(null, { status: 200 });
        },
      }),
    ).rejects.toThrow(/Only photo and video/);
    expect(mints).toBe(1);
  });

  const hangUntilAborted = (init?: RequestInit) =>
    new Promise<Response>((_, reject) => {
      init?.signal?.addEventListener("abort", () =>
        reject(new DOMException("aborted", "AbortError")),
      );
    });

  it("fails a stalled PUT fast with a no-signal error instead of hanging", async () => {
    let puts = 0;
    const err = await putCheckinPhoto({
      code: "TH-1",
      token: "tok",
      file: sampleFile(),
      apiOrigin: "https://api.example",
      timeoutMs: { url: 50, put: 20 },
      fetchImpl: async (input, init) => {
        if (String(input).includes("/upload-url")) {
          return new Response(
            JSON.stringify({ uploadUrl: "https://signed.example/put", blobName: "b.jpg" }),
            { status: 200 },
          );
        }
        puts += 1;
        return hangUntilAborted(init);
      },
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(PhotoUploadTimeoutError);
    expect(isOfflineClockFailure({ error: err })).toBe(true);
    expect(puts).toBe(1);
  });

  it("times out a stalled upload-url mint", async () => {
    await expect(
      putCheckinPhoto({
        code: "TH-1",
        token: "tok",
        file: sampleFile(),
        apiOrigin: "https://api.example",
        timeoutMs: { url: 20 },
        fetchImpl: async (_input, init) => hangUntilAborted(init),
      }),
    ).rejects.toBeInstanceOf(PhotoUploadTimeoutError);
  });

  it("scales the PUT deadline with file size", () => {
    expect(photoPutTimeoutMs(500_000)).toBe(45_000);
    expect(photoPutTimeoutMs(32_000_000)).toBe(1_000_000);
  });
});
