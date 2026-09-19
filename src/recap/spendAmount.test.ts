import { describe, expect, it } from "vitest";
import {
  SPEND_CENTS_MESSAGE,
  isSpendAmountField,
  sanitizeSpendAmountInput,
  spendAmountError,
  spendAmountStored,
  spendAmountSubmitError,
} from "./spendAmount";

describe("isSpendAmountField", () => {
  it("matches walk-up dollar spend labels", () => {
    expect(
      isSpendAmountField({ name: "Account Spend Amount", type: "number" }),
    ).toBe(true);
    expect(
      isSpendAmountField({ name: "Account Spend Amount ($)", type: "number" }),
    ).toBe(true);
    expect(isSpendAmountField({ name: "Spend Amount", type: "text" })).toBe(
      true,
    );
    expect(isSpendAmountField({ name: "Amount Spent", type: "number" })).toBe(
      true,
    );
    expect(
      isSpendAmountField({ name: "Product Spend", type: "number" }),
    ).toBe(true);
    expect(isSpendAmountField({ name: "Product Spend", type: "text" })).toBe(
      true,
    );
  });

  it("does not treat receipt photo buckets as dollar inputs", () => {
    expect(
      isSpendAmountField({ name: "Product Spend", type: "image" }),
    ).toBe(false);
    expect(
      isSpendAmountField({ name: "Product Spend", type: "photo" }),
    ).toBe(false);
    expect(
      isSpendAmountField({ name: "Account Spend Receipt", type: "image" }),
    ).toBe(false);
    expect(
      isSpendAmountField({
        name: "Upload account spend receipt",
        type: "image",
      }),
    ).toBe(false);
    expect(
      isSpendAmountField({
        name: "Was an Ignite provided credit card used for product spend?",
        type: "select",
      }),
    ).toBe(false);
    expect(isSpendAmountField({ name: "Mileage", type: "number" })).toBe(
      false,
    );
  });
});

describe("spend amount rule", () => {
  it("blocks a whole number with no period", () => {
    expect(spendAmountError("2489")).toBe(SPEND_CENTS_MESSAGE);
    expect(spendAmountError(" 2489 ")).toBe(SPEND_CENTS_MESSAGE);
    expect(spendAmountError("$2489")).toBe(SPEND_CENTS_MESSAGE);
    expect(spendAmountError("2,489")).toBe(SPEND_CENTS_MESSAGE);
    expect(spendAmountStored("2489")).toBeNull();
  });

  it("accepts dollars and cents and stores a numeric dollar string", () => {
    expect(spendAmountError("24.89")).toBeNull();
    expect(spendAmountError("24.8")).toBeNull();
    expect(spendAmountError("2489.00")).toBeNull();
    expect(spendAmountError("$24.89")).toBeNull();
    expect(spendAmountStored("24.89")).toBe("24.89");
    expect(spendAmountStored("24.8")).toBe("24.80");
    expect(spendAmountStored("2489.00")).toBe("2489.00");
    expect(spendAmountStored("$24.89")).toBe("24.89");
    expect(spendAmountStored("24.89")).not.toContain("$");
  });

  it("leaves a blank optional field alone", () => {
    expect(spendAmountError("")).toBeNull();
    expect(spendAmountError("   ")).toBeNull();
    expect(spendAmountStored("")).toBeNull();
  });

  it("does not block an unchanged legacy whole number on ops edit", () => {
    expect(spendAmountSubmitError("2489", "2489")).toBeNull();
    expect(spendAmountSubmitError("2500", "2489")).toBe(SPEND_CENTS_MESSAGE);
    expect(spendAmountSubmitError("24.89", "2489")).toBeNull();
    expect(spendAmountSubmitError("2489")).toBe(SPEND_CENTS_MESSAGE);
  });
});

describe("sanitizeSpendAmountInput", () => {
  it("keeps digits and one decimal", () => {
    expect(sanitizeSpendAmountInput("$24.89")).toBe("24.89");
    expect(sanitizeSpendAmountInput("24.8.9")).toBe("24.89");
    expect(sanitizeSpendAmountInput("12a3")).toBe("123");
  });
});
