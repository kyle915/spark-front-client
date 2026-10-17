import { describe, expect, it } from "vitest";
import type { StorageLike } from "./offlineClock";
import {
  clearDraft,
  draftHasAnswers,
  draftSavedLabel,
  draftStorageKey,
  pickRestoredDraft,
  readDraft,
  writeDraft,
  type RecapDraft,
} from "./recapDraft";
import { buildRecapDraftRequest, requestFilesRecap } from "./recapServerDraft";

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
const THURSDAY = "session-thursday-aaaaaaaaaaaaaaaaaaaaaaaa";
const FRIDAY = "session-friday-bbbbbbbbbbbbbbbbbbbbbbbb";

const answers = {
  values: { notes: "Busy aisle, 40 samples", sku: ["Grapefruit"] },
  samples: { "sku-1": "12" },
  engagements: "40",
  usedCorpoCard: false as const,
};

describe("walk-up recap draft restores after a reload", () => {
  it("reads back the answers saved for this shift", () => {
    const storage = new MemoryStorage();
    const savedAt = writeDraft(CODE, THURSDAY, answers, "shift", storage);
    expect(savedAt).toEqual(expect.any(Number));

    const restored = readDraft(CODE, THURSDAY, "shift", storage);
    expect(restored?.values.notes).toBe("Busy aisle, 40 samples");
    expect(restored?.values.sku).toEqual(["Grapefruit"]);
    expect(restored?.samples["sku-1"]).toBe("12");
    expect(restored?.engagements).toBe("40");
    expect(restored?.usedCorpoCard).toBe(false);
    expect(draftSavedLabel(restored?.savedAt ?? 0).startsWith("Draft saved")).toBe(true);
  });

  it("a new shift does not see the previous shift's draft", () => {
    const storage = new MemoryStorage();
    writeDraft(CODE, THURSDAY, answers, "shift", storage);

    expect(readDraft(CODE, FRIDAY, "shift", storage)).toBeNull();
    expect(draftStorageKey(CODE, THURSDAY)).not.toBe(draftStorageKey(CODE, FRIDAY));
    expect(readDraft(CODE, THURSDAY, "shift", storage)?.engagements).toBe("40");
  });

  it("an additional filing does not inherit the open shift", () => {
    const storage = new MemoryStorage();
    writeDraft(CODE, THURSDAY, answers, "shift", storage);
    writeDraft(
      CODE,
      THURSDAY,
      { values: { notes: "second stop" }, samples: {}, engagements: "3" },
      "additional",
      storage,
    );

    expect(readDraft(CODE, THURSDAY, "shift", storage)?.values.notes).toBe(
      "Busy aisle, 40 samples",
    );
    expect(readDraft(CODE, THURSDAY, "additional", storage)?.values.notes).toBe(
      "second stop",
    );
  });

  it("clears both scopes for the token it is given", () => {
    const storage = new MemoryStorage();
    writeDraft(CODE, THURSDAY, answers, "shift", storage);
    writeDraft(CODE, FRIDAY, { values: { notes: "today" }, samples: {}, engagements: "" }, "shift", storage);
    clearDraft(CODE, THURSDAY, storage);

    expect(readDraft(CODE, THURSDAY, "shift", storage)).toBeNull();
    expect(readDraft(CODE, FRIDAY, "shift", storage)?.values.notes).toBe("today");
  });

  it("keeps the newer copy when the device and the server both have a draft", () => {
    const older: RecapDraft = { v: 1, savedAt: 10, values: { notes: "old" }, samples: {}, engagements: "" };
    const newer: RecapDraft = { v: 1, savedAt: 20, values: { notes: "new" }, samples: {}, engagements: "" };
    expect(pickRestoredDraft(older, newer)?.values.notes).toBe("new");
    expect(pickRestoredDraft(newer, older)?.values.notes).toBe("new");
    expect(pickRestoredDraft(null, older)?.values.notes).toBe("old");
    expect(draftHasAnswers(older)).toBe(true);
    expect(draftHasAnswers({ v: 1, savedAt: 1, values: {}, samples: {}, engagements: "" })).toBe(
      false,
    );
  });
});

describe("server draft save is not a submit", () => {
  it("posts to recap-draft and does not file or approve", () => {
    const storage = new MemoryStorage();
    const savedAt = writeDraft(CODE, THURSDAY, answers, "shift", storage);
    const draft = readDraft(CODE, THURSDAY, "shift", storage);
    expect(draft).not.toBeNull();
    expect(savedAt).not.toBeNull();

    const req = buildRecapDraftRequest({
      code: CODE,
      session: THURSDAY,
      scope: "shift",
      draft: draft as RecapDraft,
    });

    expect(req.path).toBe(`/api/public/checkin/${CODE}/recap-draft`);
    expect(requestFilesRecap(req.path)).toBe(false);
    expect(requestFilesRecap(`/api/public/checkin/${CODE}/recap`)).toBe(true);
    expect(req.body).not.toHaveProperty("approved");
    expect(req.body).not.toHaveProperty("submit");
    expect(req.body).not.toHaveProperty("files");
    expect(req.body.draft.values.notes).toBe("Busy aisle, 40 samples");
    expect(req.body.scope).toBe("shift");
  });
});
