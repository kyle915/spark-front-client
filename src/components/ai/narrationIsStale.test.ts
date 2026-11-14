import { describe, expect, it } from "vitest";
import { narrationIsStale } from "./narrationIsStale";

describe("narrationIsStale", () => {
  const now = new Date("2026-11-14T18:00:00Z");

  it("keeps last week's summary and drops one from five weeks ago", () => {
    expect(narrationIsStale("2026-11-08", now)).toBe(false);
    expect(narrationIsStale("2026-10-11", now)).toBe(true);
  });

  it("treats an unreadable date as stale", () => {
    expect(narrationIsStale("", now)).toBe(true);
  });
});
