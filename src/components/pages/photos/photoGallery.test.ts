import { describe, expect, it } from "vitest";
import {
  deckColumns,
  deckPages,
  photoCaption,
  photoFileName,
  rangeDates,
  type GalleryPhoto,
} from "./photoGallery";

const photo: GalleryPhoto = {
  id: "1",
  url: "https://storage.googleapis.com/b/recap_files/IMG_9720.JPG?x=1",
  category: "Full booth setup, straight-on",
  recapUuid: "u",
  store: "Costco #1715",
  state: "CA",
  eventDate: "2026-10-11",
};

describe("photo gallery", () => {
  it("splits a selection into deck pages", () => {
    expect(deckPages([1, 2, 3, 4, 5], 4)).toEqual([[1, 2, 3, 4], [5]]);
    expect(deckPages([], 9)).toEqual([]);
    expect(deckPages([1, 2], 1)).toEqual([[1], [2]]);
  });

  it("picks a column count per layout", () => {
    expect([1, 4, 6, 9].map((n) => deckColumns(n as 1 | 4 | 6 | 9))).toEqual([1, 2, 3, 3]);
  });

  it("captions with store, state and date, skipping what is missing", () => {
    expect(photoCaption(photo)).toBe("Costco #1715 · CA · Oct 11, 2026");
    expect(photoCaption({ ...photo, state: "", eventDate: "" })).toBe("Costco #1715");
  });

  it("names files so a zip sorts by date and store", () => {
    expect(photoFileName(photo, 0)).toBe(
      "2026-10-11_costco-1715_full-booth-setup-straight-on_001.jpg",
    );
    expect(photoFileName({ ...photo, store: "", category: "", eventDate: "" }, 11)).toBe(
      "photo_012.jpg",
    );
  });

  it("turns a range key into inclusive dates", () => {
    const today = new Date(2026, 10, 10);
    expect(rangeDates("30", today)).toEqual({
      startDate: "2026-10-11",
      endDate: "2026-11-10",
    });
    expect(rangeDates("all", today)).toEqual({ startDate: null, endDate: null });
  });
});
