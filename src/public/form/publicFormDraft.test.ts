import { describe, it, expect } from "vitest";
import {
  clearPublicFormDraft,
  hasPublicFormDraftContent,
  publicFormDraftKey,
  readPublicFormDraft,
  writePublicFormDraft,
  type DraftStorage,
  type PublicFormDraft,
} from "./publicFormDraft";

function fakeStorage(): DraftStorage {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}

const blank: Omit<PublicFormDraft, "v" | "slug" | "savedAt"> = {
  venue: "",
  address: "",
  latitude: null,
  longitude: null,
  storeQ: "",
  pickedStore: null,
  date: "",
  extraDates: [],
  visitSlots: [{ date: "", startTime: "12:00", endTime: "16:00" }],
  startTime: "12:00",
  endTime: "16:00",
  timezoneId: "",
  requestTypeId: "",
  productIds: [],
  productNameById: {},
  selectedProductTypeId: null,
  requestorEmail: "",
  requestorName: "",
  storeContact: "",
  storeManagerName: "",
  storeManagerPhone: "",
  baCount: 1,
  distributorQ: "",
  distributorId: "",
  distributorName: "",
  notes: "",
  schedulingStatus: "",
  nonActiveProductRequired: "",
  casesToBeShipped: "",
  accountSpendAmount: "",
  eventAssetsNeeded: "",
  loadInTime: "",
  onsitePoc: "",
  additionalTeamDetails: "",
  multiBrand: null,
  coBrandSelection: {},
};

describe("public form draft", () => {
  it("saves and restores a draft keyed by tenant slug", () => {
    const storage = fakeStorage();
    writePublicFormDraft(
      "wook-water",
      {
        ...blank,
        venue: "Valley Beer",
        visitSlots: [{ date: "2026-10-20", startTime: "09:00", endTime: "13:00" }],
        baCount: 3,
        productIds: ["p1"],
      },
      storage,
      1234,
    );
    expect(storage.getItem(publicFormDraftKey("wook-water"))).toBeTruthy();
    // Another tenant never sees this draft.
    expect(readPublicFormDraft("famus-energy", storage)).toBeNull();

    const restored = readPublicFormDraft("wook-water", storage);
    expect(restored).toMatchObject({
      venue: "Valley Beer",
      baCount: 3,
      productIds: ["p1"],
      savedAt: 1234,
    });
    expect(restored?.visitSlots).toEqual([
      { date: "2026-10-20", startTime: "09:00", endTime: "13:00" },
    ]);
  });

  it("clears on demand (successful submit / Discard)", () => {
    const storage = fakeStorage();
    writePublicFormDraft("drink-lyft", { ...blank, venue: "Arena" }, storage);
    clearPublicFormDraft("drink-lyft", storage);
    expect(readPublicFormDraft("drink-lyft", storage)).toBeNull();
  });

  it("treats a blank form as no draft worth resuming", () => {
    const storage = fakeStorage();
    expect(hasPublicFormDraftContent(blank)).toBe(false);
    writePublicFormDraft("drink-lyft", blank, storage);
    expect(readPublicFormDraft("drink-lyft", storage)).toBeNull();
  });

  it("ignores corrupt or foreign-saved payloads", () => {
    const storage = fakeStorage();
    storage.setItem(publicFormDraftKey("drink-lyft"), "{not json");
    expect(readPublicFormDraft("drink-lyft", storage)).toBeNull();
    storage.setItem(
      publicFormDraftKey("drink-lyft"),
      JSON.stringify({ v: 1, slug: "other-tenant", venue: "Arena" }),
    );
    expect(readPublicFormDraft("drink-lyft", storage)).toBeNull();
  });
});
