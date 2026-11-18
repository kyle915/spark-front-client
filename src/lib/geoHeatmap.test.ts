import { describe, expect, it } from "vitest";
import { NO_DATA_FILL, focusBox, labelInk, rampColor, rampPosition, shareLabel } from "./geoHeatmap";

const lightness = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return ((n >> 16) & 255) * 0.2126 + ((n >> 8) & 255) * 0.7152 + (n & 255) * 0.0722;
};

describe("rampColor", () => {
  it("gets darker as the value grows in light mode", () => {
    expect(lightness(rampColor(1, "light"))).toBeLessThan(lightness(rampColor(0.5, "light")));
    expect(lightness(rampColor(0.5, "light"))).toBeLessThan(lightness(rampColor(0, "light")));
  });

  it("gets stronger against the dark card as the value grows in dark mode", () => {
    expect(lightness(rampColor(1, "dark"))).toBeGreaterThan(lightness(rampColor(0, "dark")));
  });

  it("puts the top of the ramp on its last stop", () => {
    expect(rampColor(1, "light")).toBe("#0d366b");
    expect(rampColor(0, "light")).toBe("#86b6ef");
  });

  it("never matches the no-activity fill", () => {
    for (const mode of ["light", "dark"] as const) {
      for (const t of [0, 0.25, 0.5, 0.75, 1]) {
        expect(rampColor(t, mode)).not.toBe(NO_DATA_FILL[mode]);
      }
    }
  });
});

describe("rampPosition", () => {
  it("puts the leader at the top and zero at the bottom", () => {
    expect(rampPosition(640, 640)).toBe(1);
    expect(rampPosition(0, 640)).toBe(0);
  });

  it("keeps a half-sized state about halfway up", () => {
    const t = rampPosition(307, 640);
    expect(t).toBeGreaterThan(0.45);
    expect(t).toBeLessThan(0.6);
  });
});

describe("labelInk", () => {
  it("uses white on the darkest blue and ink on the lightest", () => {
    expect(labelInk("#0d366b")).toBe("#ffffff");
    expect(labelInk("#b7d3f6")).toBe("#14160f");
  });
});

describe("focusBox", () => {
  const map = { w: 800, h: 500 };

  it("frames a tight cluster of states", () => {
    const box = focusBox({ x: 500, y: 180, w: 90, h: 70 }, map);
    expect(box).not.toBeNull();
    expect(box!.w).toBeLessThan(800);
    // Keeps the map's aspect so nothing is stretched.
    expect(box!.w / box!.h).toBeCloseTo(800 / 500, 5);
    // The active states stay inside the frame.
    expect(box!.x).toBeLessThanOrEqual(500);
    expect(box!.x + box!.w).toBeGreaterThanOrEqual(590);
  });

  it("shows the whole map when activity spans the country", () => {
    expect(focusBox({ x: 40, y: 100, w: 700, h: 300 }, map)).toBeNull();
  });

  it("shows the whole map when there is nothing active", () => {
    expect(focusBox(null, map)).toBeNull();
  });

  it("keeps the frame on the map at the edges", () => {
    const box = focusBox({ x: 5, y: 150, w: 60, h: 120 }, map)!;
    expect(box.x).toBeGreaterThanOrEqual(0);
  });
});

describe("shareLabel", () => {
  it("rounds to whole percents and marks slivers", () => {
    expect(shareLabel(640, 947)).toBe("68%");
    expect(shareLabel(1, 1000)).toBe("<1%");
    expect(shareLabel(0, 10)).toBe("");
  });
});
