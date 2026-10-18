import { describe, expect, it } from "vitest";
import { accountMapTruncation } from "./accountMapPages";

describe("account map truncation", () => {
  it("names the cap when the first page is not the whole map", () => {
    expect(accountMapTruncation({ total: 4500, scanned: 2000 })).toEqual({
      truncated: true,
      label: "Showing 2,000 of 4,500",
    });
  });

  it("stays quiet when every pin fits in the page", () => {
    expect(accountMapTruncation({ total: 80, scanned: 2000 }).truncated).toBe(false);
    expect(accountMapTruncation({ total: 2000, scanned: 2000 }).label).toBeNull();
    expect(accountMapTruncation({ total: null, scanned: 2000 }).truncated).toBe(false);
  });
});
