import { describe, expect, it } from "vitest";
import { isFieldShown, withoutHiddenValues } from "./fieldConditions";

const pours = { id: "9", showWhen: { fieldId: "4", includes: "4oz pour" } };
const format = { id: "4" };

describe("recap field show-when rules", () => {
  it("shows a field only while its option is picked", () => {
    expect(isFieldShown(format, {})).toBe(true);
    expect(isFieldShown(pours, {})).toBe(false);
    expect(isFieldShown(pours, { "4": ["Full can"] })).toBe(false);
    expect(isFieldShown(pours, { "4": ["Full can", "4oz pour"] })).toBe(true);
    expect(isFieldShown(pours, { "4": '["4oz pour"]' })).toBe(true);
    expect(isFieldShown(pours, { "4": "Full can, 4oz pour" })).toBe(true);
  });

  it("drops answers to hidden fields", () => {
    const values = { "4": ["Full can"], "9": "120", "1": "x" };
    expect(withoutHiddenValues([format, pours], values)).toEqual({ "4": ["Full can"], "1": "x" });
    const both = { "4": ["Full can", "4oz pour"], "9": "120" };
    expect(withoutHiddenValues([format, pours], both)).toEqual(both);
  });
});
