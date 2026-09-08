import { describe, expect, it } from "vitest";
import { requestDateKey } from "./requestDateKey";

describe("requestDateKey", () => {
  it("reads YYYY-MM-DD prefixes from ISO datetimes", () => {
    expect(requestDateKey("2026-09-10T14:00:00")).toBe("2026-09-10");
    expect(requestDateKey("2026-09-08T00:00:00")).toBe("2026-09-08");
  });

  it("accepts date-only strings", () => {
    expect(requestDateKey("2026-09-14")).toBe("2026-09-14");
  });

  it("returns null for empty or malformed values", () => {
    expect(requestDateKey(null)).toBeNull();
    expect(requestDateKey(undefined)).toBeNull();
    expect(requestDateKey("")).toBeNull();
    expect(requestDateKey("not-a-date")).toBeNull();
  });

  it("does not NaN-skip ISO days the way split('-').map(Number) does", () => {
    const raw = "2026-09-10T14:00:00";
    const broken = raw.split("-").map(Number);
    expect(Number.isNaN(broken[2])).toBe(true);
    expect(requestDateKey(raw)).toBe("2026-09-10");
  });
});
