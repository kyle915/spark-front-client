import { describe, expect, it } from "vitest";
import {
  flagExplanationLine,
  reviewCheckCounts,
  reviewCheckTint,
  reviewFlagBadges,
  isBaSubmitCheck,
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
    expect(reviewCheckTint("flag").color).toContain("#ffb59d");
    expect(reviewCheckTint("pass").color).toContain("#f2f3ee");
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


describe("flagExplanationLine", () => {
  it("returns the reviewer's line", () => {
    expect(
      flagExplanationLine({
        summary: " Sold 55 against 40 samples handed out. Check the sold count first. ",
      }),
    ).toBe("Sold 55 against 40 samples handed out. Check the sold count first.");
  });

  it("is null when there is no line, so the checks stand alone", () => {
    expect(flagExplanationLine(null)).toBeNull();
    expect(flagExplanationLine(undefined)).toBeNull();
    expect(flagExplanationLine({ summary: null })).toBeNull();
    expect(flagExplanationLine({ summary: "   " })).toBeNull();
  });
});

describe("BA submit checks", () => {
  it("get a readable badge in the Needs-review list", () => {
    const badges = reviewFlagBadges([
      { code: "ba_check_sold_line_zero", label: "BA confirmed: 15 upgrades, 0 tins sold" },
      { code: "ba_check_clock_vs_schedule", label: "BA submitted anyway: On the clock 9h for a 4h shift" },
    ]);
    expect(badges.map((b) => b.badge)).toEqual(["BA confirmed", "BA check"]);
    expect(badges[0].label).toBe("BA confirmed: 15 upgrades, 0 tins sold");
    expect(reviewFlagShortLabel("ba_check_sold_total_zero")).toBe("BA check");
    expect(isBaSubmitCheck("ba_check_x")).toBe(true);
    expect(isBaSubmitCheck("gps_distance")).toBe(false);
  });
});
