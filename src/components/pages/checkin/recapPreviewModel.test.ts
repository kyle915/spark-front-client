import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PREVIEW_OFFLINE_NO_COPY,
  buildChecklist,
  conditionHint,
  fieldKind,
  fieldTypeHint,
  loadRecapPreview,
  photoCountLabel,
  previewFromContext,
  previewPath,
  readCachedPreview,
  type RecapPreviewPayload,
} from "./recapPreviewModel";
import type { Context } from "./checkinTypes";

const payload = (over: Partial<RecapPreviewPayload> = {}): RecapPreviewPayload => ({
  programs: [],
  program: { id: "7", name: "Retail Sampling" },
  needsProgram: false,
  template: {
    name: "Retail recap",
    productSamples: true,
    sampleQtyLabel: "Cans sampled:",
    sections: [
      {
        name: "Details",
        fields: [
          { id: "1", name: "Consumers sampled:", type: "number", required: true, options: [] },
          { id: "2", name: "Store traffic", type: "select", required: true, options: ["Busy", "Slow"] },
          { id: "3", name: "Why slow?", type: "text", required: true, options: [],
            showWhen: { fieldId: "2", includes: "Slow" } },
          { id: "4", name: "Anything else?", type: "long_text", required: false, options: [] },
          { id: "5", name: "Repeat buyers", type: "number", required: false, options: [] },
        ],
      },
    ],
    products: [{ name: "Lime 12oz" }, { name: "Mango 12oz" }],
  },
  photoBuckets: [
    { name: "Table Setup", helper: "", min: 1 },
    { name: "Shelf", helper: "", min: 0 },
  ],
  minPhotos: 1,
  ...over,
});

describe("recap preview helpers", () => {
  it("builds the no-login preview path with the program", () => {
    expect(previewPath("LD-TNBJ8K")).toBe("/checkin/LD-TNBJ8K/preview");
    expect(previewPath("LD-TNBJ8K", "12")).toBe("/checkin/LD-TNBJ8K/preview?program=12");
  });

  it("maps field types to plain hints", () => {
    expect(fieldKind("number")).toBe("number");
    expect(fieldKind("multiselect")).toBe("multi");
    expect(fieldKind("dropdown")).toBe("choice");
    expect(fieldKind("photo")).toBe("photo");
    expect(fieldTypeHint({ type: "select", options: ["a"] })).toBe("Pick one");
    expect(fieldTypeHint({ type: "multiselect", options: [] })).toBe("Pick all that apply");
    expect(fieldTypeHint({ type: "long_text", options: [] })).toBe("A few sentences");
    expect(fieldTypeHint({ type: "text", options: [] })).toBe("Short answer");
  });

  it("explains a conditional question", () => {
    const p = payload();
    const fields = p.template!.sections[0].fields;
    expect(conditionHint(fields[2], fields)).toBe("Only if Store traffic is Slow");
    expect(conditionHint(fields[0], fields)).toBeNull();
  });

  it("summarizes required numbers, choices, product counts and photos", () => {
    const list = buildChecklist(payload());
    expect(list.counts.map((c) => c.text)).toEqual([
      "Cans sampled, for each product",
      "Consumers sampled",
    ]);
    expect(list.counts[0].note).toBe("2 products on the list");
    // Optional numbers are not on the checklist.
    expect(list.counts.some((c) => c.text === "Repeat buyers")).toBe(false);
    expect(list.answers).toEqual([{ text: "Store traffic", note: "Busy, Slow" }]);
    expect(list.photos).toEqual([
      { text: "Table Setup", note: "at least 1" },
      { text: "Shelf", note: "optional" },
    ]);
  });

  it("asks for setup photos when the brand has no photo sections", () => {
    const list = buildChecklist(payload({ photoBuckets: [] }));
    expect(list.photos).toEqual([{ text: "Photos of your setup", note: "at least 1" }]);
  });

  it("labels photo counts", () => {
    expect(photoCountLabel(3)).toBe("at least 3");
    expect(photoCountLabel(0)).toBe("optional");
  });

  it("builds the preview from the real form after identify", () => {
    const ctx = {
      brand: { name: "Brand", primaryColor: null },
      event: { uuid: "u", name: "n", address: null, startTime: null, endTime: null,
        eventType: { id: "7", name: "Retail Sampling" } },
      template: {
        id: "9", name: "Retail recap", productSamples: false,
        sections: [{ id: "s", name: "Details", fields: [
          { id: "1", name: "Consumers", required: true, type: "number", options: [] },
        ] }],
        products: [],
      },
      photoBuckets: [{ id: "44", name: "Shelf", helper: "", min: 2 }],
    } as unknown as Context;
    const p = previewFromContext(ctx)!;
    expect(p.program?.id).toBe("7");
    expect(p.photoBuckets).toEqual([{ name: "Shelf", helper: "", min: 2 }]);
    expect(previewFromContext({ ...ctx, timesheetOnly: true })).toBeNull();
    expect(previewFromContext({ ...ctx, template: null })).toBeNull();
  });
});

class MemoryStorage {
  private map = new Map<string, string>();
  getItem(k: string) {
    return this.map.has(k) ? (this.map.get(k) as string) : null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, String(v));
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
  clear() {
    this.map.clear();
  }
}

describe("loadRecapPreview", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", new MemoryStorage());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("saves a copy and serves it when the phone has no signal", async () => {
    const ok = vi.fn(async () => new Response(JSON.stringify(payload()), { status: 200 }));
    const first = await loadRecapPreview("LD-1", "7", ok);
    expect(first.kind).toBe("ok");
    expect(readCachedPreview("LD-1", "7")?.template?.name).toBe("Retail recap");

    const offline = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    const second = await loadRecapPreview("LD-1", "7", offline);
    expect(second).toMatchObject({ kind: "ok", offline: true });
  });

  it("says so when offline with nothing saved", async () => {
    const offline = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    const res = await loadRecapPreview("LD-2", null, offline);
    expect(res).toEqual({ kind: "error", code: "offline", message: PREVIEW_OFFLINE_NO_COPY });
  });

  it("passes the API's refusal through (time-sheet-only, dead link)", async () => {
    const refused = vi.fn(async () =>
      new Response(JSON.stringify({ error: "timesheet_only", message: "This link has no recap to preview." }), {
        status: 404,
      }),
    );
    const res = await loadRecapPreview("TS-1", null, refused);
    expect(res).toEqual({
      kind: "error",
      code: "timesheet_only",
      message: "This link has no recap to preview.",
    });
    expect(readCachedPreview("TS-1", null)).toBeNull();
  });
});
