import { describe, expect, it } from "vitest";
import {
  formatLastNudgedAt,
  overdueNudgeTargets,
  wasNudgedRecently,
} from "./nudgeAllOverdue";

const NOW = Date.parse("2026-11-23T12:00:00.000Z");

describe("wasNudgedRecently", () => {
  it("is false when never nudged", () => {
    expect(wasNudgedRecently(null, NOW)).toBe(false);
    expect(wasNudgedRecently(undefined, NOW)).toBe(false);
  });

  it("is true inside the 12h window", () => {
    expect(wasNudgedRecently("2026-11-23T06:00:00.000Z", NOW)).toBe(true);
    expect(wasNudgedRecently("2026-11-23T11:59:00.000Z", NOW)).toBe(true);
  });

  it("is false outside the 12h window", () => {
    expect(wasNudgedRecently("2026-11-22T23:00:00.000Z", NOW)).toBe(false);
  });
});

describe("overdueNudgeTargets", () => {
  it("only includes rows overdue ≥24h with assigned BAs", () => {
    const targets = overdueNudgeTargets(
      [
        {
          eventUuid: "e-fresh",
          hoursOverdue: 6,
          assignedAmbassadors: [
            { ambassadorEventUuid: "ae-1", name: "Fresh" },
          ],
        },
        {
          eventUuid: "e-overdue",
          hoursOverdue: 30,
          assignedAmbassadors: [
            { ambassadorEventUuid: "ae-2", name: "Overdue" },
            { ambassadorEventUuid: "ae-3", name: "Also", lastNudgedAt: null },
          ],
        },
        {
          eventUuid: "e-empty",
          hoursOverdue: 48,
          assignedAmbassadors: [],
        },
      ],
      NOW,
    );
    expect(targets.map((t) => t.ambassadorEventUuid)).toEqual(["ae-2", "ae-3"]);
  });

  it("skips BAs nudged in the last 12 hours", () => {
    const targets = overdueNudgeTargets(
      [
        {
          eventUuid: "e1",
          hoursOverdue: 40,
          assignedAmbassadors: [
            {
              ambassadorEventUuid: "ae-recent",
              name: "Recent",
              lastNudgedAt: "2026-11-23T08:00:00.000Z",
            },
            {
              ambassadorEventUuid: "ae-old",
              name: "Old",
              lastNudgedAt: "2026-11-22T12:00:00.000Z",
            },
          ],
        },
      ],
      NOW,
    );
    expect(targets.map((t) => t.ambassadorEventUuid)).toEqual(["ae-old"]);
  });
});

describe("formatLastNudgedAt", () => {
  it("returns null when missing", () => {
    expect(formatLastNudgedAt(null, NOW)).toBeNull();
  });

  it("formats relative labels", () => {
    expect(formatLastNudgedAt("2026-11-23T11:59:30.000Z", NOW)).toBe("just now");
    expect(formatLastNudgedAt("2026-11-23T11:30:00.000Z", NOW)).toBe("30m ago");
    expect(formatLastNudgedAt("2026-11-23T09:00:00.000Z", NOW)).toBe("3h ago");
    expect(formatLastNudgedAt("2026-11-21T12:00:00.000Z", NOW)).toBe("2d ago");
  });
});
