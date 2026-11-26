import { describe, it, expect } from "vitest";
import {
  bucketCountHint,
  coachModeForBucket,
  isExpenseReceiptBucket,
  isSetupPhotoBucket,
  isShelfPhotoBucket,
} from "./photoBuckets";

/**
 * Liquid Death's "Consumer Sampling Pictures" bucket carries min 8 on both
 * programs (Retail Sampling and Event Activation). It is a SUGGESTION — the
 * submit path never reads it — but it was rendered as a bare "0 of 8" in the
 * same orange as a required field's asterisk, and got reported as a hard
 * requirement.
 *
 * These pin the two things that keep it reading as a nudge: the target is named
 * "suggested" in the text, and `met` (the only styling input) stays false
 * without ever selecting an error treatment.
 */
const LD_CONSUMER_SAMPLING_MIN = 8;

describe("bucketCountHint — a target under the suggested count", () => {
  it("names the target as a suggestion rather than a quota", () => {
    expect(bucketCountHint(0, LD_CONSUMER_SAMPLING_MIN)).toEqual({
      text: "0 of 8 suggested",
      met: false,
    });
    expect(bucketCountHint(5, LD_CONSUMER_SAMPLING_MIN)).toEqual({
      text: "5 of 8 suggested",
      met: false,
    });
  });

  it("says 'suggested' at every count below the target, including zero", () => {
    // Zero is the one a BA sees first, and the one Kyle read as an error.
    for (let done = 0; done < LD_CONSUMER_SAMPLING_MIN; done++) {
      const hint = bucketCountHint(done, LD_CONSUMER_SAMPLING_MIN);
      expect(hint?.text).toContain("suggested");
      expect(hint?.met).toBe(false);
    }
  });
});

describe("bucketCountHint — the target reached", () => {
  it("turns positive exactly at the target", () => {
    expect(bucketCountHint(8, LD_CONSUMER_SAMPLING_MIN)).toEqual({
      text: "8 ✓",
      met: true,
    });
  });

  it("does not tell a BA who uploaded 11 that they are '11 of 8'", () => {
    const hint = bucketCountHint(11, LD_CONSUMER_SAMPLING_MIN);
    expect(hint).toEqual({ text: "11 ✓", met: true });
    expect(hint?.text).not.toContain("of");
  });
});

describe("bucketCountHint — buckets with no target", () => {
  it("shows nothing at all until something has landed", () => {
    // LD's other buckets (Table Set Up, Product Receipt, ...) carry no min.
    expect(bucketCountHint(0, 0)).toBeNull();
  });

  it("shows a plain tally, never the positive treatment", () => {
    // No target means there is nothing to have reached, so `met` stays false
    // and the chip keeps the same muted styling as an unmet suggestion.
    expect(bucketCountHint(3, 0)).toEqual({ text: "3", met: false });
  });
});

describe("isExpenseReceiptBucket", () => {
  it("matches receipt, expense, and product spend buckets", () => {
    expect(isExpenseReceiptBucket("Expenses/Receipts")).toBe(true);
    expect(isExpenseReceiptBucket("Product Receipt")).toBe(true);
    expect(isExpenseReceiptBucket("Product Spend")).toBe(true);
    expect(isExpenseReceiptBucket("Consumer Sampling Pictures")).toBe(false);
    expect(isExpenseReceiptBucket("Table Set Up")).toBe(false);
  });
});

describe("coachModeForBucket", () => {
  it("routes shelf/cooler buckets to shelf mode and setup/table/footprint buckets to setup mode", () => {
    expect(isShelfPhotoBucket("Shelf / Cooler")).toBe(true);
    expect(coachModeForBucket("Shelf / Cooler")).toBe("shelf");
    expect(coachModeForBucket("Before & After Stock")).toBe("shelf");

    expect(isSetupPhotoBucket("Table Set Up")).toBe(true);
    expect(coachModeForBucket("Table Set Up")).toBe("setup");
    expect(coachModeForBucket("Event Setup / Footprint")).toBe("setup");
    expect(coachModeForBucket("Demo Display")).toBe("setup");

    expect(coachModeForBucket("Consumer Sampling Pictures")).toBeNull();
    expect(coachModeForBucket("Product Receipt")).toBeNull();
  });
});
