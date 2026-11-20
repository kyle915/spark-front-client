import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import CheckinErrorBoundary, { crashDetail } from "./CheckinErrorBoundary";
import {
  adoptOtherSessionDraft,
  checkinCodeFromPath,
  crashScreenCopy,
  findOtherSessionDraft,
  otherSessionDraftBanner,
  readSavedOnPhone,
  restoredDraftBanner,
  OTHER_SESSION_DRAFT_MAX_AGE_MS,
  type StorageWithKeys,
} from "./draftRecovery";
import {
  enqueueRecap,
  memoryPhotoStore,
  pendingRecapKey,
  queueRetryDelayMs,
  QUEUE_RETRY_DELAYS_MS,
  readPendingRecap,
  shouldQueueRecapResponse,
} from "./offlineRecap";
import { draftStorageKey, readDraft } from "./recapDraft";
import { draftPhotoBlobId, draftPhotosKey, readDraftPhotos } from "./photoDraft";
import {
  identityConfirmHint,
  isUsCellPhone,
} from "./checkinSession";

class KeyedStorage implements StorageWithKeys {
  private m = new Map<string, string>();
  get length() {
    return this.m.size;
  }
  key(i: number) {
    return [...this.m.keys()][i] ?? null;
  }
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
}

const CODE = "FM-PAG4TX";
const OLD = "old-session-token-aaaaaaaaaaaaaaaaaaaaaaaa";
const NEW = "new-session-token-bbbbbbbbbbbbbbbbbbbbbbbb";
const NOW = Date.UTC(2026, 10, 20, 19, 3);

function seedDraft(storage: KeyedStorage, token: string, savedAt: number, values = { f1: "42" }) {
  storage.setItem(
    draftStorageKey(CODE, token),
    JSON.stringify({ v: 1, savedAt, values, samples: {}, engagements: "" }),
  );
}

describe("findOtherSessionDraft", () => {
  it("finds the answers an earlier session left on this phone", () => {
    const s = new KeyedStorage();
    seedDraft(s, OLD, NOW - 3 * 3600_000);
    s.setItem(
      draftPhotosKey(CODE, OLD),
      JSON.stringify([{ id: "p1", blobName: null, category: null, name: "a.jpg", type: "image/jpeg" }]),
    );
    const found = findOtherSessionDraft(CODE, NEW, s, NOW);
    expect(found?.draft.values).toEqual({ f1: "42" });
    expect(found?.photoCount).toBe(1);
    expect(otherSessionDraftBanner(found!)).toContain("1 photo");
  });

  it("ignores this session's own draft, empty drafts, other links and old shifts", () => {
    const s = new KeyedStorage();
    seedDraft(s, NEW, NOW);
    seedDraft(s, "empty-session-cccccccccccccccccccccccc", NOW, {} as { f1: string });
    s.setItem(
      draftStorageKey("OTHER-1", OLD),
      JSON.stringify({ v: 1, savedAt: NOW, values: { f1: "x" }, samples: {}, engagements: "" }),
    );
    seedDraft(s, OLD, NOW - OTHER_SESSION_DRAFT_MAX_AGE_MS - 1);
    expect(findOtherSessionDraft(CODE, NEW, s, NOW)).toBeNull();
  });

  it("picks the newest when several sessions left drafts", () => {
    const s = new KeyedStorage();
    seedDraft(s, OLD, NOW - 7200_000, { f1: "older" });
    seedDraft(s, "mid-session-dddddddddddddddddddddddd", NOW - 600_000, { f1: "newer" });
    expect(findOtherSessionDraft(CODE, NEW, s, NOW)?.draft.values).toEqual({ f1: "newer" });
  });
});

describe("adoptOtherSessionDraft", () => {
  it("copies answers, photo list and photo bytes under the new session", async () => {
    const s = new KeyedStorage();
    const blobs = memoryPhotoStore();
    seedDraft(s, OLD, NOW - 3600_000);
    const tail = OLD.slice(-24);
    s.setItem(
      draftPhotosKey(CODE, OLD),
      JSON.stringify([{ id: "p1", blobName: null, category: null, name: "a.jpg", type: "image/jpeg" }]),
    );
    await blobs.put(draftPhotoBlobId(CODE, OLD, "p1"), new File(["x"], "a.jpg", { type: "image/jpeg" }));

    expect(await adoptOtherSessionDraft(CODE, tail, NEW, s, blobs)).toBe(true);
    const copied = readDraft(CODE, NEW, "shift", s);
    expect(copied?.values).toEqual({ f1: "42" });
    expect(copied?.savedAt).toBe(NOW - 3600_000);
    expect(readDraftPhotos(CODE, NEW, s).map((p) => p.id)).toEqual(["p1"]);
    expect(await blobs.get(draftPhotoBlobId(CODE, NEW, "p1"))).not.toBeNull();
    // Copy, not move.
    expect(readDraft(CODE, OLD, "shift", s)).not.toBeNull();
  });

  it("says no when there is nothing to copy", async () => {
    expect(await adoptOtherSessionDraft(CODE, "nope", NEW, new KeyedStorage(), memoryPhotoStore())).toBe(false);
  });
});

