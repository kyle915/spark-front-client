import { describe, expect, it } from "vitest";
import { askedWhen, outcomeLabel } from "./baProductNotes";

describe("baProductNotes", () => {
  it("labels every outcome the API sends, in sentence case", () => {
    expect(outcomeLabel("answered")).toBe("Answered");
    expect(outcomeLabel("not_in_notes")).toBe("Not in the notes — add it");
    expect(outcomeLabel("no_material")).toBe("No notes yet");
    expect(outcomeLabel("ai_unavailable")).toBe("AI unavailable");
  });
  it("says when a question was asked", () => {
    const now = new Date("2026-11-17T18:00:00Z");
    expect(askedWhen("2026-11-17T17:40:00Z", now)).toBe("20 min ago");
    expect(askedWhen("2026-11-17T15:00:00Z", now)).toBe("3 h ago");
    expect(askedWhen("", now)).toBe("");
  });
});
