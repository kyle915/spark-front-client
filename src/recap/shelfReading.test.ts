import { describe, expect, it } from "vitest";
import {
  effectiveAnswers,
  parseFacings,
  parsePrice,
  readingLines,
  statusLine,
  type ShelfPhoto,
} from "./shelfReading";

const read = {
  productOnShelf: "no",
  facings: null,
  priceTagVisible: "unclear",
  price: null,
  outOfStockGap: "yes",
};

const photo = (over: Partial<ShelfPhoto> = {}): ShelfPhoto => ({
  fileId: "1",
  fileUrl: "",
  bucketName: "On shelf",
  status: "read",
  reading: read,
  correction: null,
  ...over,
});

describe("shelfReading", () => {
  it("uses the staff correction over what was read", () => {
    const corrected = photo({
      correction: {
        answers: { ...read, productOnShelf: "yes", facings: 4, priceTagVisible: "yes", price: "2.99" },
        note: "",
        correctedByName: "Sam Staff",
        correctedAt: "",
      },
    });
    expect(effectiveAnswers(photo())?.productOnShelf).toBe("no");
    expect(effectiveAnswers(corrected)?.productOnShelf).toBe("yes");
    expect(readingLines(effectiveAnswers(corrected)!)).toEqual([
      { label: "Product on shelf", value: "Yes, about 4 facings" },
      { label: "Price tag visible", value: "Yes, $2.99" },
      { label: "Out-of-stock gap", value: "Yes" },
    ]);
  });

  it("keeps unclear as an answer and shows no count or price without a yes", () => {
    expect(
      readingLines({ ...read, productOnShelf: "maybe", facings: 9, price: "3.49" }),
    ).toEqual([
      { label: "Product on shelf", value: "Unclear" },
      { label: "Price tag visible", value: "Unclear" },
      { label: "Out-of-stock gap", value: "Yes" },
    ]);
  });

  it("says why a photo has no answer", () => {
    expect(statusLine(photo())).toBe("");
    expect(statusLine(photo({ status: "pending", reading: null }))).toBe("Not read yet.");
    expect(statusLine(photo({ status: "unreadable", reading: null }))).toBe(
      "This does not look like a shelf photo.",
    );
  });

  it("parses the correction boxes", () => {
    expect(parseFacings(" 6 ")).toBe(6);
    expect(parseFacings("six")).toBeNull();
    expect(parseFacings("")).toBeNull();
    expect(parsePrice("$3.49")).toBe("3.49");
    expect(parsePrice("")).toBe("");
    expect(parsePrice("3.499")).toBeNull();
  });
});
