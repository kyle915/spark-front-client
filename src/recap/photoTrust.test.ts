import { describe, expect, it } from "vitest";
import { photoTrustLine } from "./photoTrust";

describe("client photo trust line", () => {
  it("shows a count when the duplicate check passed", () => {
    expect(
      photoTrustLine([
        { code: "gps", status: "flag" },
        { code: "duplicate_photos", status: "pass", detail: "8 photos, all distinct files" },
      ]),
    ).toBe("8 photos checked by Spark — each one is a unique image.");
  });

  it("handles a single photo and a missing detail", () => {
    expect(
      photoTrustLine([{ code: "duplicate_photos", status: "pass", detail: "1 photos, all distinct files" }]),
    ).toBe("1 photo checked by Spark — each one is a unique image.");
    expect(photoTrustLine([{ code: "duplicate_photos", status: "pass" }])).toBe(
      "Photos checked by Spark — each one is a unique image.",
    );
  });

  it("says nothing when the check flagged, did not apply or is missing", () => {
    expect(photoTrustLine([{ code: "duplicate_photos", status: "flag", detail: "x" }])).toBeNull();
    expect(photoTrustLine([{ code: "duplicate_photos", status: "na" }])).toBeNull();
    expect(photoTrustLine([{ code: "gps", status: "pass" }])).toBeNull();
    expect(photoTrustLine(null)).toBeNull();
  });
});
