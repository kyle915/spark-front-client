import { describe, expect, it } from "vitest";

import { createdStoreLink, storeChangeNote, storeChangeOverrideNote } from "./walkupStoreChange";

describe("walkup store change", () => {
  const row = {
    storeChangedFrom: "Kroger · 1 Old Rd",
    storeChangedTo: "Corner Market · 2 New St",
    storeChangedAt: "2026-11-21T22:14:00Z",
    storeChangeDistanceKm: 3.2,
    storeChangeFarOverride: true,
    storeChangeCreatedStore: true,
    storeChangeRetailerUuid: "abc",
  };

  it("reads as one line", () => {
    expect(storeChangeNote(row, () => "2:14 PM")).toBe(
      "Store changed by BA from Kroger · 1 Old Rd to Corner Market · 2 New St at 2:14 PM",
    );
    expect(storeChangeNote({})).toBeNull();
  });

  it("flags an override and links a new store", () => {
    expect(storeChangeOverrideNote(row)).toBe(
      "Moved despite a far-from-GPS warning (2.0 mi from their phone)",
    );
    expect(storeChangeOverrideNote({ ...row, storeChangeFarOverride: false })).toBeNull();
    expect(createdStoreLink(row)).toBe("/catalogs/retailers/edit/abc");
    expect(createdStoreLink({ ...row, storeChangeCreatedStore: false })).toBeNull();
  });
});
