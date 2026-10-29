import { describe, expect, it } from "vitest";
import {
  reviewCheckCounts,
  reviewCheckTint,
  reviewFlagBadges,
  reviewFlagShortLabel,
  visibleReviewChecks,
} from "./reviewCheckDisplay";

const checks = [
  { code: "engagements_rate", label: "Engagements fit", status: "pass", detail: "100 in 2h" },
  { code: "gps_distance", label: "Clock-in 3mi away", status: "flag", detail: "3.0 mi" },
  { code: "photo_buckets", label: "Missing: Table Set Up", status: "flag", detail: "" },
  { code: "duplicate_photos", label: "No duplicates", status: "pass", detail: null },
  { code: "spend_without_receipt", label: "Spend receipt", status: "na", detail: "" },
];

describe("visibleReviewChecks", () => {
  it("hides na checks and puts flags first, stable within a tier", () => {
    const visible = visibleReviewChecks(checks);
    expect(visible.map((c) => c.code)).toEqual([
      "gps_distance",
      "photo_buckets",
      "engagements_rate",
      "duplicate_photos",
    ]);
    expect(visible[0].flagged).toBe(true);
    expect(visible[3].detail).toBe("");
  });

  it("handles null/empty input", () => {
    expect(visibleReviewChecks(null)).toEqual([]);
    expect(visibleReviewChecks(undefined)).toEqual([]);
    expect(visibleReviewChecks([])).toEqual([]);
  });
});

describe("reviewCheckCounts", () => {
  it("counts only visible checks", () => {
    expect(reviewCheckCounts(checks)).toEqual({ flagged: 2, passed: 2 });
  });
});

describe("reviewCheckTint", () => {
  it("tints flag orange and pass off-white on dark ops chrome", () => {
    expect(reviewCheckTint("flag").color).toBe("#ffb59d");
    expect(reviewCheckTint("pass").color).toBe("#f2f3ee");
    expect(reviewCheckTint("na").mark).toBe("–");
  });
});

describe("reviewFlagBadges", () => {
  it("maps flagged codes to short list labels in stable order", () => {
    expect(
      reviewFlagBadges([
        { code: "duplicate_photos", label: "2 identical photos" },
        { code: "gps_distance", label: "Clock-in 3mi away" },
        { code: "photo_buckets", label: "Missing: Table Set Up" },
      ]).map((b) => b.badge),
    ).toEqual(["GPS", "Photos", "Dupes"]);
  });

  it("handles empty input", () => {
    expect(reviewFlagBadges(null)).toEqual([]);
    expect(reviewFlagBadges([])).toEqual([]);
  });
});

describe("reviewFlagShortLabel", () => {
  it("maps known codes to short list badges", () => {
    expect(reviewFlagShortLabel("gps_distance")).toBe("GPS");
    expect(reviewFlagShortLabel("photo_buckets")).toBe("Photos");
    expect(reviewFlagShortLabel("engagements_rate")).toBe("Hours");
    expect(reviewFlagShortLabel("spend_without_receipt")).toBe("Receipt");
    expect(reviewFlagShortLabel("duplicate_photos")).toBe("Dupes");
  });
});

