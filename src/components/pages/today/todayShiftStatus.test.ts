import { describe, expect, it } from "vitest";
import { assigneesForEvent, clockStateLabel } from "./todayShiftStatus";

describe("today shift status", () => {
  it("names the live-board clock states", () => {
    expect(clockStateLabel("clocked_in")).toBe("Clocked in");
    expect(clockStateLabel("clocked_out")).toBe("Clocked out");
    expect(clockStateLabel("no_show")).toBe("No-show");
    expect(clockStateLabel("something-new")).toBe("Scheduled");
  });

  it("attaches a shift's BAs to that event only", () => {
    const shifts = [
      {
        eventUuid: "evt-1",
        assigned: [
          { ambassadorUuid: "a", name: "Alicia", status: "clocked_in" },
          { ambassadorUuid: "b", name: "  ", status: "no_show" },
        ],
      },
      {
        eventUuid: "evt-2",
        assigned: [{ ambassadorUuid: "c", name: "Jordan", status: "clocked_out" }],
      },
    ];
    expect(assigneesForEvent("evt-1", shifts)).toEqual([
      { ambassadorUuid: "a", name: "Alicia", status: "clocked_in" },
    ]);
    expect(assigneesForEvent("missing", shifts)).toEqual([]);
  });
});
