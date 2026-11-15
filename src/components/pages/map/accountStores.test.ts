import { describe, expect, it } from "vitest";
import {
  NO_FILTERS,
  buildStores,
  chunk,
  filterStores,
  hasFilters,
  listEntryAddress,
  listSummary,
  marketFromAddress,
  matchesSearch,
  metresBetween,
  noPositionWords,
  normaliseAddress,
  retailerOptions,
  stateOptions,
  storeCounts,
  storesFitKey,
  storesWord,
  toListInput,
  type ListEntry,
  type PinRow,
} from "./accountStores";

const pin = (over: Partial<PinRow> = {}): PinRow => ({
  name: "Total Wine",
  address: "1730 E Warner Rd, Tempe, AZ 85284",
  lat: 33.334,
  lng: -111.912,
  date: "2026-10-03T16:00:00",
  retailerName: "Total Wine",
  locationName: "",
  stateCode: "",
  coverageClass: "never_visited",
  visitCount: 0,
  planned: false,
  storeKey: "s1",
  ...over,
});

const entry = (over: Partial<ListEntry> = {}): ListEntry => ({
  uuid: "u1",
  name: "Albertsons 524",
  address: "12013 Central Ave",
  city: "Chino",
  state: "CA",
  zip: "91710",
  chain: "Albertsons",
  lat: 34.0122,
  lng: -117.6889,
  positionStatus: "ok",
  ...over,
});

const TEMPE = pin();
const PHOENIX = pin({
  address: "1670 W Bethany Home Rd, Phoenix, AZ 85015",
  lat: 33.524,
  lng: -112.094,
  storeKey: "s2",
});
const TUCSON = pin({
  address: "4370 N Oracle Rd, Tucson, AZ 85705",
  lat: 32.288,
  lng: -110.978,
  storeKey: "s3",
});

describe("buildStores: one pin per physical store", () => {
  it("keeps every location of one banner as its own store", () => {
    const stores = buildStores([TEMPE, PHOENIX, TUCSON]);
    expect(stores.map((s) => s.key)).toEqual(["s1", "s2", "s3"]);
    expect(new Set(stores.map((s) => s.name))).toEqual(new Set(["Total Wine"]));
    expect(stores.map((s) => s.market)).toEqual(["Tempe, AZ", "Phoenix, AZ", "Tucson, AZ"]);
  });

  it("folds several requests at one store into one pin", () => {
    const stores = buildStores([
      pin({ date: "2026-11-01T10:00:00", visitCount: 2, coverageClass: "repeat" }),
      pin({ date: "2026-09-01T10:00:00", visitCount: 2, coverageClass: "repeat", planned: true }),
      pin({ date: "2026-07-01T10:00:00", visitCount: 2, coverageClass: "repeat" }),
    ]);
    expect(stores).toHaveLength(1);
    expect(stores[0]).toMatchObject({
      visitCount: 2,
      coverage: "repeat",
      planned: true,
      lastRequestDate: "2026-11-01T10:00:00",
      source: "requests",
    });
  });

  it("gives each store its own coverage, not its banner's", () => {
    const stores = buildStores([
      pin({ visitCount: 3, coverageClass: "repeat" }),
      { ...PHOENIX, visitCount: 1, coverageClass: "sampled" },
      TUCSON,
    ]);
    expect(stores.map((s) => [s.coverage, s.visitCount])).toEqual([
      ["repeat", 3],
      ["sampled", 1],
      ["never_visited", 0],
    ]);
  });

  it("takes the newest row's name and position for the store", () => {
    const stores = buildStores([
      pin({ retailerName: "Total Wine & More", lat: 33.3341, lng: -111.9121 }),
      pin({ retailerName: "Total Wine" }),
    ]);
    expect(stores[0].name).toBe("Total Wine & More");
    expect(stores[0].position).toEqual({ lat: 33.3341, lng: -111.9121 });
  });

  it("drops rows that cannot be drawn", () => {
    const stores = buildStores([
      pin({ lat: 0, lng: 0, storeKey: "a" }),
      pin({ lat: Number.NaN, storeKey: "b" }),
      pin({ lat: 91, storeKey: "c" }),
      TEMPE,
    ]);
    expect(stores.map((s) => s.key)).toEqual(["s1"]);
  });

  it("still separates stores if the server sends no store key", () => {
    const stores = buildStores([
      pin({ storeKey: "" }),
      pin({ storeKey: "", lat: 33.524, lng: -112.094 }),
      pin({ storeKey: "" }),
    ]);
    expect(stores).toHaveLength(2);
  });

  it("prefers the row's own city and state over ones read from the address", () => {
    const [s] = buildStores([pin({ locationName: "Chicago", stateCode: "IL" })]);
    expect(s.market).toBe("Chicago, IL");
    expect(s.state).toBe("IL");
  });
});

