import { describe, expect, it } from "vitest";
import {
  TYPE_WHAT_HAPPENED,
  VOICE_DRAFT_UNAVAILABLE,
  applyVoiceFills,
  draftSlotForField,
  notesFallbackFill,
  requestVoiceDraft,
} from "./voiceDraft";

const fields = [
  { id: "notes", name: "Account notes", type: "text" },
  { id: "feedback", name: "Feedback & Account Notes", type: "long text" },
  { id: "rival", name: "Why they like it", type: "text" },
  { id: "count", name: "How many people did you survey", type: "number" },
  { id: "spend", name: "Total spend on the card", type: "text" },
  { id: "samples", name: "Cans sampled", type: "number" },
];

describe("voice draft", () => {
  it("fills notes, feedback, and competitor text only", () => {
    expect(draftSlotForField(fields[0])).toBe("notes");
    expect(draftSlotForField(fields[1])).toBe("feedback");
    expect(draftSlotForField(fields[2])).toBe("competitor");
    expect(draftSlotForField(fields[3])).toBeNull();
    expect(draftSlotForField(fields[4])).toBeNull();
    expect(draftSlotForField(fields[5])).toBeNull();
  });

  it("does not write numbers into the recap", () => {
    const next = applyVoiceFills(
      { count: "", samples: "", notes: "" },
      [
        { fieldId: "notes", text: "The aisle was quiet after 4." },
        { fieldId: "count", text: "80" },
        { fieldId: "samples", text: "12" },
        { fieldId: "spend", text: "24.50" },
      ],
      fields,
    );
    expect(next.notes).toBe("The aisle was quiet after 4.");
    expect(next.count).toBe("");
    expect(next.samples).toBe("");
    expect(next.spend).toBeUndefined();
  });

  it("places an unsplit transcript in notes when structuring is unavailable", () => {
    expect(notesFallbackFill("They asked about a competitor tea.", fields)).toEqual([
      { fieldId: "notes", text: "They asked about a competitor tea." },
    ]);
  });

  it("uses the type-or-paste path when the request fails", async () => {
    expect(TYPE_WHAT_HAPPENED).toMatch(/Type or paste/);
    const result = await requestVoiceDraft({
      origin: "https://api.test",
      code: "BD-AQRACD",
      session: "tok",
      transcript: "Busy stop.",
      fetchImpl: async () => new Response("no", { status: 503 }),
    });
    expect(result.reason).toBe(VOICE_DRAFT_UNAVAILABLE);
    expect(result.fills).toEqual([]);
  });
});
