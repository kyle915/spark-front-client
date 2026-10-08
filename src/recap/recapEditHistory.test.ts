import { describe, expect, it } from "vitest";
import {
  editedNote,
  groupRecapEdits,
  originalValues,
  type RecapMetricEdit,
} from "./recapEditHistory";

const edit = (over: Partial<RecapMetricEdit>): RecapMetricEdit => ({
  id: "1",
  batch: "b1",
  fieldKey: "field:1",
  fieldLabel: "Consumers sampled",
  oldValue: "50",
  newValue: "80",
  reason: "",
  editedByName: "Kyle Christiansen",
  editedAt: "2026-10-07T18:00:00+00:00",
  ...over,
});

// Newest first, as the API returns them.
const edits = [
  edit({ id: "3", batch: "b2", oldValue: "80", newValue: "85", reason: "recount" }),
  edit({ id: "2", batch: "b1", fieldKey: "field:2", fieldLabel: "Packs", oldValue: "4", newValue: "6" }),
  edit({ id: "1", batch: "b1" }),
];

describe("recap edit history", () => {
  it("groups rows into one entry per save, newest first", () => {
    const batches = groupRecapEdits(edits);
    expect(batches.map((b) => b.batch)).toEqual(["b2", "b1"]);
    expect(batches[0].reason).toBe("recount");
    expect(batches[1].changes.map((c) => c.fieldLabel)).toEqual([
      "Packs",
      "Consumers sampled",
    ]);
  });

  it("keeps the BA's original submitted value per field", () => {
    const originals = originalValues(edits);
    expect(originals.get("field:1")).toBe("50");
    expect(originals.get("field:2")).toBe("4");
  });

  it("summarises the latest editor", () => {
    expect(editedNote(edits)).toMatch(/^Edited by Kyle Christiansen on Oct \d+, 2026$/);
    expect(editedNote([])).toBeNull();
  });
});
