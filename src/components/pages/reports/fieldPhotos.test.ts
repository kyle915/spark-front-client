import { describe, expect, it } from "vitest";
import { bestPhotoCaption } from "./fieldPhotos";

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
});
