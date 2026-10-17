import { describe, expect, it } from "vitest";
import { partitionRecapsForBulkArchive } from "./recapBulkArchive";

const rows = [
  { id: "legacy-1", kind: "legacy" as const, archivedAt: null },
  { id: "custom-1", kind: "custom" as const, archivedAt: null },
  { id: "legacy-2", kind: "legacy" as const, archivedAt: "2026-10-01T00:00:00Z" },
  { id: "custom-2", kind: "custom" as const, archivedAt: null },
];

describe("partitionRecapsForBulkArchive", () => {
  it("splits selected rows by kind for the two archive mutations", () => {
    expect(
      partitionRecapsForBulkArchive(
        rows,
        new Set(["legacy-1", "custom-1", "custom-2"]),
      ),
    ).toEqual({
      recapIds: ["legacy-1"],
      customRecapIds: ["custom-1", "custom-2"],
      skippedArchived: 0,
    });
  });

  it("skips already-archived rows and ignores unselected rows", () => {
    expect(
      partitionRecapsForBulkArchive(rows, new Set(["legacy-2", "custom-1"])),
    ).toEqual({
      recapIds: [],
      customRecapIds: ["custom-1"],
      skippedArchived: 1,
    });
  });

  it("empty selection partitions to nothing", () => {
    expect(partitionRecapsForBulkArchive(rows, new Set())).toEqual({
      recapIds: [],
      customRecapIds: [],
      skippedArchived: 0,
    });
  });
});
