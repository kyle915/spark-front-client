import { describe, it, expect } from "vitest";
import {
  buildFileRecapCategoryOptions,
  defaultReceiptCategoryName,
  defaultUploadCategoryName,
  isReceiptLikeCategory,
  FALLBACK_FILE_CATEGORY_PHOTOS,
  FALLBACK_FILE_CATEGORY_RECEIPTS,
} from "./fileRecapCategoryOptions";

describe("buildFileRecapCategoryOptions", () => {
  it("includes Product Spend alongside Sampling photos and Receipts", () => {
    const options = buildFileRecapCategoryOptions([
      { id: "1", name: "Sampling photos" },
      { id: "2", name: "Receipts" },
      { id: "3", name: "Product Spend" },
    ]);
    expect(options.map((o) => o.name)).toEqual([
      "Sampling photos",
      "Receipts",
      "Product Spend",
    ]);
  });

  it("dedupes by case-insensitive name", () => {
    const options = buildFileRecapCategoryOptions([
      { id: "1", name: "Receipts" },
      { id: "2", name: "receipts" },
      { id: "3", name: "Product Spend" },
    ]);
    expect(options.map((o) => o.name)).toEqual(["Receipts", "Product Spend"]);
  });

  it("falls back to classic roles when the tenant list is empty", () => {
    const options = buildFileRecapCategoryOptions([]);
    expect(options.map((o) => o.name)).toEqual([
      FALLBACK_FILE_CATEGORY_PHOTOS,
      FALLBACK_FILE_CATEGORY_RECEIPTS,
    ]);
  });
});

describe("isReceiptLikeCategory", () => {
  it("treats Product Spend as receipt-like (PDF allowed)", () => {
    expect(isReceiptLikeCategory("Product Spend")).toBe(true);
    expect(isReceiptLikeCategory("Receipts")).toBe(true);
    expect(isReceiptLikeCategory("Sampling photos")).toBe(false);
  });
});

describe("defaultUploadCategoryName", () => {
  it("prefers Sampling photos when present", () => {
    expect(
      defaultUploadCategoryName([
        { id: "3", name: "Product Spend" },
        { id: "1", name: "Sampling photos" },
        { id: "2", name: "Receipts" },
      ]),
    ).toBe("Sampling photos");
  });
});

describe("defaultReceiptCategoryName", () => {
  it("prefers Receipts when present", () => {
    expect(
      defaultReceiptCategoryName([
        { id: "1", name: "Sampling photos" },
        { id: "2", name: "Receipts" },
        { id: "3", name: "Product Spend" },
      ]),
    ).toBe("Receipts");
  });

  it("falls back to Product Spend when Receipts is gone", () => {
    expect(
      defaultReceiptCategoryName([
        { id: "1", name: "Sampling photos" },
        { id: "3", name: "Product Spend" },
      ]),
    ).toBe("Product Spend");
  });
});
