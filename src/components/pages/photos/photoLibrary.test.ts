import { describe, expect, it } from "vitest";
import {
  EMPTY_LIBRARY_FILTERS,
  filterChips,
  fromInterpretation,
  isSearching,
  MAX_DECK_PHOTOS,
  mergeDeckPhotoIds,
  qualityWord,
  toFilterInput,
  toGalleryPhoto,
  toggleKey,
} from "./photoLibrary";

const labels = {
  shows: new Map([["consumers_engaging", "Consumers engaging"]]),
  crowd: new Map([
    ["group", "6 to 15 people"],
    ["crowd", "More than 15 people"],
  ]),
  settings: new Map<string, string>(),
  products: new Map([["11", "Seltzer Lime"]]),
};

describe("photo library filters", () => {
  it("is not a search until something is set", () => {
    expect(isSearching(EMPTY_LIBRARY_FILTERS)).toBe(false);
    expect(isSearching({ ...EMPTY_LIBRARY_FILTERS, shows: ["signage"] })).toBe(true);
    expect(isSearching({ ...EMPTY_LIBRARY_FILTERS, hideIssues: true })).toBe(true);
  });

  it("turns the server's reading into chips that each remove one filter", () => {
    const f = fromInterpretation({
      text: "cooler",
      shows: ["consumers_engaging"],
      crowdSizes: ["group", "crowd"],
      settings: [],
      productIds: ["11"],
      store: "Kroger",
      states: ["TX"],
      startDate: null,
      endDate: null,
      minQuality: 70,
      peoplePresent: null,
      hideIssues: false,
      sort: "quality",
    });
    const chips = filterChips(f, labels);
    expect(chips.map((c) => c.label)).toEqual([
      "“cooler”",
      "Consumers engaging",
      "6 to 15 people",
      "More than 15 people",
      "Seltzer Lime",
      "Kroger",
      "TX",
      "Quality 70+",
      "Best quality",
    ]);
    const withoutTexas = chips.find((c) => c.label === "TX")!.without;
    expect(withoutTexas.states).toEqual([]);
    expect(withoutTexas.store).toBe("Kroger");
  });

  it("sends blanks as nulls and lets a named date beat the page range", () => {
    const input = toFilterInput(
      { ...EMPTY_LIBRARY_FILTERS, shows: ["signage"] },
      { approvedOnly: true, picksOnly: false, startDate: "2026-08-01", endDate: "2026-11-01" },
    );
    expect(input.text).toBeNull();
    expect(input.shows).toEqual(["signage"]);
    expect(input.startDate).toBe("2026-08-01");
    expect(input.approvedOnly).toBe(true);
    const named = toFilterInput(
      { ...EMPTY_LIBRARY_FILTERS, startDate: "2026-06-01" },
      { approvedOnly: false, picksOnly: false, startDate: "2026-08-01", endDate: "2026-11-01" },
    );
    expect(named.startDate).toBe("2026-06-01");
    expect(named.endDate).toBeNull();
  });

  it("toggles a tag on and off", () => {
    expect(toggleKey(["a"], "b")).toEqual(["a", "b"]);
    expect(toggleKey(["a", "b"], "a")).toEqual(["b"]);
  });
});

describe("library photos", () => {
  it("map onto the gallery's shape without a file name", () => {
    const g = toGalleryPhoto({
      id: "7",
      url: "https://storage.googleapis.com/b/recap_files/jordan-rivera-table.jpg",
      caption: "Sampling table by the cooler aisle",
      category: "Sampling photos",
      showLabels: ["Consumers engaging"],
      store: "Kroger",
      state: "TX",
      eventDate: "2026-10-11",
      recapUuid: "u",
      isPick: true,
    });
    expect(g.category).toBe("Consumers engaging");
    expect(JSON.stringify({ ...g, url: "" })).not.toMatch(/jordan|rivera|\.jpg/i);
  });

  it("say what the quality score means", () => {
    expect(qualityWord(90)).toBe("Strong photo");
    expect(qualityWord(60)).toBe("Good photo");
    expect(qualityWord(20)).toBe("Weak photo");
    expect(qualityWord(null)).toBe("");
  });

  it("add to a deck without repeats and never past its limit", () => {
    expect(mergeDeckPhotoIds(["1", "2"], ["2", "3"])).toEqual({
      ids: ["1", "2", "3"],
      added: 1,
      dropped: 0,
    });
    const full = Array.from({ length: MAX_DECK_PHOTOS }, (_, i) => String(i));
    expect(mergeDeckPhotoIds(full, ["x"])).toEqual({ ids: full, added: 0, dropped: 1 });
  });
});
