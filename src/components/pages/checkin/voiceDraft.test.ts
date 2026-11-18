import { describe, expect, it } from "vitest";
import {
  MAX_RECORDING_BYTES,
  VOICE_DRAFT_UNAVAILABLE,
  formatClock,
  mergeVoiceDraft,
  notesFallback,
  parseVoiceDraft,
  pickRecordingType,
  productReplaceKey,
  recordingFileName,
  requestVoiceDraft,
  requestVoiceTranscribe,
  voiceSummaryLine,
  type VoiceDraftResult,
} from "./voiceDraft";

const fields = [
  { id: "sampled", name: "Total number of consumers sampled", type: "forminputinteger" },
  { id: "cans", name: "Single cans sold", type: "number" },
  { id: "spot", name: "Where did you set up?", type: "select", options: ["Front entrance", "Endcap"] },
  { id: "flavors", name: "Products sampled", type: "multiselect", options: ["Mango", "Lime", "Peach"] },
  { id: "back", name: "Can we come back?", type: "select", options: ["Yes", "No"] },
  { id: "notes", name: "Account notes", type: "longtext" },
  { id: "photo", name: "Shelf photo", type: "image" },
  { id: "miles", name: "Mileage", type: "number" },
];
const products = [
  { id: "p-mango", name: "Mango" },
  { id: "p-lime", name: "Lime" },
];

const draft = (over: Partial<VoiceDraftResult> = {}): VoiceDraftResult => ({
  available: true,
  reason: "",
  values: [
    { fieldId: "sampled", value: "40", confidence: "high" },
    { fieldId: "cans", value: "12", confidence: "medium" },
    { fieldId: "spot", value: "Front entrance", confidence: "high" },
    { fieldId: "back", value: "Yes", confidence: "high" },
    { fieldId: "notes", value: "Busy after lunch.", confidence: "high" },
  ],
  productSamples: [],
  ...over,
});

describe("voice merge rules", () => {
  it("fills every empty field type and marks medium answers to check", () => {
    const out = mergeVoiceDraft({ values: {}, samples: {}, draft: draft(), fields, products });
    expect(out.values).toEqual({
      sampled: "40",
      cans: "12",
      spot: "Front entrance",
      back: "Yes",
      notes: "Busy after lunch.",
    });
    expect(Object.keys(out.filledFields)).toHaveLength(5);
    expect(out.conflicts).toEqual([]);
    expect(out.checkFields).toEqual(["cans"]);
  });

  it("never overwrites a value the BA typed; it becomes a conflict", () => {
    const out = mergeVoiceDraft({
      values: { sampled: "38", notes: "My own words", spot: "Front entrance" },
      samples: {},
      draft: draft(),
      fields,
      products,
    });
    expect(out.values.sampled).toBe("38");
    expect(out.values.notes).toBe("My own words");
    expect(out.conflicts.map((c) => c.id).sort()).toEqual(["notes", "sampled"]);
    // Same answer already there: not a conflict and not re-filled.
    expect(out.filledFields.spot).toBeUndefined();
    expect(out.values.cans).toBe("12");
  });

  it("replaces only the box the BA tapped Replace on", () => {
    const out = mergeVoiceDraft({
      values: { sampled: "38", notes: "My own words" },
      samples: {},
      draft: draft(),
      fields,
      products,
      replaceIds: new Set(["sampled"]),
    });
    expect(out.values.sampled).toBe("40");
    expect(out.values.notes).toBe("My own words");
    expect(out.conflicts.map((c) => c.id)).toEqual(["notes"]);
  });

  it("never touches photo or mileage fields, and drops bad shapes and options", () => {
    const out = mergeVoiceDraft({
      values: {},
      samples: {},
      draft: draft({
        values: [
          { fieldId: "photo", value: "x", confidence: "high" },
          { fieldId: "miles", value: "22", confidence: "high" },
          { fieldId: "flavors", value: "Mango", confidence: "high" },
          { fieldId: "spot", value: ["Endcap"], confidence: "high" },
          { fieldId: "unknown", value: "1", confidence: "high" },
          { fieldId: "flavors", value: ["Grape"], confidence: "high" },
        ],
      }),
      fields,
      products,
    });
    expect(out.values).toEqual({});
  });

  it("fills product counts and ticks them on an empty Products sampled list", () => {
    const out = mergeVoiceDraft({
      values: {},
      samples: { "p-lime": "5" },
      draft: draft({
        values: [],
        productSamples: [
          { productId: "p-mango", value: "25", confidence: "high" },
          { productId: "p-lime", value: "9", confidence: "high" },
          { productId: "p-other", value: "3", confidence: "high" },
        ],
      }),
      fields,
      products,
    });
    expect(out.samples).toEqual({ "p-mango": "25", "p-lime": "5" });
    expect(out.values.flavors).toEqual(["Mango"]);
    expect(out.conflicts).toEqual([
      { kind: "product", id: "p-lime", current: "5", proposed: "9" },
    ]);
    const replaced = mergeVoiceDraft({
      values: {},
      samples: { "p-lime": "5" },
      draft: draft({
        values: [],
        productSamples: [{ productId: "p-lime", value: "9", confidence: "high" }],
      }),
      fields,
      products,
      replaceIds: new Set([productReplaceKey("p-lime")]),
    });
    expect(replaced.samples["p-lime"]).toBe("9");
  });

  it("does not tick products on a list the BA already chose", () => {
    const out = mergeVoiceDraft({
      values: { flavors: ["Peach"] },
      samples: {},
      draft: draft({
        values: [],
        productSamples: [{ productId: "p-mango", value: "25", confidence: "high" }],
      }),
      fields,
      products,
    });
    expect(out.values.flavors).toEqual(["Peach"]);
  });

  it("summarises what it did", () => {
    expect(voiceSummaryLine(9, 0)).toBe("Filled 9 fields. Check them before you submit.");
    expect(voiceSummaryLine(1, 2)).toMatch(/^Filled 1 field\. .*2 fields already had answers/);
    expect(voiceSummaryLine(0, 0)).toMatch(/Nothing you said matched/);
  });

  it("falls back to the notes box when structuring is unavailable", () => {
    expect(notesFallback("Quiet shift.", fields)).toEqual([
      { fieldId: "notes", value: "Quiet shift.", confidence: "medium" },
    ]);
  });
});

