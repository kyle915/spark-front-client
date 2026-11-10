import { describe, expect, it } from "vitest";
import { isFieldPhotoCategory, pickFieldPhoto } from "./fieldPhoto";

const img = (name: string, category: string | null) => ({
  url: `https://storage.googleapis.com/b/${name}.jpg`,
  displayUrl: null,
  fileType: { name: "image" },
  fileRecapCategory: category ? { name: category } : null,
});

describe("isFieldPhotoCategory", () => {
  it("rejects receipts and spend buckets", () => {
    for (const c of ["Receipts", "Expense Receipts", "Product Spend", "Account spend receipt", "Mileage"]) {
      expect(isFieldPhotoCategory(c)).toBe(false);
    }
  });
  it("accepts field buckets and uncategorized", () => {
    for (const c of ["Sampling photos", "Table setup", "Full booth setup, straight-on", null, ""]) {
      expect(isFieldPhotoCategory(c)).toBe(true);
    }
  });
});

describe("pickFieldPhoto", () => {
  it("skips a leading receipt and returns a field photo", () => {
    const out = pickFieldPhoto([img("receipt", "Receipts"), img("booth", "Table setup")]);
    expect(out).toContain("booth.jpg");
  });
  it("prefers a sampling/booth photo over an uncategorized one", () => {
    const out = pickFieldPhoto([img("misc", null), img("action", "Sampling in action with members")]);
    expect(out).toContain("action.jpg");
  });
  it("returns null when a recap only has receipts", () => {
    expect(pickFieldPhoto([img("r1", "Receipts"), img("r2", "Product Spend")])).toBeNull();
    expect(pickFieldPhoto([])).toBeNull();
    expect(pickFieldPhoto(null)).toBeNull();
  });
  it("ignores PDFs", () => {
    const pdf = { url: "https://storage.googleapis.com/b/recap.pdf", fileType: { name: "pdf" }, fileRecapCategory: null };
    expect(pickFieldPhoto([pdf])).toBeNull();
  });
});
