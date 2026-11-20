import { describe, expect, it } from "vitest";

import { programChangeNote } from "./walkupProgramChange";

describe("programChangeNote", () => {
  it("is empty when the BA never switched", () => {
    expect(programChangeNote({})).toBeNull();
    expect(programChangeNote({ programChangedFrom: "A", programChangedTo: "" })).toBeNull();
  });

  it("says who, from, to and when", () => {
    expect(
      programChangeNote(
        {
          programChangedFrom: "G7 Guerilla Sampling",
          programChangedTo: "Retail Sampling",
          programChangedAt: "2026-11-20T19:14:00Z",
        },
        () => "Nov 20, 2:14 PM",
      ),
    ).toBe("Program changed by BA from G7 Guerilla Sampling to Retail Sampling at Nov 20, 2:14 PM");
  });

  it("drops a missing from", () => {
    expect(programChangeNote({ programChangedTo: "Retail Sampling" })).toBe(
      "Program changed by BA to Retail Sampling",
    );
  });
});
