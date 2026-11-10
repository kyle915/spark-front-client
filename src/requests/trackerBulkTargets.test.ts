import { describe, expect, it } from "vitest";
import { bulkTargets } from "./trackerBulkTargets";

describe("bulkTargets", () => {
  const rows = [
    { id: "a", statusSlug: "pending", eventId: null },
    { id: "b", statusSlug: "QUEUE", eventId: "e1" },
    { id: "c", statusSlug: "approved", eventId: "e2" },
    { id: "d", statusSlug: "done", eventId: null },
  ];
  it("approves only pending / queue rows", () => {
    expect(bulkTargets(rows).approvable.map((r) => r.id)).toEqual(["a", "b"]);
  });
  it("assigns only rows that have an event", () => {
    expect(bulkTargets(rows).assignable.map((r) => r.id)).toEqual(["b", "c"]);
  });
});
