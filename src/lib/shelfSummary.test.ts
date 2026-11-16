import { describe, expect, it } from "vitest";
import {
  notFoundHeading,
  shelfBasis,
  shelfFigures,
  shelfNotes,
  shelfVisitDay,
  sharePct,
} from "./shelfSummary";

const counts = {
  visits: 42,
  onShelf: 34,
  notFound: 3,
  unclear: 5,
  priceTagVisible: 22,
  unreadVisits: 2,
};

describe("shelfSummary", () => {
  it("gives each share with its base", () => {
    expect(shelfFigures(counts)).toEqual([
      {
        key: "onShelf",
        label: "Product on shelf",
        share: "81%",
        basis: "34 of 42 retail visits with a shelf photo",
      },
      {
        key: "priceTag",
        label: "Price tag visible",
        share: "52%",
        basis: "22 of 42 retail visits with a shelf photo",
      },
    ]);
  });

  it("has no share without a base", () => {
    expect(sharePct(0, 0)).toBeNull();
    expect(shelfFigures({ ...counts, visits: 0 })).toEqual([]);
  });

  it("never reports more than the base", () => {
    expect(sharePct(9, 4)).toBe(100);
  });

  it("uses the singular for one visit", () => {
    expect(shelfBasis(1, 1)).toBe("1 of 1 retail visit with a shelf photo");
    expect(notFoundHeading(1)).toBe("Not found at 1 visit");
    expect(notFoundHeading(3)).toBe("Not found at 3 visits");
  });

  it("says what the shares leave out", () => {
    expect(shelfNotes(counts)).toEqual([
      "The photos from 5 visits did not show clearly whether the product was on the shelf.",
      "Shelf photos from 2 more visits have not been read yet.",
    ]);
    expect(shelfNotes({ ...counts, unclear: 0, unreadVisits: 0 })).toEqual([]);
  });

  it("formats the visit day without shifting the date", () => {
    expect(shelfVisitDay("2026-11-03")).toBe("Nov 3");
    expect(shelfVisitDay("")).toBe("");
  });
});