describe("crash screen", () => {
  it("promises a queued recap will send, and never says lost", async () => {
    const s = new KeyedStorage();
    await enqueueRecap(
      {
        code: CODE,
        token: NEW,
        fieldValues: [],
        files: [],
        productSamples: [],
        totalEngagements: null,
      },
      s,
      memoryPhotoStore(),
    );
    const saved = readSavedOnPhone(CODE, s);
    expect(saved.queuedRecap).toBe(true);
    const copy = crashScreenCopy(saved);
    expect(copy.title).toBe("Your recap is saved on this phone");
    expect(copy.body).toMatch(/Send now/);
    expect(`${copy.title} ${copy.body}`).not.toMatch(/lost/i);
  });

  it("knows about an unsent draft (answers or photos)", () => {
    const s = new KeyedStorage();
    seedDraft(s, OLD, NOW);
    expect(readSavedOnPhone(CODE, s).draft).toBe(true);
    expect(crashScreenCopy(readSavedOnPhone(CODE, s)).title).toBe(
      "Your recap is saved on this phone",
    );
    expect(readSavedOnPhone("OTHER", s).draft).toBe(false);
  });

  it("with nothing saved, still offers a way forward", () => {
    const copy = crashScreenCopy({ queuedRecap: false, refusedRecap: false, draft: false });
    expect(copy.title).toBe("This page hit a snag");
  });

  it("reads the link code from the path", () => {
    expect(checkinCodeFromPath("/checkin/FM-PAG4TX")).toBe("FM-PAG4TX");
    expect(checkinCodeFromPath("/checkin/FM-PAG4TX/extra")).toBe("FM-PAG4TX");
    expect(checkinCodeFromPath("/r/abc")).toBe("");
  });

  it("boundary renders the saved-on-phone screen instead of nothing", () => {
    const b = new CheckinErrorBoundary({ children: null, pathname: "/checkin/FM-PAG4TX" });
    b.state = { ...b.state, ...CheckinErrorBoundary.getDerivedStateFromError(new Error("boom")) };
    const html = renderToStaticMarkup(b.render() as ReactElement);
    expect(html).toContain("Try again");
    expect(html).toContain('role="alert"');
  });

  it("passes children through when nothing broke", () => {
    const b = new CheckinErrorBoundary({ children: "form", pathname: "/checkin/X" });
    expect(b.render()).toBe("form");
  });

  it("keeps the crash detail short and free of the page's data", () => {
    const err = new TypeError("Failed to fetch dynamically imported module: " + "x".repeat(400));
    const d = crashDetail(err);
    expect(d.startsWith("TypeError: Failed to fetch")).toBe(true);
    expect(d.length).toBeLessThanOrEqual(160);
  });
});

describe("restored draft banner", () => {
  it("names the save time", () => {
    expect(restoredDraftBanner(NOW)).toMatch(/^Welcome back — your answers and photos from /);
    expect(restoredDraftBanner(0)).toBe(
      "Welcome back — your answers and photos are still here. Pick up where you left off.",
    );
  });
});

describe("live submit failure handling", () => {
  it("queues every no-answer / gateway / server-fault status", () => {
    for (const status of [0, 408, 429, 500, 502, 503, 504, 520]) {
      expect(shouldQueueRecapResponse(status)).toBe(true);
    }
  });
  it("does not queue a refusal the BA has to fix", () => {
    for (const status of [400, 401, 403, 404, 413]) {
      expect(shouldQueueRecapResponse(status)).toBe(false);
    }
  });
  it("backs off and then holds at the last step", () => {
    expect(queueRetryDelayMs(0)).toBe(QUEUE_RETRY_DELAYS_MS[0]);
    expect(queueRetryDelayMs(99)).toBe(QUEUE_RETRY_DELAYS_MS[QUEUE_RETRY_DELAYS_MS.length - 1]);
    expect(queueRetryDelayMs(-1)).toBe(QUEUE_RETRY_DELAYS_MS[0]);
  });
  it("a queued retry keeps the key the live send used", async () => {
    const s = new KeyedStorage();
    const p = await enqueueRecap(
      {
        code: CODE,
        token: NEW,
        fieldValues: [],
        files: [],
        productSamples: [],
        totalEngagements: null,
        forceNew: true,
        id: "live-key-1",
      },
      s,
      memoryPhotoStore(),
    );
    expect(p.id).toBe("live-key-1");
    expect(readPendingRecap(CODE, s)?.id).toBe("live-key-1");
    expect(s.getItem(pendingRecapKey(CODE))).toContain("live-key-1");
  });
});

describe("identify phone checks", () => {
  it("accepts 10 digits, with or without +1 and punctuation", () => {
    expect(isUsCellPhone("2705550129")).toBe(true);
    expect(isUsCellPhone("+1 (270) 555-0129")).toBe(true);
    expect(isUsCellPhone("1-270-555-0129")).toBe(true);
  });
  it("refuses a number a digit short or long", () => {
    expect(isUsCellPhone("270555012")).toBe(false);
    expect(isUsCellPhone("27055501299")).toBe(false);
    expect(isUsCellPhone("")).toBe(false);
  });
  it("reads only the last two digits from an Is-this-you answer", () => {
    expect(identityConfirmHint(400, { error: "confirm_identity", phoneHint: "29" })).toBe("29");
    expect(identityConfirmHint(400, { error: "confirm_identity", phoneHint: "2705550129" })).toBe("29");
    expect(identityConfirmHint(400, { error: "bad_phone" })).toBeNull();
    expect(identityConfirmHint(200, { error: "confirm_identity", phoneHint: "29" })).toBeNull();
  });
});
