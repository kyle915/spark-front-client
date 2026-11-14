import { describe, expect, it } from "vitest";
import { recapRowStatus } from "./recapRowStatus";

const base = {
  emptyShell: false,
  approved: false,
  sharedAt: null,
  archivedAt: null,
  isClient: false,
};

describe("recapRowStatus", () => {
  it("walks the staff pipeline", () => {
    expect(recapRowStatus({ ...base, emptyShell: true })).toEqual({
      text: "Not filed",
      tone: "neutral",
    });
    expect(recapRowStatus(base)).toEqual({ text: "Needs review", tone: "attention" });
    expect(recapRowStatus({ ...base, approved: true })).toEqual({
      text: "Approved",
      tone: "done",
    });
    expect(
      recapRowStatus({ ...base, approved: true, sharedAt: "2026-11-01T00:00:00Z" }),
    ).toEqual({ text: "Shared", tone: "done" });
  });

  it("archived wins over approved and unreviewed, for staff", () => {
    expect(
      recapRowStatus({ ...base, archivedAt: "2026-11-01T00:00:00Z" }).text,
    ).toBe("Archived");
    expect(
      recapRowStatus({
        ...base,
        approved: true,
        sharedAt: "2026-11-01T00:00:00Z",
        archivedAt: "2026-11-02T00:00:00Z",
      }).text,
    ).toBe("Archived");
  });

  it("never shows Ignite's bookkeeping to a brand user", () => {
    expect(
      recapRowStatus({
        ...base,
        isClient: true,
        approved: true,
        sharedAt: "2026-11-01T00:00:00Z",
        archivedAt: "2026-11-02T00:00:00Z",
      }),
    ).toEqual({ text: "Approved", tone: "done" });
  });
});