describe("voice server replies", () => {
  it("parses full drafts and drops malformed answers", () => {
    const parsed = parseVoiceDraft({
      available: true,
      values: [
        { fieldId: "flavors", value: ["Mango", 3], confidence: "high" },
        { fieldId: "cans", value: "12" },
        { fieldId: "", value: "x" },
      ],
      productSamples: [
        { productId: "p-mango", value: "25" },
        { productId: "p-lime", value: "lots" },
      ],
    });
    expect(parsed.values).toEqual([
      { fieldId: "flavors", value: ["Mango"], confidence: "high" },
      { fieldId: "cans", value: "12", confidence: "medium" },
    ]);
    expect(parsed.productSamples).toEqual([
      { productId: "p-mango", value: "25", confidence: "medium" },
    ]);
  });

  it("reads an older server's text fills", () => {
    const parsed = parseVoiceDraft({ available: true, fills: [{ fieldId: "notes", text: "Hi" }] });
    expect(parsed.values).toEqual([{ fieldId: "notes", value: "Hi", confidence: "medium" }]);
  });

  it("is unavailable when the request fails", async () => {
    const result = await requestVoiceDraft({
      origin: "https://api.test",
      code: "BD-AQRACD",
      session: "tok",
      transcript: "Busy stop.",
      fetchImpl: async () => new Response("no", { status: 503 }),
    });
    expect(result.reason).toBe(VOICE_DRAFT_UNAVAILABLE);
    expect(result.values).toEqual([]);
  });

  it("uploads a recording as multipart and returns transcript + draft", async () => {
    let sent: FormData | null = null;
    const result = await requestVoiceTranscribe({
      origin: "https://api.test",
      code: "CK-1",
      session: "tok",
      audio: new Blob(["abc"], { type: "audio/mp4" }),
      type: "audio/mp4",
      durationMs: 4200.4,
      fetchImpl: async (_url, init) => {
        sent = init?.body as FormData;
        return new Response(
          JSON.stringify({
            transcribed: true,
            transcript: "Sold 12 cans.",
            message: "",
            draft: {
              available: true,
              values: [{ fieldId: "cans", value: "12", confidence: "high" }],
            },
          }),
          { status: 200 },
        );
      },
    });
    expect(result.transcript).toBe("Sold 12 cans.");
    expect(result.draft?.values[0].value).toBe("12");
    const form = sent as unknown as FormData;
    expect(form.get("session")).toBe("tok");
    expect(form.get("durationMs")).toBe("4200");
    expect((form.get("audio") as File).name).toBe("voice.m4a");
  });

  it("refuses an oversized recording before uploading", async () => {
    let called = false;
    const result = await requestVoiceTranscribe({
      origin: "https://api.test",
      code: "CK-1",
      session: "tok",
      audio: new Blob([new Uint8Array(MAX_RECORDING_BYTES + 1)]),
      type: "audio/webm",
      durationMs: 1000,
      fetchImpl: async () => {
        called = true;
        return new Response("{}");
      },
    });
    expect(called).toBe(false);
    expect(result.transcribed).toBe(false);
    expect(result.message).toMatch(/under 3 minutes/);
  });

  it("picks a recording type the server reads (iPhone records mp4)", () => {
    expect(pickRecordingType((t) => t === "audio/mp4")).toBe("audio/mp4");
    expect(pickRecordingType((t) => t.startsWith("audio/webm"))).toBe("audio/webm;codecs=opus");
    expect(pickRecordingType(() => false)).toBe("");
    expect(recordingFileName("audio/webm;codecs=opus")).toBe("voice.webm");
    expect(formatClock(65_400)).toBe("1:05");
  });
});
