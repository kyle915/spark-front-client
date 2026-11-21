import { describe, expect, it } from "vitest";

import {
  buildChangeStoreBody,
  currentPlaceLine,
  farWarningCopy,
  fixLabel,
  hereQuestion,
  moveConfirmCopy,
  moveResultCopy,
  showStoreFix,
  storeNameField,
  storeNameMissing,
  type StoreChangeState,
} from "./storeFixRules";

const allowed: StoreChangeState = {
  allowed: true,
  addressOnly: false,
  storeNameRequired: true,
  venue: false,
  maxDistanceKm: 1,
  storeName: "Kroger",
};

const base = {
  state: allowed,
  clockState: "clocked_in",
  hasRecap: false,
  recapOnly: false,
  recapQueued: false,
  leftover: false,
};

describe("showStoreFix", () => {
  it("shows while clocked in or out before the recap", () => {
    expect(showStoreFix(base)).toBe(true);
    expect(showStoreFix({ ...base, clockState: "clocked_out" })).toBe(true);
  });
  it("hides before clock-in, after the recap, while one is queued, and on recap-only links", () => {
    expect(showStoreFix({ ...base, clockState: "not_started" })).toBe(false);
    expect(showStoreFix({ ...base, hasRecap: true })).toBe(false);
    expect(showStoreFix({ ...base, recapQueued: true })).toBe(false);
    expect(showStoreFix({ ...base, recapOnly: true })).toBe(false);
    expect(showStoreFix({ ...base, leftover: true })).toBe(false);
    expect(showStoreFix({ ...base, state: undefined })).toBe(false);
  });
  it("shows the 'message your lead' line on a shared shift, nothing on a market link", () => {
    expect(
      showStoreFix({ ...base, state: { ...allowed, allowed: false, code: "shared_event" } }),
    ).toBe(true);
    expect(
      showStoreFix({ ...base, state: { ...allowed, allowed: false, code: "market_mode" } }),
    ).toBe(false);
  });
});

describe("copy", () => {
  it("says store, venue or location", () => {
    expect(fixLabel(allowed)).toBe("Wrong store? Fix it");
    expect(fixLabel({ venue: true })).toBe("Wrong venue? Fix it");
    expect(fixLabel({ addressOnly: true })).toBe("Wrong location? Fix it");
  });
  it("names the current place", () => {
    expect(currentPlaceLine(allowed, "1 Main St")).toEqual({
      label: "Store",
      value: "Kroger · 1 Main St",
    });
    expect(currentPlaceLine({ ...allowed, addressOnly: true }, "1 Main St")).toEqual({
      label: "Location",
      value: "1 Main St",
    });
  });
  it("asks and confirms in plain words", () => {
    expect(hereQuestion("1 Main St ")).toBe("You're at 1 Main St. Is this where you're working?");
    expect(moveConfirmCopy({ storeName: "HEB", address: "1 Main St" })).toBe(
      "Move this shift to HEB · 1 Main St? Your clock-in time stays.",
    );
    expect(moveConfirmCopy({ storeName: "HEB", address: "1 Main St", addressOnly: true })).toBe(
      "Move this shift to 1 Main St? Your clock-in time stays.",
    );
    expect(farWarningCopy(3)).toContain("about 1.9 miles");
    expect(
      moveResultCopy({
        fromAddress: "a",
        toAddress: "1 Main St",
        fromStore: "",
        toStore: "HEB",
        distanceKm: 0,
        farOverride: false,
        createdStore: false,
      }),
    ).toBe("Moved to HEB · 1 Main St. Your clock-in time didn't change.");
  });
});

describe("store name field", () => {
  it("is required for retail, optional venue for activations, absent on a time clock", () => {
    expect(storeNameField(allowed).required).toBe(true);
    expect(storeNameMissing(allowed, " ")).toBe(true);
    expect(storeNameMissing(allowed, "HEB")).toBe(false);
    const venue = storeNameField({ ...allowed, venue: true, storeNameRequired: false });
    expect(venue.required).toBe(false);
    expect(venue.label).toBe("Venue name (optional)");
    expect(storeNameField({ ...allowed, addressOnly: true }).show).toBe(false);
  });
});

describe("buildChangeStoreBody", () => {
  it("sends GPS, place, source and the override", () => {
    expect(
      buildChangeStoreBody({
        session: "t",
        address: " 1 Main St ",
        storeName: " HEB ",
        gps: { lat: 1, lng: 2, accuracy: 12.6 },
        place: { lat: 1.1, lng: 2.1 },
        state: "Texas",
        source: "gps",
        confirmFar: true,
        requestKey: "k",
      }),
    ).toEqual({
      session: "t",
      address: "1 Main St",
      storeName: "HEB",
      latitude: 1,
      longitude: 2,
      accuracy: 13,
      placeLatitude: 1.1,
      placeLongitude: 2.1,
      state: "Texas",
      addressSource: "gps",
      confirmFar: true,
      requestKey: "k",
    });
  });
  it("drops the store name on a time clock and GPS when location is off", () => {
    const body = buildChangeStoreBody({
      session: "t",
      address: "1 Main St",
      storeName: "HEB",
      addressOnly: true,
      gps: null,
      place: null,
      source: "typed",
      confirmFar: false,
      requestKey: "k",
    });
    expect(body).toEqual({ session: "t", address: "1 Main St", addressSource: "typed", requestKey: "k" });
  });
});
