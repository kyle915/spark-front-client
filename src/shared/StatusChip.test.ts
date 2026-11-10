import { describe, expect, it } from "vitest";
import { statusTone } from "./StatusChip";

describe("statusTone", () => {
  it("maps the three tones consistently", () => {
    expect(statusTone("needs_review")).toBe("attention");
    expect(statusTone("Needs Review")).toBe("attention");
    expect(statusTone("approved")).toBe("done");
    expect(statusTone("PAID")).toBe("done");
    expect(statusTone("pending")).toBe("progress");
    expect(statusTone("hours-approved")).toBe("progress");
  });
  it("falls back to neutral", () => {
    expect(statusTone("something new")).toBe("neutral");
    expect(statusTone(null)).toBe("neutral");
  });
});
