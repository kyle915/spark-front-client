import { describe, it, expect } from "vitest";
import { buildCompletenessItems, type CompletenessInput } from "./checkinCompleteness";

const base: CompletenessInput = {
  fields: [
    { id: "f-notes", name: "Notes", required: true, type: "long_text" },
    { id: "f-spend", name: "Product Spend", required: false, type: "number" },
  ],
  values: { "f-notes": "Busy", "f-spend": "" },
  buckets: [],
  photos: [{ category: null, state: "done" }],
  hasPhotoField: false,
  usedCorpoCard: false,
  storeIdentity: false,
  store: { name: "", number: "", noNumber: false },
};

describe("buildCompletenessItems", () => {
  it("is empty when everything submit checks is answered", () => {
    expect(buildCompletenessItems(base)).toEqual([]);
  });

  it("lists an unanswered required field with its target", () => {
    const items = buildCompletenessItems({ ...base, values: { "f-notes": "" } });
    expect(items).toContainEqual(
      expect.objectContaining({ kind: "required-field", target: "f-notes" }),
    );
  });

  it("hides required fields hidden by showWhen", () => {
    const items = buildCompletenessItems({
      ...base,
      fields: [
        { id: "f-kind", name: "Kind", required: false, type: "select" },
        {
          id: "f-pours",
          name: "4oz pours served",
          required: true,
          type: "number",
          showWhen: { fieldId: "f-kind", includes: "4oz pour" },
        },
      ],
      values: { "f-kind": "Cans" },
    });
    expect(items.map((i) => i.target)).not.toContain("f-pours");
  });

  it("flags malformed spend, spend without a receipt photo, and the corpo question", () => {
    const items = buildCompletenessItems({
      ...base,
      values: { "f-notes": "Busy", "f-spend": "24.89" },
      usedCorpoCard: null,
      buckets: [{ id: "b-spend", name: "Product Spend", min: 0 }],
      photos: [],
    });
    expect(items.map((i) => i.kind)).toContain("receipt-photo");
    expect(items.map((i) => i.kind)).toContain("corpo-card");
    const bad = buildCompletenessItems({
      ...base,
      values: { "f-notes": "Busy", "f-spend": "2489" },
    });
    expect(bad.map((i) => i.kind)).toContain("spend-format");
  });

  it("does not flag a receipt when one is in the spend bucket", () => {
    const items = buildCompletenessItems({
      ...base,
      values: { "f-notes": "Busy", "f-spend": "24.89" },
      buckets: [{ id: "b-spend", name: "Product Spend", min: 0 }],
      photos: [{ category: "b-spend", state: "done" }],
    });
    expect(items.map((i) => i.kind)).not.toContain("receipt-photo");
  });

  it("lists an empty suggested bucket but never treats photos as blocking copy", () => {
    const items = buildCompletenessItems({
      ...base,
      buckets: [{ id: "b-shots", name: "Consumer Sampling Pictures", min: 8 }],
      photos: [{ category: null, state: "done" }],
    });
    const bucket = items.find((i) => i.kind === "photo-bucket");
    expect(bucket?.label).toContain("suggested");
    expect(bucket?.target).toBe("bucket:b-shots");
  });

  it("asks for a photo when none has landed and there are no buckets", () => {
    const items = buildCompletenessItems({ ...base, photos: [] });
    expect(items.map((i) => i.kind)).toContain("photos");
  });

  it("lists missing store identity before field items", () => {
    const items = buildCompletenessItems({
      ...base,
      storeIdentity: true,
      store: { name: "", number: "", noNumber: false },
    });
    expect(items[0]).toEqual(expect.objectContaining({ kind: "store", target: "store" }));
  });
});
