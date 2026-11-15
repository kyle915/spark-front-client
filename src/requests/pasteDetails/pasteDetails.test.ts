import { describe, expect, it } from "vitest";
import {
  advanceQueue,
  draftChecks,
  draftFormValues,
  formatDraftDate,
  formatDraftTime,
  hasFullAddress,
  queueLabel,
  withTyped,
  type PastedDraft,
} from "./pasteDetails";

const draft = (over: Partial<PastedDraft> = {}): PastedDraft => ({
  date: "2026-11-20",
  dateAsTyped: "11/20/2026",
  yearAssumed: false,
  dateWarning: "",
  startTime: "10:00",
  startAsTyped: "10a",
  endTime: "13:00",
  endAsTyped: "1p",
  timeAssumed: false,
  storeName: "Heb 725",
  matchedStoreName: "H-E-B",
  storeNumber: "725",
  streetAddress: "2701 E 7th St",
  city: "Austin",
  state: "TX",
  zip: "78702",
  address: "2701 E 7th St, Austin, TX 78702",
  notes: " Check in with the beverage manager ",
  products: [
    { uuid: "u1", name: "Mango Chainsaw" },
    { uuid: "u9", name: "Severed Lime" },
  ],
  unmatchedProducts: [],
  couldNotRead: [],
  ...over,
});

const catalog = [
  { id: "UHJvZHVjdDox", uuid: "u1", name: "Mango Chainsaw" },
  { id: "UHJvZHVjdDoy", uuid: "u2", name: "Berry It Alive" },
];

describe("draft form values", () => {
  it("uses the store name Spark already has and keeps the store number on it", () => {
    const v = draftFormValues(draft(), catalog);
    expect(v.venue).toBe("H-E-B #725");
    expect(v.storeNumber).toBe("725");
    expect(v.address).toBe("2701 E 7th St, Austin, TX 78702");
    expect(v.notes).toBe("Check in with the beverage manager");
  });

  it("uses a new store name as it was typed", () => {
    const v = draftFormValues(
      draft({ storeName: "Corner Bottle Shop", matchedStoreName: "", storeNumber: "" }),
      catalog,
    );
    expect(v.venue).toBe("Corner Bottle Shop");
    expect(draftFormValues(draft({ storeNumber: "" }), catalog).venue).toBe("H-E-B");
  });

  it("selects only products this form lists", () => {
    const v = draftFormValues(draft(), catalog);
    expect(v.productIds).toEqual(["UHJvZHVjdDox"]);
    expect(v.productsToAddByHand).toEqual(["Severed Lime"]);
  });

  it("leaves a date or time the text did not give empty", () => {
    const v = draftFormValues(draft({ date: "", startTime: "", endTime: "" }), catalog);
    expect([v.date, v.startTime, v.endTime]).toEqual(["", "", ""]);
  });
});

describe("what the person checking is shown", () => {
  it("formats dates and times", () => {
    expect(formatDraftDate("2026-11-20")).toBe("Friday, November 20, 2026");
    expect(formatDraftDate("2027-01-09")).toBe("Saturday, January 9, 2027");
    expect(formatDraftDate("2027-02-30")).toBe("");
    expect(formatDraftDate("")).toBe("");
    expect(formatDraftTime("10:00")).toBe("10:00 AM");
    expect(formatDraftTime("13:30")).toBe("1:30 PM");
    expect(formatDraftTime("00:00")).toBe("12:00 AM");
    expect(formatDraftTime("12:00")).toBe("12:00 PM");
    expect(formatDraftTime("")).toBe("");
    expect(formatDraftTime("25:00")).toBe("");
  });

  it("shows what was typed next to what was read", () => {
    expect(withTyped("10:00 AM", "10a")).toBe("10:00 AM (typed “10a”)");
    expect(withTyped("H-E-B", "h-e-b")).toBe("H-E-B");
    expect(withTyped("", "morning")).toBe("Could not read “morning”");
    expect(withTyped("", "")).toBe("");
  });

  it("says when a year or AM/PM was assumed, and what did not match", () => {
    const d = draft({
      date: "2026-12-05",
      yearAssumed: true,
      timeAssumed: true,
      dateWarning: "The text says Friday, but December 5, 2026 is a Saturday.",
      storeName: "Corner Bottle Shop",
      matchedStoreName: "",
      unmatchedProducts: ["Zombie Punch"],
    });
    const lines = draftChecks(d, draftFormValues(d, catalog));
    expect(lines).toEqual([
      "No year was written. Saturday, December 5, 2026 is the next time that date comes round.",
      "The text says Friday, but December 5, 2026 is a Saturday.",
      "AM or PM was missing from one of the times, so it was taken from the other.",
      "“Corner Bottle Shop” is not a store name already used for this client. Check the spelling.",
      "Not in this client's product list, so not selected: Zombie Punch.",
      "Select by hand: Severed Lime.",
    ]);
    const clean = draft({ products: [{ uuid: "u1", name: "Mango Chainsaw" }] });
    expect(draftChecks(clean, draftFormValues(clean, catalog))).toEqual([]);
  });

  it("knows a full address from a partial one", () => {
    expect(hasFullAddress("2701 E 7th St, Austin, TX 78702")).toBe(true);
    expect(hasFullAddress("2410 Smith St, Houston")).toBe(false);
    expect(hasFullAddress("")).toBe(false);
  });
});

describe("the queue of drafts", () => {
  it("steps through the drafts one at a time and ends", () => {
    const drafts = [draft(), draft({ storeName: "Total Wine" }), draft({ storeName: "Spec's" })];
    let queue = { drafts, index: 0 } as ReturnType<typeof advanceQueue>;
    expect(queueLabel(queue!)).toBe("Draft 1 of 3");
    queue = advanceQueue(queue);
    expect(queue?.index).toBe(1);
    queue = advanceQueue(queue);
    expect(queueLabel(queue!)).toBe("Draft 3 of 3");
    expect(advanceQueue(queue)).toBeNull();
    expect(advanceQueue(null)).toBeNull();
    expect(queueLabel({ drafts: [draft()], index: 0 })).toBe("1 draft");
  });
});
