import { describe, expect, it } from "vitest";
import { numberHint, wantsDecimalKeypad } from "./numberSanity";

describe("recap number hints", () => {
  it("catches a price typed without its decimal point", () => {
    expect(numberHint("Costco retail price: Almond Oil", "1279")).toBe(
      "That reads as $1,279.00. If you meant $12.79, add the decimal point.",
    );
    expect(numberHint("Costco retail price: Almond Oil", "12.79")).toBeNull();
    expect(numberHint("Retail price", "8")).toBeNull();
  });

  it("catches sales with a misplaced decimal", () => {
    expect(numberHint("Estimated sales $", "125342.00")).toBe(
      "That reads as $125,342.00. If you meant $1,253.42, fix the decimal point.",
    );
    expect(numberHint("Estimated sales $", "1253.42")).toBeNull();
  });

  it("asks once about an unusually large count", () => {
    expect(numberHint("Total number of consumers sampled", "40000")).toContain(
      "40,000 is a lot for one shift",
    );
    expect(numberHint("Total number of consumers sampled", "4000")).toBeNull();
    expect(numberHint("Units sold: Almond Oil", "4.5")).toBe(
      "This should be a whole number.",
    );
  });

  it("flags impossible percentages and negatives", () => {
    expect(numberHint("Conversion rate", "250")).toBe(
      "A percentage can't be more than 100.",
    );
    expect(numberHint("Units sold", "-3")).toBe("This can't be negative.");
  });

  it("stays quiet for text, identifiers and blanks", () => {
    expect(numberHint("Any feedback?", "No")).toBeNull();
    expect(numberHint("Store number", "171500")).toBeNull();
    expect(numberHint("Zip code", "92346")).toBeNull();
    expect(numberHint("Units sold", "")).toBeNull();
    expect(numberHint("Units sold", "about 40", { isNumberField: true })).toBe(
      "Numbers only here — put notes in a comment field.",
    );
    expect(numberHint("Notes", "about 40")).toBeNull();
  });

  it("gives money, price and percent fields a keypad with a decimal point", () => {
    expect(wantsDecimalKeypad("Costco retail price: Almond Oil")).toBe(true);
    expect(wantsDecimalKeypad("Estimated sales $")).toBe(true);
    expect(wantsDecimalKeypad("Units sold: Almond Oil")).toBe(false);
  });
});
