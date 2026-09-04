import { describe, expect, it } from "vitest";
import {
  emptyDropOffLocation,
  formatDropOffLocationsSummary,
  isDropOffLocationsField,
  parseDropOffLocations,
  productSamplesFromDropOffs,
  serializeDropOffLocations,
  totalCasesFromDropOffs,
  validateDropOffLocationsValue,
} from "./dropOffLocations";

describe("isDropOffLocationsField", () => {
  it("matches the seeded label", () => {
    expect(isDropOffLocationsField({ name: "Drop-off Locations" })).toBe(true);
    expect(isDropOffLocationsField({ name: "drop off locations" })).toBe(true);
    expect(isDropOffLocationsField({ name: "Location product dropped" })).toBe(
      false,
    );
  });
});

describe("parse / serialize Drop-off Locations", () => {
  it("round-trips a complete location", () => {
    const locs = [
      {
        placeName: "Whole Foods",
        address: "123 Main St",
        lat: 30.2,
        lng: -97.7,
        source: "places" as const,
        skus: [
          { productId: "p1", productName: "Mountain Water", cases: 4 },
          { productId: "p2", productName: "Mango Chainsaw", cases: 2 },
        ],
      },
    ];
    const raw = serializeDropOffLocations(locs);
    expect(parseDropOffLocations(raw)).toEqual(locs);
  });

  it("treats legacy plain text as a single place name", () => {
    const locs = parseDropOffLocations("Corner bodega on 5th");
    expect(locs).toHaveLength(1);
    expect(locs[0]?.placeName).toBe("Corner bodega on 5th");
    expect(locs[0]?.skus).toEqual([]);
  });

  it("drops zero-case SKUs on serialize", () => {
    const raw = serializeDropOffLocations([
      {
        ...emptyDropOffLocation(),
        placeName: "Target",
        address: "1 Target Way",
        skus: [
          { productId: "a", cases: 0 },
          { productId: "b", cases: 3 },
        ],
      },
    ]);
    expect(parseDropOffLocations(raw)[0]?.skus).toEqual([
      { productId: "b", cases: 3 },
    ]);
  });
});

describe("validateDropOffLocationsValue", () => {
  it("requires at least one complete location", () => {
    expect(validateDropOffLocationsValue("")).toMatch(/at least one/i);
    expect(validateDropOffLocationsValue("[]")).toMatch(/at least one/i);
    expect(
      validateDropOffLocationsValue(
        serializeDropOffLocations([
          {
            placeName: "A",
            address: "1 St",
            skus: [{ productId: "p1", cases: 2 }],
          },
        ]),
      ),
    ).toBeNull();
  });

  it("requires place name, pin, and SKU cases", () => {
    expect(
      validateDropOffLocationsValue(
        serializeDropOffLocations([
          { placeName: "", address: "1 St", skus: [{ productId: "p1", cases: 1 }] },
        ]),
      ),
    ).toMatch(/place name/i);
    expect(
      validateDropOffLocationsValue(
        serializeDropOffLocations([
          {
            placeName: "A",
            address: "",
            lat: null,
            lng: null,
            skus: [{ productId: "p1", cases: 1 }],
          },
        ]),
      ),
    ).toMatch(/GPS|address/i);
    expect(
      validateDropOffLocationsValue(
        serializeDropOffLocations([
          { placeName: "A", address: "1 St", skus: [] },
        ]),
      ),
    ).toMatch(/SKU/i);
  });
});

describe("aggregates", () => {
  it("sums cases across locations by productId", () => {
    const locs = parseDropOffLocations(
      serializeDropOffLocations([
        {
          placeName: "A",
          address: "1",
          skus: [
            { productId: "p1", cases: 2 },
            { productId: "p2", cases: 1 },
          ],
        },
        {
          placeName: "B",
          address: "2",
          skus: [{ productId: "p1", cases: 3 }],
        },
      ]),
    );
    expect(productSamplesFromDropOffs(locs)).toEqual([
      { productId: "p1", quantity: 5 },
      { productId: "p2", quantity: 1 },
    ]);
    expect(totalCasesFromDropOffs(locs)).toBe(6);
  });
});

describe("formatDropOffLocationsSummary", () => {
  it("renders readable lines", () => {
    const lines = formatDropOffLocationsSummary(
      serializeDropOffLocations([
        {
          placeName: "Whole Foods",
          address: "123 Main",
          skus: [{ productId: "p1", productName: "Mt Death", cases: 4 }],
        },
      ]),
    );
    expect(lines[0]).toContain("Whole Foods");
    expect(lines[0]).toContain("4 case");
    expect(lines[0]).toContain("Mt Death");
  });
});
