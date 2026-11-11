import { describe, expect, it } from "vitest";
import { issueWhen } from "./checkinIssues";

describe("check-in issue timing", () => {
  const now = new Date("2026-11-11T12:00:00Z");
  it("reads as a relative time", () => {
    expect(issueWhen("2026-11-11T11:59:50Z", now)).toBe("last just now");
    expect(issueWhen("2026-11-11T11:40:00Z", now)).toBe("last 20 min ago");
    expect(issueWhen("2026-11-11T09:00:00Z", now)).toBe("last 3 h ago");
    expect(issueWhen("2026-11-09T09:00:00Z", now)).toMatch(/^last Nov \d+$/);
  });
  it("is empty for a missing or bad timestamp", () => {
    expect(issueWhen("", now)).toBe("");
    expect(issueWhen("nope", now)).toBe("");
  });
});