describe("buildStores: the uploaded account list", () => {
  it("adds a list store that has no request as a never-visited pin", () => {
    const stores = buildStores([TEMPE], [entry()]);
    expect(stores).toHaveLength(2);
    expect(stores[1]).toMatchObject({
      key: "list:u1",
      name: "Albertsons 524",
      market: "Chino, CA",
      state: "CA",
      address: "12013 Central Ave, Chino, CA 91710",
      coverage: "never_visited",
      source: "list",
      onList: true,
      position: { lat: 34.0122, lng: -117.6889 },
    });
  });

  it("does not draw a second pin for a list store already on the map by address", () => {
    const stores = buildStores(
      [pin({ visitCount: 1, coverageClass: "sampled" })],
      [
        entry({
          name: "Total Wine Tempe",
          address: "1730 E. Warner Rd",
          city: "Tempe",
          state: "az",
          zip: "85284",
          lat: null,
          lng: null,
          positionStatus: "pending",
        }),
      ],
    );
    expect(stores).toHaveLength(1);
    expect(stores[0]).toMatchObject({ onList: true, coverage: "sampled", source: "requests" });
  });

  it("does not draw a second pin for a list store within a few metres of one", () => {
    const stores = buildStores(
      [TEMPE],
      [entry({ address: "Warner & McClintock", city: "", state: "", zip: "", lat: 33.3342, lng: -111.9122 })],
    );
    expect(stores).toHaveLength(1);
    expect(stores[0].onList).toBe(true);
  });

  it("keeps a list store a few blocks away as its own pin", () => {
    const stores = buildStores(
      [TEMPE],
      [entry({ address: "1800 E Warner Rd", city: "Tempe", state: "AZ", zip: "85284", lat: 33.334, lng: -111.905 })],
    );
    expect(stores).toHaveLength(2);
  });

  it("lists a store with no position yet, without a pin, and says why", () => {
    const stores = buildStores(
      [],
      [
        entry({ uuid: "a", name: "Waiting", lat: null, lng: null, positionStatus: "pending" }),
        entry({ uuid: "b", name: "Missing", address: "9 Nowhere Ln", lat: null, lng: null, positionStatus: "not_found" }),
        entry({ uuid: "c", name: "Zero", address: "5 Null Way", lat: 0, lng: 0, positionStatus: "pending" }),
      ],
    );
    expect(stores.map((s) => [s.name, s.position, s.positionStatus])).toEqual([
      ["Missing", null, "not_found"],
      ["Waiting", null, "pending"],
      ["Zero", null, "pending"],
    ]);
    expect(noPositionWords("pending")).toBe("Address not looked up yet");
    expect(noPositionWords("not_found")).toBe("Address not found");
    expect(noPositionWords("no_address")).toBe("No street address");
    expect(noPositionWords(null)).toBe("No map position");
  });

  it("skips list rows with no name and sorts list stores by name", () => {
    const stores = buildStores(
      [],
      [
        entry({ uuid: "z", name: "Zeta Market", address: "1 Z St" }),
        entry({ uuid: "n", name: "  ", address: "2 N St" }),
        entry({ uuid: "a", name: "Alpha Market", address: "3 A St", lat: 35, lng: -110 }),
      ],
    );
    expect(stores.map((s) => s.name)).toEqual(["Alpha Market", "Zeta Market"]);
  });

  it("keeps a full state name out of the two-letter state filter", () => {
    const [s] = buildStores([], [entry({ state: "California" })]);
    expect(s.state).toBe("");
    expect(s.market).toBe("Chino, California");
  });
});

