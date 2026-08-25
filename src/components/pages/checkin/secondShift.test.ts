import { describe, expect, it } from "vitest";
import {
  SECOND_SHIFT_LABEL,
  supportsStandingSecondShift,
} from "./secondShift";

describe("supportsStandingSecondShift", () => {
  it("is true for Feel Free standing clock links", () => {
    expect(
      supportsStandingSecondShift({
        mode: "tenant",
        brand: { name: "Feel Free", requestUrlName: "bl00-feel-free" },
      }),
    ).toBe(true);
  });

  it("stays off for Liquid Death, Grub Hub, Luckin, and per-event codes", () => {
    expect(
      supportsStandingSecondShift({
        mode: "tenant",
        brand: { name: "Liquid Death", requestUrlName: "ighn-liquid-death" },
      }),
    ).toBe(false);
    expect(
      supportsStandingSecondShift({
        mode: "tenant",
        brand: { name: "Grub Hub", requestUrlName: "grub-hub" },
      }),
    ).toBe(false);
    expect(
      supportsStandingSecondShift({
        mode: "event",
        brand: { name: "Feel Free", requestUrlName: "bl00-feel-free" },
      }),
    ).toBe(false);
    expect(
      supportsStandingSecondShift({
        mode: "tenant",
        brand: { name: "Feel Free" },
        recapOnly: true,
      }),
    ).toBe(false);
  });

  it("keeps the admin label stable", () => {
    expect(SECOND_SHIFT_LABEL).toBe("Second shift");
  });
});
