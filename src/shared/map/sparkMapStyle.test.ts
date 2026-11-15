import { describe, expect, it } from "vitest";
import { sparkMapBackground, sparkMapStyle } from "./sparkMapStyle";
import {
  COVERAGE_MARK,
  clusterSize,
  clusterSvg,
  coveragePinSvg,
  phoneDotSvg,
  svgDataUrl,
} from "./markerIcons";
import { directionsUrl, fitTarget } from "./mapFit";

const HEX = /^#[0-9a-f]{6}$/;

describe("sparkMapStyle", () => {
  for (const appearance of ["light", "dark"] as const) {
    const style = sparkMapStyle(appearance);

    it(`${appearance}: every colour is a literal hex Google can read`, () => {
      const colours = style.flatMap((r) =>
        r.stylers.map((s) => s.color).filter((c): c is string => typeof c === "string"),
      );
      expect(colours.length).toBeGreaterThan(8);
      for (const c of colours) expect(c).toMatch(HEX);
    });

    it(`${appearance}: business, transit and icon labels are off; parks keep their shape`, () => {
      const off = (featureType: string | undefined, elementType?: string) =>
        style.some(
          (r) =>
            r.featureType === featureType &&
            r.elementType === elementType &&
            r.stylers.some((s) => s.visibility === "off"),
        );
      expect(off("poi")).toBe(true);
      expect(off("transit")).toBe(true);
      expect(off(undefined, "labels.icon")).toBe(true);
      const poi = style.findIndex((r) => r.featureType === "poi");
      const park = style.findIndex((r) => r.featureType === "poi.park");
      // Later rules win: the park rule must come after the blanket "poi off".
      expect(park).toBeGreaterThan(poi);
      expect(style[park].stylers.some((s) => s.visibility === "on")).toBe(true);
    });

    it(`${appearance}: no saturated colour anywhere on the base map`, () => {
      for (const rule of style) {
        for (const s of rule.stylers) {
          if (typeof s.color !== "string") continue;
          const [r, g, b] = [1, 3, 5].map((i) => parseInt((s.color as string).slice(i, i + 2), 16));
          expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThanOrEqual(24);
        }
      }
    });
  }

  it("light and dark are different maps with matching rules", () => {
    const light = sparkMapStyle("light");
    const dark = sparkMapStyle("dark");
    expect(light).toHaveLength(dark.length);
    expect(light.map((r) => `${r.featureType}|${r.elementType}`)).toEqual(
      dark.map((r) => `${r.featureType}|${r.elementType}`),
    );
    expect(sparkMapBackground("light")).not.toBe(sparkMapBackground("dark"));
  });
});

describe("marker icons", () => {
  it("draws each coverage class differently in shape, not only colour", () => {
    const never = coveragePinSvg("never_visited");
    const sampled = coveragePinSvg("sampled");
    const repeat = coveragePinSvg("repeat");
    expect(new Set([never, sampled, repeat]).size).toBe(3);
    // Never visited is hollow; repeat carries a second ring.
    expect(never).toContain('fill="#ffffff"');
    expect(sampled.match(/<circle/g)).toHaveLength(2);
    expect(repeat.match(/<circle/g)).toHaveLength(3);
    expect(new Set(Object.values(COVERAGE_MARK).map((m) => m.color)).size).toBe(3);
  });

  it("sizes an icon to what it was asked for", () => {
    expect(coveragePinSvg("sampled", 32)).toContain('width="32" height="32"');
    expect(phoneDotSvg(14)).toContain('width="14" height="14"');
    expect(clusterSvg(38)).toContain('width="38" height="38"');
  });

  it("steps a group's size up with its count", () => {
    expect([2, 9, 10, 99, 100, 2500].map(clusterSize)).toEqual([32, 32, 38, 38, 44, 44]);
  });

  it("makes a data URL a marker can load", () => {
    const url = svgDataUrl(coveragePinSvg("repeat"));
    expect(url.startsWith("data:image/svg+xml;charset=UTF-8,")).toBe(true);
    expect(url).not.toContain("<");
    expect(url).not.toContain("#");
    expect(decodeURIComponent(url.split(",")[1])).toBe(coveragePinSvg("repeat"));
  });
});

describe("mapFit", () => {
  it("fits bounds for spread pins and a fixed zoom for one place", () => {
    expect(fitTarget([])).toEqual({ kind: "none" });
    expect(fitTarget([{ lat: 33.3, lng: -111.9 }]).kind).toBe("single");
    expect(
      fitTarget([
        { lat: 33.3, lng: -111.9 },
        { lat: 32.2, lng: -110.9 },
      ]),
    ).toEqual({ kind: "bounds", north: 33.3, south: 32.2, east: -110.9, west: -111.9 });
  });

  it("links to directions for a point", () => {
    expect(directionsUrl({ lat: 33.3, lng: -111.9 })).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=33.3,-111.9",
    );
  });
});
