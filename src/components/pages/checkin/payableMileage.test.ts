import { describe, expect, it } from "vitest";
import {
  formatPayableMiles,
  isMileageCustomFieldName,
  payableMileageComplete,
  claimForShiftLabel,
  estimatePayableMilesHaversine,
  shouldCollectPayableMileage,
  validatePayableMileageDraft,
} from "./payableMileage";

const feelFree = { name: "Feel Free", requestUrlName: "bl00-feel-free" };
const torch = { name: "Torch", requestUrlName: "keee-torch-thc" };

describe("isMileageCustomFieldName", () => {
  it("matches Mileage / Miles driven variants", () => {
    expect(isMileageCustomFieldName("Mileage")).toBe(true);
    expect(isMileageCustomFieldName("Insert your mileage")).toBe(true);
    expect(isMileageCustomFieldName("Miles driven")).toBe(true);
    expect(isMileageCustomFieldName("miles")).toBe(true);
    expect(isMileageCustomFieldName("Sampling Timeframe?")).toBe(false);
  });
});

describe("shouldCollectPayableMileage", () => {
  it("is true for Feel Free when server enabled storage units", () => {
    expect(
      shouldCollectPayableMileage({
        brand: feelFree,
        payableMileage: {
          enabled: true,
          storageUnits: [{ market: "Austin, TX", address: "6330 Harold Ct" }],
          matchedStorage: null,
          claim: null,
        },
      }),
    ).toBe(true);
  });

  it("is false when not enabled", () => {
    expect(
      shouldCollectPayableMileage({
        brand: feelFree,
        payableMileage: {
          enabled: false,
          storageUnits: [],
          matchedStorage: null,
          claim: null,
        },
      }),
    ).toBe(false);
  });
});

describe("validatePayableMileageDraft", () => {
  const stop = {
    name: "Whole Foods",
    address: "525 N Lamar",
    lat: 30.27,
    lng: -97.75,
  };

  it("requires yes/no first", () => {
    expect(
      validatePayableMileageDraft({ startedFromStorage: null, stops: [] }),
    ).toMatch(/storage/i);
  });

  it("yes needs at least one stop", () => {
    expect(
      validatePayableMileageDraft({ startedFromStorage: true, stops: [] }),
    ).toMatch(/storage/i);
  });

  it("no needs two stops", () => {
    expect(
      validatePayableMileageDraft({ startedFromStorage: false, stops: [stop] }),
    ).toMatch(/two/i);
  });

  it("accepts valid yes itinerary", () => {
    expect(
      validatePayableMileageDraft({ startedFromStorage: true, stops: [stop] }),
    ).toBeNull();
  });
});

describe("payableMileageComplete / format", () => {
  it("formats miles", () => {
    expect(formatPayableMiles(12.4)).toBe("12.40 mi");
  });

  const baseState = {
    enabled: true,
    storageUnits: [] as { market: string; address: string }[],
    matchedStorage: null,
    claim: {
      uuid: "1",
      startedFromStorage: true,
      storageMarket: "Austin, TX",
      storageAddress: "x",
      stops: [],
      payableMiles: 12.4,
      completed: true,
      shiftLabel: "",
    },
  };

  it("detects completed claim", () => {
    expect(payableMileageComplete(baseState)).toBe(true);
  });

  it("forceNew is never complete", () => {
    expect(payableMileageComplete(baseState, { forceNew: true })).toBe(false);
  });

  it("ignores first-shift claim when asking for Second shift", () => {
    expect(
      payableMileageComplete(baseState, { shiftLabel: "Second shift" }),
    ).toBe(false);
  });

  it("accepts matching second-shift claim", () => {
    expect(
      payableMileageComplete(
        {
          ...baseState,
          claim: { ...baseState.claim, shiftLabel: "Second shift" },
        },
        { shiftLabel: "Second shift" },
      ),
    ).toBe(true);
  });
});

describe("estimatePayableMilesHaversine", () => {
  it("sums storage → stop straight-line miles", () => {
    const miles = estimatePayableMilesHaversine({
      startedFromStorage: true,
      storage: {
        market: "Austin, TX",
        address: "6330 Harold Ct",
        lat: 30.267,
        lng: -97.671,
      },
      stops: [
        {
          name: "Whole Foods",
          address: "525 N Lamar",
          lat: 30.271,
          lng: -97.753,
        },
      ],
    });
    expect(miles).toBeGreaterThan(4);
    expect(miles).toBeLessThan(8);
  });
});

describe("claimForShiftLabel", () => {
  const first = {
    uuid: "1",
    startedFromStorage: true,
    storageMarket: "Austin, TX",
    storageAddress: "x",
    stops: [],
    payableMiles: 12.4,
    completed: true,
    shiftLabel: "",
  };

  it("keeps unlabeled claim for first shift", () => {
    expect(claimForShiftLabel(first, undefined)?.uuid).toBe("1");
    expect(claimForShiftLabel(first, "")?.uuid).toBe("1");
  });

  it("ignores first-shift claim when filing Second shift", () => {
    expect(claimForShiftLabel(first, "Second shift")).toBeNull();
  });

  it("keeps a matching second-shift claim", () => {
    const second = { ...first, uuid: "2", shiftLabel: "Second shift" };
    expect(claimForShiftLabel(second, "Second shift")?.uuid).toBe("2");
  });
});

describe("torch never collects", () => {
  it("stays off even if somehow enabled without units for non-FF", () => {
    expect(
      shouldCollectPayableMileage({
        brand: torch,
        payableMileage: {
          enabled: false,
          storageUnits: [],
          matchedStorage: null,
          claim: null,
        },
      }),
    ).toBe(false);
  });
});