describe("search and filters", () => {
  const stores = buildStores(
    [
      pin({ visitCount: 2, coverageClass: "repeat" }),
      { ...PHOENIX, visitCount: 1, coverageClass: "sampled", planned: true },
      { ...TUCSON, retailerName: "Fry's Food", name: "Fry's Food" },
    ],
    [entry()],
  );

  it("finds a store by name, by city, or by address", () => {
    const names = (q: string) => filterStores(stores, { ...NO_FILTERS, q }).map((s) => s.market);
    expect(names("total wine")).toEqual(["Tempe, AZ", "Phoenix, AZ"]);
    expect(names("tucson")).toEqual(["Tucson, AZ"]);
    expect(names("bethany home")).toEqual(["Phoenix, AZ"]);
    expect(names("91710")).toEqual(["Chino, CA"]);
  });

  it("ignores case, punctuation and extra spaces, and needs every word", () => {
    const hit = (q: string) => filterStores(stores, { ...NO_FILTERS, q }).length;
    expect(hit("  FRYS   food ")).toBe(1);
    expect(hit("fry's")).toBe(1);
    expect(hit("total tempe")).toBe(1);
    expect(hit("total chino")).toBe(0);
    expect(hit("")).toBe(4);
    expect(hit("   ")).toBe(4);
  });

  it("matches part of a word as it is typed", () => {
    expect(matchesSearch(stores[0], "tem")).toBe(true);
    expect(matchesSearch(stores[0], "xyz")).toBe(false);
  });

  it("filters by coverage, planned, state and retailer together with search", () => {
    const only = (f: Partial<typeof NO_FILTERS>) =>
      filterStores(stores, { ...NO_FILTERS, ...f }).map((s) => s.key);
    expect(only({ coverage: "repeat" })).toEqual(["s1"]);
    expect(only({ coverage: "never_visited" })).toEqual(["s3", "list:u1"]);
    expect(only({ coverage: "planned" })).toEqual(["s2"]);
    expect(only({ state: "CA" })).toEqual(["list:u1"]);
    expect(only({ retailer: "Total Wine" })).toEqual(["s1", "s2"]);
    expect(only({ retailer: "Total Wine", q: "phoenix" })).toEqual(["s2"]);
    expect(only({ state: "AZ", coverage: "sampled", q: "tempe" })).toEqual([]);
  });

  it("knows when any filter is on", () => {
    expect(hasFilters(NO_FILTERS)).toBe(false);
    expect(hasFilters({ ...NO_FILTERS, q: "  " })).toBe(false);
    expect(hasFilters({ ...NO_FILTERS, q: "a" })).toBe(true);
    expect(hasFilters({ ...NO_FILTERS, state: "AZ" })).toBe(true);
  });

  it("counts stores by coverage, and how many are pins", () => {
    const withUnplaced = buildStores(
      [pin({ visitCount: 2, coverageClass: "repeat" }), { ...PHOENIX, planned: true }],
      [entry({ lat: null, lng: null, positionStatus: "pending" })],
    );
    expect(storeCounts(withUnplaced)).toEqual({
      all: 3,
      sampled: 0,
      repeat: 1,
      neverVisited: 2,
      planned: 1,
      onMap: 2,
    });
  });

  it("offers states and retailers found in the stores, biggest banner first", () => {
    expect(stateOptions(stores)).toEqual(["AZ", "CA"]);
    expect(retailerOptions(stores)).toEqual([
      { name: "Total Wine", count: 2 },
      { name: "Albertsons 524", count: 1 },
      { name: "Fry's Food", count: 1 },
    ]);
  });

  it("re-fits the camera only when the number of pins in a scope changes", () => {
    const a = storesFitKey("t1|all", stores);
    expect(storesFitKey("t1|all", [...stores])).toBe(a);
    expect(storesFitKey("t1|all", stores.slice(1))).not.toBe(a);
    expect(storesFitKey("t2|all", stores)).not.toBe(a);
  });
});

describe("helpers", () => {
  it("folds addresses the way the server does", () => {
    expect(normaliseAddress("1730 E. Warner Rd.,  Tempe, AZ 85284")).toBe(
      "1730 e warner rd tempe az 85284",
    );
    expect(normaliseAddress("Suite #4")).toBe("suite #4");
    expect(normaliseAddress(null)).toBe("");
  });

  it("reads city and state from a one-line address", () => {
    expect(marketFromAddress("1730 E Warner Rd, Tempe, AZ 85284")).toEqual({
      city: "Tempe",
      state: "AZ",
    });
    expect(marketFromAddress("no zip here")).toEqual({ city: "", state: "" });
  });

  it("builds one address line from the list's columns", () => {
    expect(listEntryAddress(entry())).toBe("12013 Central Ave, Chino, CA 91710");
    expect(listEntryAddress(entry({ city: "", zip: "" }))).toBe("12013 Central Ave, CA");
    expect(listEntryAddress(entry({ address: "", city: "", state: "", zip: "" }))).toBe("");
  });

  it("measures short distances well enough to tell buildings apart", () => {
    const a = { lat: 33.334, lng: -111.912 };
    expect(metresBetween(a, a)).toBe(0);
    expect(metresBetween(a, { lat: 33.3349, lng: -111.912 })).toBeGreaterThan(95);
    expect(metresBetween(a, { lat: 33.3349, lng: -111.912 })).toBeLessThan(105);
  });

  it("summarises the list by whether each row has a position", () => {
    expect(
      listSummary([
        entry({ positionStatus: "ok" }),
        entry({ positionStatus: "provided" }),
        entry({ positionStatus: "pending" }),
        entry({ positionStatus: "not_found" }),
        entry({ positionStatus: "no_address" }),
      ]),
    ).toEqual({ total: 5, placed: 2, pending: 1, unplaceable: 2 });
  });

  it("turns a parsed file row into what the server takes", () => {
    expect(
      toListInput({ name: " Albertsons 524 ", address: " 12013 Central Ave", state: "CA", lat: 34.0122, lng: -117.6889 }),
    ).toEqual({
      name: "Albertsons 524",
      address: "12013 Central Ave",
      city: "",
      state: "CA",
      zip: "",
      chain: "",
      notes: "",
      lat: 34.0122,
      lng: -117.6889,
    });
    // Half a position, or 0,0, is no position.
    expect(toListInput({ name: "A", lat: 34 }).lat).toBeNull();
    expect(toListInput({ name: "A", lat: 0, lng: 0 })).toMatchObject({ lat: null, lng: null });
  });

  it("splits rows into batches", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 2)).toEqual([]);
  });

  it("counts stores in words", () => {
    expect(storesWord(1)).toBe("1 store");
    expect(storesWord(1200)).toBe("1,200 stores");
  });
});
