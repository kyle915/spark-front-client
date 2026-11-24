import { describe, expect, it } from "vitest";
import {
  excludedLine,
  fixTargets,
  howLabel,
  isNotTracked,
  mappingHref,
  pendingHint,
  previewLines,
  previewNeedsAck,
  samplingTileMetric,
} from "./kpiExplain";

const status = {
  untrackedMetrics: ["willing_to_purchase", "products_sold"],
  pending: [
    { metric: "products_sold", recaps: 3, wouldAdd: 10 },
    { metric: "consumers_reached", recaps: 0, wouldAdd: 0 },
  ],
};

describe("samplingTileMetric", () => {
  it("follows the tile's own fallback so the explanation matches it", () => {
    const totals = { consumersReached: 0, samplesDistributed: 40 };
    expect(samplingTileMetric("consumersSampled", totals)).toBe("samples_distributed");
    expect(
      samplingTileMetric("consumersSampled", { consumersReached: 80, samplesDistributed: 80 }),
    ).toBe("consumers_reached");
    expect(
      samplingTileMetric("consumersSampled", { consumersReached: 0, samplesDistributed: 0 }),
    ).toBe("total_engagements");
    expect(samplingTileMetric("totalEngagements", totals)).toBe("total_engagements");
  });
});

describe("tile status", () => {
  it("reads not tracked only for a zero the forms cannot produce", () => {
    expect(isNotTracked("products_sold", 0, status)).toBe(true);
    expect(isNotTracked("products_sold", 12, status)).toBe(false);
    expect(isNotTracked("consumers_reached", 0, status)).toBe(false);
    expect(isNotTracked("products_sold", 0, null)).toBe(false);
  });

  it("shows pending approval only when some recaps are waiting", () => {
    expect(pendingHint("products_sold", status)).toBe("+3 pending approval");
    expect(pendingHint("consumers_reached", status)).toBeNull();
    expect(pendingHint(undefined, status)).toBeNull();
  });
});

describe("explanation wording", () => {
  it("never uses internal words", () => {
    for (const how of ["confirmed", "wording", "standard"]) {
      expect(howLabel(how).toLowerCase()).not.toMatch(/regex|vocabulary|matcher/);
    }
  });

  it("says what left-out recaps would add", () => {
    expect(excludedLine({ recaps: 3, wouldAdd: 10 })).toBe("3 recaps · would add 10");
    expect(excludedLine({ recaps: 1, wouldAdd: null })).toBe("1 recap not counted yet");
  });

  it("links each template once, untracked first", () => {
    expect(
      fixTargets(
        [{ templateUuid: "a", templateName: "Demo" }, { templateUuid: null, templateName: "Standard recap form" }],
        [{ templateUuid: "b", templateName: "Seeding" }, { templateUuid: "a", templateName: "Demo" }],
      ),
    ).toEqual([
      { uuid: "b", name: "Seeding" },
      { uuid: "a", name: "Demo" },
    ]);
    expect(mappingHref("a b")).toBe("/recap-templates/a%20b/edit#metric-mapping");
  });
});

describe("template editor check", () => {
  it("asks before saving when a number has no field or a count is uncounted", () => {
    expect(previewNeedsAck({ missingMetrics: [], uncountedFields: [] })).toBe(false);
    expect(previewNeedsAck(null)).toBe(false);
    const preview = {
      missingMetrics: [
        { key: "first_time", label: "First-time consumers" },
        { key: "willing_to_buy", label: "Willing to buy" },
      ],
      uncountedFields: ["How many shoppers took the 4-for-$6 upgrade?"],
    };
    expect(previewNeedsAck(preview)).toBe(true);
    const lines = previewLines(preview);
    expect(lines[0]).toContain("first-time consumers or willing to buy");
    expect(lines[1]).toContain("4-for-$6 upgrade");
  });
});
