import { describe, expect, it } from "vitest";
import {
  computeCompletionSummary,
  slotActionLabel,
  stepNumericInput,
  wantsQuickStepper,
} from "./oneHandedCheckin";

describe("oneHandedCheckin", () => {
  it("steps numeric inputs from blank or existing counts and clamps at zero", () => {
    expect(stepNumericInput("", 1)).toBe("1");
    expect(stepNumericInput(undefined, 5)).toBe("5");
    expect(stepNumericInput("12", 10)).toBe("22");
    expect(stepNumericInput("3", -5)).toBe("0");
  });

  it("enables quick steppers on integer count fields while skipping spend/price/mileage", () => {
    expect(wantsQuickStepper("Consumers sampled", true)).toBe(true);
    expect(wantsQuickStepper("Units sold", true)).toBe(true);
    expect(wantsQuickStepper("Product spend ($)", true)).toBe(false);
    expect(wantsQuickStepper("Shelf price", true)).toBe(false);
    expect(wantsQuickStepper("Payable mileage", true)).toBe(false);
    expect(wantsQuickStepper("Store notes", false)).toBe(false);
  });

  it("computes completion summary accurately", () => {
    expect(
      computeCompletionSummary({ totalCheckpoints: 4, remainingItems: 1 }),
    ).toEqual({
      completed: 3,
      total: 4,
      pct: 75,
      label: "75% complete · 1 item left",
    });
    expect(
      computeCompletionSummary({ totalCheckpoints: 5, remainingItems: 0 }),
    ).toEqual({
      completed: 5,
      total: 5,
      pct: 100,
      label: "100% complete · Ready to submit",
    });
  });

  it("maps bucket names to concise one-handed slot labels", () => {
    expect(slotActionLabel("Table Setup & Display")).toBe("+ Setup");
    expect(slotActionLabel("Consumer Sampling Pictures")).toBe(
      "+ Sampling Action",
    );
    expect(slotActionLabel("Product Spend / Receipts")).toBe("+ Receipt");
  });
});
