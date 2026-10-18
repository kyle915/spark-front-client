import { describe, expect, it } from "vitest";
import { rankUpcomingRetailers } from "./topRetailers";

const today = new Date(2026, 9, 17); // 2026-10-17 local

function row(
  retailerName: string | null | undefined,
  date = "2026-10-20T14:00:00",
) {
  return { date, retailerName };
}

describe("rankUpcomingRetailers", () => {
  it("drops a blank-name bucket that would otherwise outrank named stores", () => {
    const rows = [
      ...Array.from({ length: 969 }, () => row(null)),
      ...Array.from({ length: 10 }, () => row("Binny's")),
      ...Array.from({ length: 4 }, () => row("")),
      ...Array.from({ length: 2 }, () => row("   ")),
      ...Array.from({ length: 1 }, () => row("—")),
      row(undefined),
    ];

    const ranked = rankUpcomingRetailers(rows, { today, horizonDays: 30 });

    expect(ranked).toEqual([
      { key: "binny's", name: "Binny's", count: 10 },
    ]);
    expect(ranked.some((r) => r.name === "—" || r.name === "Unassigned")).toBe(
      false,
    );
  });

  it("sums exact-normalized duplicates and keeps distinct stores apart", () => {
    const ranked = rankUpcomingRetailers(
      [
        row("Binny's"),
        row(" binny's "),
        row("BINNY'S"),
        row("Binny's Beverage Depot"),
        row("Jewel-Osco"),
      ],
      { today, horizonDays: 30 },
    );

    expect(ranked).toEqual([
      { key: "binny's", name: "Binny's", count: 3 },
      { key: "binny's beverage depot", name: "Binny's Beverage Depot", count: 1 },
      { key: "jewel-osco", name: "Jewel-Osco", count: 1 },
    ]);
  });

  it("counts only requests inside the stated horizon", () => {
    const ranked = rankUpcomingRetailers(
      [
        row("Binny's", "2026-10-16T18:00:00"),
        row("Binny's", "2026-10-17T09:00:00"),
        row("Jewel-Osco", "2026-11-15T23:00:00"),
        row("Mariano's", "2026-11-16T00:00:00"),
        row("Total Wine", "not-a-date"),
      ],
      { today, horizonDays: 30 },
    );

    expect(ranked).toEqual([
      { key: "binny's", name: "Binny's", count: 1 },
      { key: "jewel-osco", name: "Jewel-Osco", count: 1 },
    ]);
  });

  it("appends a quiet Unassigned line only when it is a small remainder", () => {
    const ranked = rankUpcomingRetailers(
      [
        ...Array.from({ length: 10 }, () => row("Binny's")),
        ...Array.from({ length: 4 }, () => row("Jewel-Osco")),
        ...Array.from({ length: 2 }, () => row(null)),
      ],
      { today, horizonDays: 30 },
    );

    expect(ranked.map((r) => r.name)).toEqual([
      "Binny's",
      "Jewel-Osco",
      "Unassigned",
    ]);
    expect(ranked[2]).toMatchObject({ count: 2, quiet: true });
    expect(ranked[0].quiet).toBeUndefined();
  });

  it("hides unassigned when it would outrank a named store", () => {
    const ranked = rankUpcomingRetailers(
      [
        ...Array.from({ length: 10 }, () => row("Binny's")),
        ...Array.from({ length: 3 }, () => row("Jewel-Osco")),
        ...Array.from({ length: 5 }, () => row(null)),
      ],
      { today, horizonDays: 30 },
    );

    expect(ranked.map((r) => r.name)).toEqual(["Binny's", "Jewel-Osco"]);
  });

  it("keeps the top named stores and breaks count ties by name", () => {
    const ranked = rankUpcomingRetailers(
      [
        ...Array.from({ length: 5 }, () => row("Zebra")),
        ...Array.from({ length: 5 }, () => row("Alpha")),
        ...Array.from({ length: 4 }, () => row("Mid")),
        row("Drop Me"),
      ],
      { today, horizonDays: 30, limit: 2 },
    );

    expect(ranked.map((r) => r.name)).toEqual(["Alpha", "Zebra"]);
  });
});
