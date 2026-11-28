import { describe, expect, it } from "vitest";
import {
  parseSnapshotMonthKey,
  recentSnapshotMonths,
} from "./executiveSnapshotHelpers";

describe("executiveSnapshotHelpers", () => {
  it("lists the last 6 complete calendar months starting with the prior month", () => {
    const months = recentSnapshotMonths(6, new Date(2026, 10, 27)); // Nov 27, 2026
    expect(months.map((m) => m.key)).toEqual([
      "2026-10",
      "2026-09",
      "2026-08",
      "2026-07",
      "2026-06",
      "2026-05",
    ]);
    expect(months[0]).toEqual({
      year: 2026,
      month: 10,
      key: "2026-10",
      label: "October 2026",
    });
  });

  it("rolls cleanly across a year boundary from January", () => {
    const months = recentSnapshotMonths(6, new Date(2026, 0, 15)); // Jan 15, 2026
    expect(months.map((m) => m.key)).toEqual([
      "2025-12",
      "2025-11",
      "2025-10",
      "2025-09",
      "2025-08",
      "2025-07",
    ]);
    expect(months[0].label).toBe("December 2025");
  });

  it("rolls across year boundary mid-window from March", () => {
    const months = recentSnapshotMonths(6, new Date(2026, 2, 1)); // Mar 1, 2026
    expect(months.map((m) => m.key)).toEqual([
      "2026-02",
      "2026-01",
      "2025-12",
      "2025-11",
      "2025-10",
      "2025-09",
    ]);
  });

  it("parses valid YYYY-MM keys and rejects invalid ones", () => {
    expect(parseSnapshotMonthKey("2026-10")).toEqual({ year: 2026, month: 10 });
    expect(parseSnapshotMonthKey("2026-01")).toEqual({ year: 2026, month: 1 });
    expect(parseSnapshotMonthKey("2026-13")).toBeNull();
    expect(parseSnapshotMonthKey("2026-00")).toBeNull();
    expect(parseSnapshotMonthKey("bad")).toBeNull();
  });
});
