import { describe, expect, it, vi } from "vitest";
import {
  TALLY_READ_TIMEOUT_MS,
  TALLY_UNREADABLE,
  isTallyNumberType,
  parseTallyRead,
  requestTallyRead,
  shownProposals,
  tallyFoundLine,
} from "./tallyRead";

const base = {
  origin: "https://api.example.test",
  code: "CK-1",
  session: "tok",
  file: new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" }),
  contentType: "image/jpeg",
  includeProducts: false,
};

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const unreadable = { ok: false, fields: {}, products: {}, message: TALLY_UNREADABLE };

describe("tally read request", () => {
  it("posts the photo to the tally endpoint for this link", async () => {
    const fetchImpl = vi.fn(async () =>
      reply({
        available: true,
        values: [{ fieldId: "7", value: "48" }],
        productSamples: [{ productId: "3", value: "18" }],
        message: "",
      }),
    );
    const result = await requestTallyRead({ ...base, includeProducts: true, fetchImpl });

    expect(result).toEqual({ ok: true, fields: { "7": "48" }, products: { "3": "18" }, message: "" });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.example.test/api/public/checkin/CK-1/tally-read");
    expect(JSON.parse(String(init.body))).toEqual({
      session: "tok",
      imageBase64: "AQID",
      contentType: "image/jpeg",
      includeProducts: true,
    });
  });

  it("is the plain line, never an error, when the server refuses or fails", async () => {
    for (const status of [401, 404, 429, 500, 502]) {
      const fetchImpl = async () => reply({ error: "rate_limited" }, status);
      expect(await requestTallyRead({ ...base, fetchImpl })).toEqual(unreadable);
    }
    const offline = async () => {
      throw new TypeError("Failed to fetch");
    };
    expect(await requestTallyRead({ ...base, fetchImpl: offline })).toEqual(unreadable);
  });

  it("gives up on a stalled connection and says to type the numbers", async () => {
    const fetchImpl = (_input: string, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      });
    const started = Date.now();
    const result = await requestTallyRead({ ...base, fetchImpl, timeoutMs: 30 });

    expect(result).toEqual(unreadable);
    expect(Date.now() - started).toBeLessThan(1000);
    expect(TALLY_READ_TIMEOUT_MS).toBe(8000);
    expect(TALLY_UNREADABLE).toBe("Could not read that photo. Enter the numbers by hand.");
  });

  it("never sends something that is not a photo", async () => {
    const fetchImpl = vi.fn(async () => reply({}));
    await requestTallyRead({ ...base, contentType: "application/pdf", fetchImpl });
    await requestTallyRead({ ...base, file: new Blob([]), fetchImpl });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("tally proposals", () => {
  it("keeps plain numbers only", () => {
    expect(
      parseTallyRead({
        available: true,
        values: [
          { fieldId: "7", value: "48" },
          { fieldId: "8", value: "about 12" },
          { fieldId: "9", value: 3 },
          { fieldId: "", value: "5" },
          { fieldId: "10", value: "38.11" },
        ],
        productSamples: "nope",
      }),
    ).toEqual({ ok: true, fields: { "7": "48", "10": "38.11" }, products: {}, message: "" });
  });

  it("is unreadable when nothing usable came back", () => {
    expect(parseTallyRead(null)).toEqual(unreadable);
    expect(parseTallyRead({ available: false, values: [{ fieldId: "7", value: "48" }] })).toEqual(
      unreadable,
    );
    expect(parseTallyRead({ available: true, values: [], productSamples: [] })).toEqual(unreadable);
  });

  it("shows a proposal only for a box on screen that does not already hold it", () => {
    const proposals = { "7": "48", "8": "12", "9": "3" };
    expect(shownProposals(proposals, ["7", "8"], { "7": "48", "8": "10" })).toEqual({ "8": "12" });
    expect(shownProposals(proposals, [], {})).toEqual({});
  });

  it("offers numbers for number boxes only", () => {
    expect(isTallyNumberType("number")).toBe(true);
    expect(isTallyNumberType("Long text")).toBe(false);
    expect(isTallyNumberType("multiselect")).toBe(false);
  });

  it("words the count plainly", () => {
    expect(tallyFoundLine(1)).toBe("Found 1 number. Check it next to its box.");
    expect(tallyFoundLine(4)).toBe("Found 4 numbers. Check each one next to its box.");
  });
});
