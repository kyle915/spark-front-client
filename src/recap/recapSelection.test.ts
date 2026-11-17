import { describe, expect, it } from "vitest";
import { bulkApproveMessage, idsByKind, selectedRows } from "./recapSelection";

type Row = { id: string; kind: "legacy" | "custom"; name: string };
const row = (id: string, kind: Row["kind"] = "custom"): Row => ({ id, kind, name: id });

describe("selectedRows", () => {
  it("keeps picks the current filter hides", () => {
    const a = row("a");
    const b = row("b", "legacy");
    const c = row("c");
    const selection = new Map([
      ["a", a],
      ["b", b],
      ["c", c],
    ]);
    // Filter now shows only c.
    const rows = selectedRows(selection, [c, row("d")]);
    expect(rows.map((r) => r.id)).toEqual(["c", "a", "b"]);
    expect(idsByKind(rows)).toEqual({ recapIds: ["b"], customRecapIds: ["c", "a"] });
  });

  it("prefers the on-screen copy of a row", () => {
    const stale = { ...row("a"), name: "old" };
    const fresh = { ...row("a"), name: "new" };
    expect(selectedRows(new Map([["a", stale]]), [fresh])[0].name).toBe("new");
  });

  it("is empty with nothing selected", () => {
    expect(selectedRows(new Map(), [row("a")])).toEqual([]);
  });
});

describe("bulkApproveMessage", () => {
  it("names the one recap", () => {
    expect(bulkApproveMessage({ requested: 1, approved: 1, singleLabel: "Kroger #12" })).toEqual({
      text: "Approved · Kroger #12",
      tone: "success",
    });
  });

  it("says the true count", () => {
    expect(bulkApproveMessage({ requested: 5, approved: 5 }).text).toBe("Approved · 5");
  });

  it("reports the ones that failed", () => {
    const msg = bulkApproveMessage({
      requested: 5,
      approved: 3,
      reason: "Recap not found.",
    });
    expect(msg.tone).toBe("warning");
    expect(msg.text).toBe("Approved 3 of 5. 2 couldn't be approved. Recap not found.");
  });

  it("is an error when none were approved", () => {
    expect(bulkApproveMessage({ requested: 2, approved: 0, reason: "Not allowed." })).toEqual({
      text: "Not allowed.",
      tone: "error",
    });
  });
});
