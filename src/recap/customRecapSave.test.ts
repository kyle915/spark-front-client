import { describe, it, expect } from "vitest";
import {
  buildCustomFieldValuesPayload,
  invalidNumberFieldEdit,
  totalEngagementsToSend,
} from "./customRecapSave";

describe("invalidNumberFieldEdit", () => {
  const number = { name: "number" };
  const fields = [
    { id: "1", name: "Consumers sampled", value: "50", customFieldType: number },
    { id: "2", name: "Notes", value: "", customFieldType: { name: "text" } },
    { id: "3", name: "Packs purchased", value: "about 4", customFieldType: number },
  ];

  it("accepts whole numbers, decimals and thousands separators", () => {
    expect(invalidNumberFieldEdit(fields, { "1": "1,200" })).toBeNull();
    expect(invalidNumberFieldEdit(fields, { "1": "12.5" })).toBeNull();
  });

  it("rejects negative or non-numeric edits to number fields", () => {
    expect(invalidNumberFieldEdit(fields, { "1": "-3" })).toEqual({
      name: "Consumers sampled",
      value: "-3",
    });
    expect(invalidNumberFieldEdit(fields, { "1": "lots" })?.name).toBe(
      "Consumers sampled",
    );
  });

  it("ignores text fields and untouched legacy values", () => {
    expect(
      invalidNumberFieldEdit(fields, { "2": "great day", "3": "about 4" }),
    ).toBeNull();
  });
});

describe("totalEngagementsToSend", () => {
  it("lets the API re-derive when the total mirrors consumers sampled and is untouched", () => {
    expect(
      totalEngagementsToSend({
        edited: "50",
        touched: false,
        storedTotal: 50,
        storedConsumersSampled: 50,
      }),
    ).toBeNull();
  });

  it("keeps an explicit total that differs from consumers sampled", () => {
    expect(
      totalEngagementsToSend({
        edited: "7500",
        touched: false,
        storedTotal: 7500,
        storedConsumersSampled: 4300,
      }),
    ).toBe(7500);
  });

  it("sends the typed value once the admin edits the total", () => {
    expect(
      totalEngagementsToSend({
        edited: "61.4",
        touched: true,
        storedTotal: 50,
        storedConsumersSampled: 50,
      }),
    ).toBe(61);
  });
});

/**
 * Regression coverage for the "image-field upload dropped on Save" bug.
 *
 * The fix: saveValues must build a CustomFieldValue entry for EVERY
 * template field the editor renders — including fields that were blank
 * (no stored value / no value-row id) and have just been filled in this
 * edit session — so the backend persists the new value instead of
 * dropping it. These tests pin that behavior on the extracted pure
 * helper.
 */

describe("buildCustomFieldValuesPayload", () => {
  it("includes a previously-blank field that was just filled (the bug)", () => {
    // An IMAGE field that had no value and no value-row id. The admin
    // uploaded a blob this session, so it's only in editedValues.
    const fields = [
      { id: "img-1", value: null, customFieldValueId: null },
    ];
    const editedValues = { "img-1": "recaps/receipts/123-receipt.jpg" };

    const payload = buildCustomFieldValuesPayload(fields, editedValues);

    expect(payload).toEqual([
      {
        customFieldId: "img-1",
        customFieldValueId: null, // -> backend upserts/creates the row
        value: "recaps/receipts/123-receipt.jpg",
      },
    ]);
  });

  it("preserves customFieldValueId for an existing row (update in place)", () => {
    const fields = [{ id: "txt-1", value: "old", customFieldValueId: "42" }];
    const editedValues = { "txt-1": "new value" };

    const payload = buildCustomFieldValuesPayload(fields, editedValues);

    expect(payload).toEqual([
      { customFieldId: "txt-1", customFieldValueId: "42", value: "new value" },
    ]);
  });

  it("falls back to the stored value when a field wasn't edited", () => {
    const fields = [{ id: "txt-1", value: "kept", customFieldValueId: "7" }];

    const payload = buildCustomFieldValuesPayload(fields, {});

    expect(payload[0]).toMatchObject({
      customFieldId: "txt-1",
      customFieldValueId: "7",
      value: "kept",
    });
  });

  it("uses an explicit empty edited value (e.g. Clear) over the stored value", () => {
    // Clearing an image field sets editedValues[id] = "" — that empty
    // string must win over the stored value so the field is wiped.
    const fields = [
      { id: "img-1", value: "recaps/old.jpg", customFieldValueId: "9" },
    ];
    const editedValues = { "img-1": "" };

    const payload = buildCustomFieldValuesPayload(fields, editedValues);

    expect(payload[0].value).toBe("");
    expect(payload[0].customFieldValueId).toBe("9");
  });

  it("covers every field across the template, blank or not", () => {
    const fields = [
      { id: "a", value: "av", customFieldValueId: "1" }, // existing, untouched
      { id: "b", value: null, customFieldValueId: null }, // blank, untouched
      { id: "c", value: null, customFieldValueId: null }, // blank, just filled
    ];
    const editedValues = { c: "filled" };

    const payload = buildCustomFieldValuesPayload(fields, editedValues);

    expect(payload.map((p) => p.customFieldId)).toEqual(["a", "b", "c"]);
    expect(payload.find((p) => p.customFieldId === "c")?.value).toBe("filled");
    expect(payload.find((p) => p.customFieldId === "b")?.value).toBe("");
  });

  it("skips null/undefined entries defensively", () => {
    const fields = [
      null,
      { id: "a", value: "x", customFieldValueId: null },
      undefined,
    ];

    const payload = buildCustomFieldValuesPayload(fields, {});

    expect(payload).toHaveLength(1);
    expect(payload[0].customFieldId).toBe("a");
  });
});
