import { describe, expect, it } from "vitest";
import {
  STORE_PROXIMITY_CONFIRM_MILES,
  decideStoreProximity,
  formatMilesForConfirm,
  haversineMiles,
  proximityConfirmCopy,
  proximityIdentifyFields,
} from "./storeProximity";

const downtown = { lat: 41.8781, lng: -87.6298 };
const halfMileNorth = { lat: 41.8853, lng: -87.6298 };
const twoMilesNorth = { lat: 41.907, lng: -87.6298 };

describe("haversineMiles", () => {
  it("is ~0 for the same point", () => {
    expect(haversineMiles(downtown, downtown)).toBeLessThan(0.001);
  });

  it("measures roughly a half mile and two miles along a meridian", () => {
    expect(haversineMiles(downtown, halfMileNorth)).toBeGreaterThan(0.4);
    expect(haversineMiles(downtown, halfMileNorth)).toBeLessThan(0.6);
    expect(haversineMiles(downtown, twoMilesNorth)).toBeGreaterThan(1.8);
    expect(haversineMiles(downtown, twoMilesNorth)).toBeLessThan(2.3);
  });
});

describe("formatMilesForConfirm", () => {
  it("trims trailing .0 under 10 miles", () => {
    expect(formatMilesForConfirm(1)).toBe("1");
    expect(formatMilesForConfirm(0.8)).toBe("0.8");
    expect(formatMilesForConfirm(12.4)).toBe("12");
  });
});

describe("proximityConfirmCopy", () => {
  it("names the store and rounded miles", () => {
    expect(proximityConfirmCopy({ miles: 2.14, storeLabel: "Shell" })).toBe(
      "You're about 2.1 miles from Shell. Use this store anyway?",
    );
  });
});

describe("decideStoreProximity", () => {
  it("skips when GPS or store coords are missing", () => {
    expect(
      decideStoreProximity({
        gps: null,
        store: downtown,
        storeKey: "a",
        trustedKey: null,
        confirmedKey: null,
      }),
    ).toEqual({ action: "allow", reason: "no_gps" });
    expect(
      decideStoreProximity({
        gps: downtown,
        store: null,
        storeKey: "a",
        trustedKey: null,
        confirmedKey: null,
      }),
    ).toEqual({ action: "allow", reason: "no_store_coords" });
  });

  it("does not nag for the GPS-trusted nearest match", () => {
    expect(
      decideStoreProximity({
        gps: downtown,
        store: twoMilesNorth,
        storeKey: "shell-bluffton",
        trustedKey: "shell-bluffton",
        confirmedKey: null,
      }),
    ).toEqual({ action: "allow", reason: "trusted" });
  });

  it("allows a prior continue-anyway for the same store", () => {
    expect(
      decideStoreProximity({
        gps: downtown,
        store: twoMilesNorth,
        storeKey: "far",
        trustedKey: "near",
        confirmedKey: "far",
      }),
    ).toEqual({ action: "allow", reason: "already_confirmed" });
  });

  it("allows nearby picks under the confirm threshold", () => {
    const decision = decideStoreProximity({
      gps: downtown,
      store: halfMileNorth,
      storeKey: "near",
      trustedKey: "other",
      confirmedKey: null,
    });
    expect(decision).toEqual({ action: "allow", reason: "nearby" });
    expect(STORE_PROXIMITY_CONFIRM_MILES).toBe(0.75);
  });

  it("requires confirm when the pick is farther than the threshold", () => {
    const decision = decideStoreProximity({
      gps: downtown,
      store: twoMilesNorth,
      storeKey: "far",
      trustedKey: "near",
      confirmedKey: null,
    });
    expect(decision.action).toBe("confirm");
    if (decision.action === "confirm") {
      expect(decision.miles).toBeGreaterThan(STORE_PROXIMITY_CONFIRM_MILES);
      expect(decision.softWarn).toBe(true);
    }
  });
});

describe("proximityIdentifyFields", () => {
  it("omits empty miles and rounds when present", () => {
    expect(proximityIdentifyFields({ miles: null, confirmedDespiteDistance: false })).toEqual(
      {},
    );
    expect(
      proximityIdentifyFields({ miles: 2.146, confirmedDespiteDistance: true }),
    ).toEqual({
      storeProximityMiles: 2.15,
      storeProximityConfirmed: true,
    });
  });
});
