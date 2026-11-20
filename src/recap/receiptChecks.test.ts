import { describe, expect, it } from "vitest";
import {
  csvFileName,
  defaultRange,
  flagKindLabel,
  formatMoney,
  readingStatusLabel,
  receiptDateLabel,
  receiptTimeLabel,
  sortFlags,
  storeLine,
} from "./receiptChecks";

describe("receipt check display", () => {
  it("formats money, times and dates", () => {
    expect(formatMoney("62.70")).toBe("$62.70");
    expect(formatMoney("1234.5")).toBe("$1,234.50");
    expect(formatMoney("-7.59")).toBe("−$7.59");
    expect(formatMoney(null)).toBe("—");
    expect(receiptTimeLabel("14:07")).toBe("2:07 PM");
    expect(receiptTimeLabel("00:05")).toBe("12:05 AM");
    expect(receiptTimeLabel("")).toBe("");
    expect(receiptDateLabel("2026-10-23")).toBe("Oct 23, 2026");
  });

  it("orders open flags by severity, resolved last", () => {
    const sorted = sortFlags([
      { id: "a", severity: "low", resolvedAt: null, createdAt: "2026-11-01" },
      { id: "b", severity: "high", resolvedAt: "2026-11-02", createdAt: "2026-11-02" },
      { id: "c", severity: "high", resolvedAt: null, createdAt: "2026-11-01" },
      { id: "d", severity: "medium", resolvedAt: null, createdAt: "2026-11-03" },
    ]);
    expect(sorted.map((f) => f.id)).toEqual(["c", "d", "a", "b"]);
  });

  it("labels kinds, statuses and stores in plain words", () => {
    expect(flagKindLabel("duplicate_receipt")).toBe("Duplicate receipt");
    expect(flagKindLabel("something_new")).toBe("something new");
    expect(readingStatusLabel("pending")).toBe("Waiting to be read");
    expect(
      storeLine({ merchant: "Total Wine & More", storeNumber: "903", city: "Palm Beach Gardens", stateCode: "FL" }),
    ).toBe("Total Wine & More #903 · Palm Beach Gardens, FL");
    expect(storeLine({ merchant: "", storeNumber: "", city: "" })).toBe("Store");
  });

  it("builds the range and the CSV name", () => {
    expect(defaultRange(new Date(2026, 10, 20))).toEqual({ from: "2026-10-22", to: "2026-11-20" });
    expect(csvFileName("Fizz Test Energy", "2026-10-01", "2026-10-31")).toBe(
      "receipt-spend_fizz-test-energy_2026-10-01_2026-10-31.csv",
    );
    expect(csvFileName("", "a", "b")).toBe("receipt-spend_all-brands_a_b.csv");
  });
});
