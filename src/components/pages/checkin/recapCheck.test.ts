import { describe, expect, it, vi } from "vitest";
import {
  RECAP_CHECK_TIMEOUT_MS,
  answersSignature,
  parseRecapCheckItems,
  recapCheckAnswers,
  recapCheckItemsForField,
  recapCheckKey,
  requestRecapCheck,
  type RecapCheckItem,
} from "./recapCheck";

const base = {
  origin: "https://api.example.test",
  code: "CK-1",
  session: "tok",
  fieldValues: [{ customFieldId: "7", value: "40" }],
  totalEngagements: 40,
  photoCount: 2,
};

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("recap check request", () => {
  it("posts the answers to the check endpoint for this link", async () => {
    const fetchImpl = vi.fn(async () =>
      reply({
        items: [
          {
            code: "sold_exceeds_sampled",
            message: "You sampled 40 people but sold 55 cans. Is that right?",
            fieldId: "9",
          },
        ],
      }),
    );
    const items = await requestRecapCheck({ ...base, fetchImpl });

    expect(items).toEqual([
      {
        code: "sold_exceeds_sampled",
        message: "You sampled 40 people but sold 55 cans. Is that right?",
        fieldId: "9",
        fieldIds: ["9"],
        severity: "warning",
      },
    ]);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.example.test/api/public/checkin/CK-1/recap-check");
    expect(JSON.parse(String(init.body))).toEqual({
      session: "tok",
      fieldValues: [{ customFieldId: "7", value: "40" }],
      totalEngagements: 40,
      photoCount: 2,
    });
  });

  it("is empty, never an error, when the server refuses or fails", async () => {
    for (const status of [401, 404, 429, 500, 502]) {
      const fetchImpl = async () => reply({ error: "rate_limited" }, status);
      expect(await requestRecapCheck({ ...base, fetchImpl })).toEqual([]);
    }
  });

  it("is empty when the network drops", async () => {
    const fetchImpl = async () => {
      throw new TypeError("Failed to fetch");
    };
    expect(await requestRecapCheck({ ...base, fetchImpl })).toEqual([]);
  });

  it("is empty when the reply is not JSON", async () => {
    const fetchImpl = async () => new Response("<html>bad gateway</html>", { status: 200 });
    expect(await requestRecapCheck({ ...base, fetchImpl })).toEqual([]);
  });

  it("gives up on a stalled connection instead of holding the form", async () => {
    const fetchImpl = (_input: string, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("aborted", "AbortError")),
        );
      });
    const started = Date.now();
    const items = await requestRecapCheck({ ...base, fetchImpl, timeoutMs: 30 });

    expect(items).toEqual([]);
    expect(Date.now() - started).toBeLessThan(1000);
  });
});

describe("recap check wait", () => {
  it("never holds Submit for more than five seconds", () => {
    expect(RECAP_CHECK_TIMEOUT_MS).toBe(5_000);
  });
});

describe("recap check reply", () => {
  it("keeps only rows with a message, and at most six", () => {
    const many = Array.from({ length: 9 }, (_v, i) => ({ code: "c", message: `Note ${i}` }));
    expect(parseRecapCheckItems({ items: many })).toHaveLength(6);
    expect(
      parseRecapCheckItems({
        items: [null, "x", { code: "c" }, { message: "  " }, { message: "Is 0 right?", fieldId: 4 }],
      }),
    ).toEqual([
      { code: "", message: "Is 0 right?", fieldId: null, fieldIds: [], severity: "warning" },
    ]);
    expect(parseRecapCheckItems(null)).toEqual([]);
    expect(parseRecapCheckItems({ items: "nope" })).toEqual([]);
  });
});

describe("answers signature", () => {
  it("is the same for the same answers in any order", () => {
    const a = answersSignature(
      [
        { customFieldId: "1", value: "40" },
        { customFieldId: "2", value: "55" },
      ],
      40,
      3,
    );
    const b = answersSignature(
      [
        { customFieldId: "2", value: "55" },
        { customFieldId: "1", value: "40" },
      ],
      40,
      5,
    );
    expect(a).toBe(b);
  });

  it("changes when an answer changes, or photos go from none to some", () => {
    const one = answersSignature([{ customFieldId: "1", value: "40" }], null, 0);
    expect(answersSignature([{ customFieldId: "1", value: "41" }], null, 0)).not.toBe(one);
    expect(answersSignature([{ customFieldId: "1", value: "40" }], null, 1)).not.toBe(one);
  });
});

describe("contradictions", () => {
  it("reads severity and every field a note is about", () => {
    const [item] = parseRecapCheckItems({
      items: [
        {
          code: "sold_total_zero",
          message: "You entered 5 for “Single cans sold” but 0 for “Total cans sold”. Is that right?",
          fieldId: "12",
          fieldIds: ["12", "9", 7, ""],
          severity: "error",
        },
      ],
    });
    expect(item.severity).toBe("error");
    expect(item.fieldId).toBe("12");
    expect(item.fieldIds).toEqual(["12", "9"]);
    expect(recapCheckItemsForField([item], "9")).toEqual([item]);
    expect(recapCheckItemsForField([item], "3")).toEqual([]);
  });

  it("an unknown severity reads as a warning, never a block", () => {
    const [item] = parseRecapCheckItems({
      items: [{ code: "x", message: "Check this.", severity: "block" }],
    });
    expect(item.severity).toBe("warning");
  });

  it("sends the receipts' total with the answers when there is one", async () => {
    const fetchImpl = vi.fn(async () => reply({ items: [] }));
    await requestRecapCheck({ ...base, receiptSpend: { total: "42.10" }, fetchImpl });
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body)).receiptSpend).toEqual({ total: "42.10" });
  });

  it("sends the confirmed and shown codes of the notes still on screen", () => {
    const items: RecapCheckItem[] = [
      { code: "sold_line_zero", message: "A", fieldId: "1", fieldIds: ["1"], severity: "warning" },
      { code: "clock_vs_schedule", message: "B", fieldId: null, fieldIds: [], severity: "warning" },
    ];
    const confirmed = new Set([
      recapCheckKey(items[0]),
      // A note the BA confirmed and then fixed, so it is no longer showing.
      recapCheckKey({ code: "first_time_exceeds_sampled", message: "C" }),
    ]);
    expect(recapCheckAnswers(items, confirmed, { total: "9.00" })).toEqual({
      checkConfirmed: ["sold_line_zero"],
      checkShown: ["sold_line_zero", "clock_vs_schedule"],
      receiptSpend: { total: "9.00" },
    });
    expect(recapCheckAnswers([], confirmed, null)).toEqual({
      checkConfirmed: [],
      checkShown: [],
    });
  });

  it("the same code with new numbers is a new question", () => {
    expect(recapCheckKey({ code: "c", message: "15 and 0" })).not.toBe(
      recapCheckKey({ code: "c", message: "15 and 3" }),
    );
  });
});
