import { describe, expect, it } from "vitest";
import { bestPhotoCaption, onePhotoPerStop } from "./fieldPhotos";

describe("program report field photos", () => {
  it("leads with what the photo shows, then where and when", () => {
    const caption = bestPhotoCaption({
      caption: "Sampling table at the store entrance",
      store: "Costco",
      state: "CA",
      eventDate: "2026-10-11",
    });
    expect(caption.startsWith("Sampling table at the store entrance · Costco, CA · ")).toBe(true);
    expect(caption).toMatch(/11/);
  });

  it("uses only the parts that exist and drops a walk-up date from the store", () => {
    expect(
      bestPhotoCaption({ caption: "", store: "11/8/2026 - 12 Main St", state: "", eventDate: "" }),
    ).toBe("12 Main St");
    expect(bestPhotoCaption({ caption: "", store: "", state: "", eventDate: "" })).toBe("");
  });

  it("keeps one photo per store and date and returns the rest", () => {
    const photos = [
      { url: "a", store: "Kroger", eventDate: "2026-11-13" },
      { url: "b", store: "Kroger", eventDate: "2026-11-13" },
      { url: "c", store: "H-E-B", eventDate: "2026-11-13" },
      { url: "d", store: "Kroger", eventDate: "2026-11-14" },
    ];
    const split = onePhotoPerStop(photos);
    expect(split.best.map((p) => p.url)).toEqual(["a", "c", "d"]);
    expect(split.rest.map((p) => p.url)).toEqual(["b"]);
  });
});
