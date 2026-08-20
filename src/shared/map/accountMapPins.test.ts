import { describe, expect, it } from "vitest";
import {
  boundsFromPins,
  isPlottableLatLng,
  venuePinKey,
} from "./accountMapPins";

describe("isPlottableLatLng", () => {
  it("accepts Illinois Binny's Photon coords", () => {
    expect(isPlottableLatLng(41.9269187, -87.6764542)).toBe(true);
  });

  it("rejects null island, NaN, and out-of-range", () => {
    expect(isPlottableLatLng(0, 0)).toBe(false);
    expect(isPlottableLatLng(Number.NaN, -90)).toBe(false);
    expect(isPlottableLatLng(91, -90)).toBe(false);
  });
});

describe("venuePinKey", () => {
  it("keeps two banner stores with the same retailer name as separate pins", () => {
    const a = venuePinKey("Binny's", 41.92692, -87.67645);
    const b = venuePinKey("Binny's", 42.03791, -87.67981);
    expect(a).not.toBe(b);
  });

  it("does not collapse distinct stores the way a shared retailer uuid would", () => {
    const retailerUuid = "same-banner-uuid";
    const keys = [
      venuePinKey("Binny's", 41.93, -87.68),
      venuePinKey("Binny's", 42.04, -87.68),
    ];
    expect(new Set(keys).size).toBe(2);
    expect(new Set([retailerUuid, retailerUuid]).size).toBe(1);
  });
});

describe("boundsFromPins", () => {
  it("fits Torch TWM Missouri + Binny's Illinois instead of the whole continent", () => {
    const bounds = boundsFromPins([
      { lat: 38.5983759, lng: -90.484567 },
      { lat: 41.9269187, lng: -87.6764542 },
      { lat: 42.1128458, lng: -87.983456 },
    ]);
    expect(bounds).not.toBeNull();
    if (!bounds) return;
    expect(bounds.south).toBeGreaterThan(37);
    expect(bounds.north).toBeLessThan(44);
    expect(bounds.west).toBeGreaterThan(-92);
    expect(bounds.east).toBeLessThan(-86);
  });

  it("returns null when nothing is plottable", () => {
    expect(boundsFromPins([{ lat: 0, lng: 0 }])).toBeNull();
    expect(boundsFromPins([])).toBeNull();
  });
});
