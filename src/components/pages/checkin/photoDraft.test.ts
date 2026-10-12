import { describe, it, expect } from "vitest";
import {
  clearDraftPhotos,
  deleteDraftPhotoFiles,
  draftPhotoBlobId,
  draftPhotosKey,
  loadDraftPhotos,
  readDraftPhotos,
  readOpenRecap,
  saveDraftPhotoFile,
  writeDraftPhotos,
  writeOpenRecap,
  type DraftPhoto,
} from "./photoDraft";
import { memoryPhotoStore, type PhotoBlobStore } from "./offlineRecap";
import type { StorageLike } from "./offlineClock";

class MemoryStorage implements StorageLike {
  store = new Map<string, string>();
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

const CODE = "LD-TNBJ8K";
const TOKEN = "session-token-abcdefghijklmnopqrstuvwxyz";

// iOS names every camera capture "image.jpg"; Android often sends no type.
function cameraShot(name = "image.jpg", type = "image/jpeg") {
  return new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], name, { type });
}

function meta(id: string, blobName: string | null, category: string | null = "table"): DraftPhoto {
  return { id, blobName, category, name: "image.jpg", type: "image/jpeg" };
}

describe("draft photos survive a page reload", () => {
  it("restores uploaded and still-uploading camera shots with their bytes and bucket", async () => {
    const storage = new MemoryStorage();
    const blobs = memoryPhotoStore();
    await saveDraftPhotoFile(CODE, TOKEN, "a", cameraShot(), blobs);
    await saveDraftPhotoFile(CODE, TOKEN, "b", cameraShot(), blobs);
    writeDraftPhotos(
      CODE,
      TOKEN,
      [meta("a", "recap_files/checkin/evt/1-image.jpg"), meta("b", null, "shelf")],
      storage,
    );

    const back = await loadDraftPhotos(CODE, TOKEN, storage, blobs);

    expect(back.map((r) => [r.photo.id, r.photo.blobName, r.photo.category])).toEqual([
      ["a", "recap_files/checkin/evt/1-image.jpg", "table"],
      ["b", null, "shelf"],
    ]);
    expect(back.every((r) => r.file?.name === "image.jpg")).toBe(true);
  });

  it("keeps an uploaded photo whose bytes are gone, drops an unuploaded one", async () => {
    const storage = new MemoryStorage();
    const blobs = memoryPhotoStore();
    writeDraftPhotos(CODE, TOKEN, [meta("done", "recap_files/checkin/evt/x.jpg"), meta("lost", null)], storage);

    const back = await loadDraftPhotos(CODE, TOKEN, storage, blobs);

    expect(back).toEqual([{ photo: meta("done", "recap_files/checkin/evt/x.jpg"), file: null }]);
  });

  it("drops and deletes entries whose saved bytes can't be read (dead IndexedDB blobs)", async () => {
    const storage = new MemoryStorage();
    const blobs = memoryPhotoStore();
    // What iOS hands back after the tab died mid-write: a Blob that throws on read.
    const dead = cameraShot();
    Object.defineProperty(dead, "arrayBuffer", {
      value: () => Promise.reject(new Error("WebKitBlobResource error 1")),
    });
    await blobs.put(draftPhotoBlobId(CODE, TOKEN, "dead"), dead);
    await blobs.put(draftPhotoBlobId(CODE, TOKEN, "empty"), new File([], "image.jpg", { type: "image/jpeg" }));
    await saveDraftPhotoFile(CODE, TOKEN, "ok", cameraShot(), blobs);
    await blobs.put(draftPhotoBlobId(CODE, TOKEN, "uploaded"), dead);
    writeDraftPhotos(
      CODE,
      TOKEN,
      [meta("dead", null), meta("empty", null), meta("ok", null), meta("uploaded", "recap_files/checkin/evt/u.jpg")],
      storage,
    );

    const back = await loadDraftPhotos(CODE, TOKEN, storage, blobs);

    expect(back.map((r) => [r.photo.id, r.file ? "file" : "none"])).toEqual([
      ["ok", "file"],
      ["uploaded", "none"],
    ]);
    expect(readDraftPhotos(CODE, TOKEN, storage).map((p) => p.id)).toEqual(["ok", "uploaded"]);
    expect(await blobs.get(draftPhotoBlobId(CODE, TOKEN, "dead"))).toBeNull();
    expect(await blobs.get(draftPhotoBlobId(CODE, TOKEN, "empty"))).toBeNull();
  });

  it("restored files are in-memory copies, not the stored Blob", async () => {
    const storage = new MemoryStorage();
    const blobs = memoryPhotoStore();
    const stored = cameraShot();
    await saveDraftPhotoFile(CODE, TOKEN, "a", stored, blobs);
    writeDraftPhotos(CODE, TOKEN, [meta("a", null)], storage);
    const [r] = await loadDraftPhotos(CODE, TOKEN, storage, blobs);
    expect(r.file).not.toBe(stored);
    expect(r.file?.name).toBe("image.jpg");
    expect(r.file?.type).toBe("image/jpeg");
    expect(new Uint8Array(await r.file!.arrayBuffer())).toEqual(new Uint8Array(await stored.arrayBuffer()));
  });

  it("is scoped to the session token, so the next shift starts clean", async () => {
    const storage = new MemoryStorage();
    writeDraftPhotos(CODE, TOKEN, [meta("a", "blob")], storage);
    expect(readDraftPhotos(CODE, "a-different-session-token-entirely", storage)).toEqual([]);
    expect(draftPhotoBlobId(CODE, TOKEN, "a")).not.toBe(
      draftPhotoBlobId(CODE, "a-different-session-token-entirely", "a"),
    );
  });

  it("clears the list and the bytes together", async () => {
    const storage = new MemoryStorage();
    const blobs = memoryPhotoStore();
    await saveDraftPhotoFile(CODE, TOKEN, "a", cameraShot(), blobs);
    writeDraftPhotos(CODE, TOKEN, [meta("a", null)], storage);

    await clearDraftPhotos(CODE, TOKEN, storage, blobs);

    expect(storage.getItem(draftPhotosKey(CODE, TOKEN))).toBeNull();
    expect(await blobs.get(draftPhotoBlobId(CODE, TOKEN, "a"))).toBeNull();
  });

  it("writing an empty list removes the key", () => {
    const storage = new MemoryStorage();
    writeDraftPhotos(CODE, TOKEN, [meta("a", null)], storage);
    writeDraftPhotos(CODE, TOKEN, [], storage);
    expect(storage.store.size).toBe(0);
  });

  it("ignores garbage in storage instead of throwing", () => {
    const storage = new MemoryStorage();
    storage.setItem(draftPhotosKey(CODE, TOKEN), "{not json");
    expect(readDraftPhotos(CODE, TOKEN, storage)).toEqual([]);
    storage.setItem(draftPhotosKey(CODE, TOKEN), JSON.stringify([{ id: 3 }, meta("ok", null)]));
    expect(readDraftPhotos(CODE, TOKEN, storage).map((p) => p.id)).toEqual(["ok"]);
  });

  it("a failing blob store never throws into the upload path", async () => {
    const broken: PhotoBlobStore = {
      put: async () => {
        throw new Error("QuotaExceededError");
      },
      get: async () => {
        throw new Error("idb gone");
      },
      delete: async () => {
        throw new Error("idb gone");
      },
    };
    const storage = new MemoryStorage();
    await expect(saveDraftPhotoFile(CODE, TOKEN, "a", cameraShot("", ""), broken)).resolves.toBeUndefined();
    await expect(deleteDraftPhotoFiles(CODE, TOKEN, ["a"], broken)).resolves.toBeUndefined();
    writeDraftPhotos(CODE, TOKEN, [meta("a", "blob")], storage);
    expect(await loadDraftPhotos(CODE, TOKEN, storage, broken)).toEqual([
      { photo: meta("a", "blob"), file: null },
    ]);
  });
});

describe("open recap marker", () => {
  it("remembers which recap form was open for this session", () => {
    const storage = new MemoryStorage();
    expect(readOpenRecap(CODE, TOKEN, storage)).toBeNull();
    writeOpenRecap(CODE, TOKEN, "existing", storage);
    expect(readOpenRecap(CODE, TOKEN, storage)).toBe("existing");
    writeOpenRecap(CODE, TOKEN, "new", storage);
    expect(readOpenRecap(CODE, TOKEN, storage)).toBe("new");
    writeOpenRecap(CODE, TOKEN, null, storage);
    expect(readOpenRecap(CODE, TOKEN, storage)).toBeNull();
  });

  it("no storage (private mode) means no reopen", () => {
    writeOpenRecap(CODE, TOKEN, "existing", null);
    expect(readOpenRecap(CODE, TOKEN, null)).toBeNull();
  });
});
