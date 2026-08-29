import { describe, expect, it } from "vitest";
import {
  SECOND_SHIFT_HINT,
  SECOND_SHIFT_LABEL,
  SECOND_SHIFT_PROMPT,
  supportsStandingSecondShift,
} from "./secondShift";

describe("supportsStandingSecondShift", () => {
  it("is true for Feel Free standing clock links on the same day", () => {
    expect(
      supportsStandingSecondShift({
        mode: "tenant",
        brand: { name: "Feel Free", requestUrlName: "bl00-feel-free" },
        eventDate: "2026-08-29T12:00:00Z",
        today: "2026-08-29",
      }),
    ).toBe(true);
  });

  it("stays off for Liquid Death, Torch, Brew Dr, and per-event codes", () => {
    expect(
      supportsStandingSecondShift({
        mode: "tenant",
        brand: { name: "Liquid Death", requestUrlName: "ighn-liquid-death" },
        eventDate: "2026-08-29",
        today: "2026-08-29",
      }),
    ).toBe(false);
    expect(
      supportsStandingSecondShift({
        mode: "tenant",
        brand: { name: "Torch THC", requestUrlName: "keee-torch-thc" },
        eventDate: "2026-08-29",
        today: "2026-08-29",
      }),
    ).toBe(false);
    expect(
      supportsStandingSecondShift({
        mode: "tenant",
        brand: { name: "Brew Dr. Kombucha", requestUrlName: "brew-dr" },
        eventDate: "2026-08-29",
        today: "2026-08-29",
      }),
    ).toBe(false);
    expect(
      supportsStandingSecondShift({
        mode: "event",
        brand: { name: "Feel Free", requestUrlName: "bl00-feel-free" },
        eventDate: "2026-08-29",
        today: "2026-08-29",
      }),
    ).toBe(false);
    expect(
      supportsStandingSecondShift({
        mode: "tenant",
        brand: { name: "Feel Free" },
        recapOnly: true,
        eventDate: "2026-08-29",
        today: "2026-08-29",
      }),
    ).toBe(false);
  });

  it("stays off when the restored session is a leftover prior day", () => {
    expect(
      supportsStandingSecondShift({
        mode: "tenant",
        brand: { name: "Feel Free", requestUrlName: "bl00-feel-free" },
        eventDate: "2026-08-28T12:00:00Z",
        today: "2026-08-29",
      }),
    ).toBe(false);
  });

  it("keeps the admin label stable", () => {
    expect(SECOND_SHIFT_LABEL).toBe("Second shift");
  });

  it("distinguishes same-day second shift from leftover prior-day copy", () => {
    expect(SECOND_SHIFT_PROMPT).toContain("second shift today");
    expect(SECOND_SHIFT_HINT.toLowerCase()).toContain("same day");
    expect(SECOND_SHIFT_HINT.toLowerCase()).toContain("not a leftover");
  });
});
