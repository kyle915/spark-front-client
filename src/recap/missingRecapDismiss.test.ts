import { describe, expect, it } from "vitest";
import {
  DISMISS_NOTE_MAX,
  DISMISS_REASONS,
  cleanDismissNote,
  dismissNoteProblem,
  dismissTargetCount,
  dismissTargetsForEvents,
  dismissedByLine,
  dismissedMessage,
} from "./missingRecapDismiss";

describe("dismiss reasons", () => {
  it("offers the five reasons in order, Other last, in sentence case", () => {
    expect(DISMISS_REASONS.map((r) => r.label)).toEqual([
      "Did not work the shift",
      "Recap filed elsewhere",
      "Duplicate or test shift",
      "Not needed for this event",
      "Other",
    ]);
    expect(DISMISS_REASONS.map((r) => r.value)).toEqual([
      "did_not_work",
      "filed_elsewhere",
      "duplicate_or_test",
      "not_needed",
      "other",
    ]);
  });
});

describe("dismissNoteProblem", () => {
  it("lets every reason but Other go without a note", () => {
    for (const { value } of DISMISS_REASONS) {
      if (value === "other") continue;
      expect(dismissNoteProblem(value, "")).toBeNull();
      expect(dismissNoteProblem(value, null)).toBeNull();
    }
  });

  it("requires a real note for Other", () => {
    expect(dismissNoteProblem("other", "")).toMatch(/note/i);
    expect(dismissNoteProblem("other", "   \n ")).toMatch(/note/i);
    expect(dismissNoteProblem("other", "Rained out")).toBeNull();
  });

  it("caps the note length for any reason", () => {
    const long = "x".repeat(DISMISS_NOTE_MAX + 1);
    expect(dismissNoteProblem("not_needed", long)).toMatch(/280/);
    expect(dismissNoteProblem("not_needed", "x".repeat(DISMISS_NOTE_MAX))).toBeNull();
  });

  it("cleans whitespace the way the server stores it", () => {
    expect(cleanDismissNote("  Client   said\nno ")).toBe("Client said no");
    expect(cleanDismissNote(undefined)).toBe("");
  });
});

describe("dismissTargetsForEvents", () => {
  const ba = (id: string) => ({ ambassadorEventUuid: id });

  it("sends each ambassador row, and an unassigned event as a whole", () => {
    const targets = dismissTargetsForEvents([
      { eventUuid: "e1", assignedAmbassadors: [ba("a1"), ba("a2")] },
      { eventUuid: "e2", assignedAmbassadors: [] },
      { eventUuid: "e3", assignedAmbassadors: [ba("a3")] },
    ]);
    expect(targets).toEqual({
      ambassadorEventUuids: ["a1", "a2", "a3"],
      eventUuids: ["e2"],
    });
    expect(dismissTargetCount(targets)).toBe(4);
  });

  it("is empty for nothing selected", () => {
    const targets = dismissTargetsForEvents([]);
    expect(dismissTargetCount(targets)).toBe(0);
  });
});

describe("wording", () => {
  it("counts dismissed rows in plain words", () => {
    expect(dismissedMessage(1)).toBe("Missing recap dismissed.");
    expect(dismissedMessage(4)).toBe("4 missing recaps dismissed.");
  });

  it("names who dismissed a row and when", () => {
    const line = dismissedByLine("Sam Staff", "2026-11-14T15:05:00");
    expect(line.startsWith("Sam Staff · Nov 14, 2026")).toBe(true);
    expect(dismissedByLine("", null)).toBe("Staff");
    expect(dismissedByLine("Sam Staff", "not a date")).toBe("Sam Staff");
  });
});
