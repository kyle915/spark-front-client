import { describe, expect, it } from "vitest";
import {
  addPhoto,
  base64ToBytes,
  cleanTakeaways,
  initialRange,
  isDirty,
  MAX_DRAFT_PHOTOS,
  moveItem,
  photoPlace,
  rangeProblem,
  textSourceNote,
  type DraftText,
} from "./clientRecapDraft";

const saved: DraftText = {
  title: "Brand recap",
  summary: "Two events.",
  takeaways: ["One.", "Two."],
  photoIds: ["1", "2"],
};

describe("client recap draft", () => {
  it("opens with the dates from the link, or the last 30 days", () => {
    expect(initialRange("2026-10-01", "2026-10-31")).toEqual({
      start: "2026-10-01",
      end: "2026-10-31",
    });
    const fallback = initialRange("nope", null, new Date(2026, 10, 15));
    expect(fallback).toEqual({ start: "2026-10-16", end: "2026-11-15" });
    // An inverted pair is not trusted either.
    expect(initialRange("2026-10-31", "2026-10-01", new Date(2026, 10, 15))).toEqual(fallback);
  });

  it("explains a range that can't be drafted", () => {
    expect(rangeProblem("2026-10-01", "2026-10-31")).toBe("");
    expect(rangeProblem("", "2026-10-31")).toBe("Pick a start and an end date.");
    expect(rangeProblem("2026-10-31", "2026-10-01")).toBe(
      "The end date is before the start date.",
    );
  });

  it("drops blank takeaways and tidies spacing", () => {
    expect(cleanTakeaways(["  One   point. ", "", "   ", "Two."])).toEqual(["One point.", "Two."]);
    expect(cleanTakeaways(Array.from({ length: 12 }, (_, i) => `t${i}`))).toHaveLength(8);
  });

  it("knows when there is something to save", () => {
    expect(isDirty(saved, { ...saved })).toBe(false);
    expect(isDirty(saved, { ...saved, takeaways: ["One.", "", "Two."] })).toBe(false);
    expect(isDirty(saved, { ...saved, summary: "Three events." })).toBe(true);
    expect(isDirty(saved, { ...saved, photoIds: ["2", "1"] })).toBe(true);
    expect(isDirty(saved, { ...saved, title: "Brand October recap" })).toBe(true);
  });

  it("reorders photos one place at a time", () => {
    expect(moveItem(["a", "b", "c"], 1, -1)).toEqual(["b", "a", "c"]);
    expect(moveItem(["a", "b", "c"], 1, 1)).toEqual(["a", "c", "b"]);
    expect(moveItem(["a", "b", "c"], 0, -1)).toEqual(["a", "b", "c"]);
    expect(moveItem(["a", "b", "c"], 2, 1)).toEqual(["a", "b", "c"]);
  });

  it("adds a photo once, up to the limit", () => {
    expect(addPhoto([{ id: "1" }], { id: "2" })).toEqual([{ id: "1" }, { id: "2" }]);
    expect(addPhoto([{ id: "1" }], { id: "1" })).toEqual([{ id: "1" }]);
    const full = Array.from({ length: MAX_DRAFT_PHOTOS }, (_, i) => ({ id: String(i) }));
    expect(addPhoto(full, { id: "new" })).toHaveLength(MAX_DRAFT_PHOTOS);
  });

  it("says plainly where the words came from", () => {
    expect(textSourceNote("fallback")).toMatch(/built from the numbers/);
    expect(textSourceNote("edited")).toBe("Edited by staff.");
    expect(textSourceNote("summary")).toMatch(/already written for these dates/);
    expect(textSourceNote("model")).toMatch(/first draft/i);
    for (const source of ["model", "fallback", "edited", "summary"]) {
      expect(textSourceNote(source)).not.toMatch(/\bAI\b/);
    }
  });

  it("labels a photo with the parts it has", () => {
    expect(photoPlace({ store: "Costco", state: "CA", eventDate: "2026-10-11" })).toBe(
      "Costco, CA · Oct 11",
    );
    expect(photoPlace({ store: "", state: "", eventDate: "" })).toBe("");
  });

  it("decodes a base64 PDF", () => {
    const bytes = base64ToBytes(btoa("%PDF-1.7"));
    expect(String.fromCharCode(...bytes)).toBe("%PDF-1.7");
  });
});
