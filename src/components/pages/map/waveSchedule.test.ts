import { describe, expect, it } from "vitest";
import {
  buildWavePreviewRows,
  extractCityState,
  isOvernightShift,
  matchingDatesInWindow,
  partitionWaveOutcome,
  resolveStoreTimezone,
  type WaveTargetStore,
  type WaveTimezoneOption,
} from "./waveSchedule";

const SAMPLE_TIMEZONES: WaveTimezoneOption[] = [
  { id: "tz-est", code: "EST", name: "Eastern Standard Time", offset: -5 },
  { id: "tz-edt", code: "EDT", name: "Eastern Daylight Time", offset: -4 },
  { id: "tz-cst", code: "CST", name: "Central Standard Time", offset: -6 },
  { id: "tz-cdt", code: "CDT", name: "Central Daylight Time", offset: -5 },
  { id: "tz-mst", code: "MST", name: "Mountain Standard Time", offset: -7 },
  { id: "tz-mdt", code: "MDT", name: "Mountain Daylight Time", offset: -6 },
  { id: "tz-pst", code: "PST", name: "Pacific Standard Time", offset: -8 },
  { id: "tz-pdt", code: "PDT", name: "Pacific Daylight Time", offset: -7 },
];

const SAMPLE_STORES: WaveTargetStore[] = [
  {
    key: "s101",
    name: "Whole Foods Venice",
    address: "225 Lincoln Blvd, Venice, CA 90291",
    market: "Venice, CA",
    state: "CA",
    position: { lat: 33.998, lng: -118.468 },
  },
  {
    key: "s102",
    name: "H-E-B South Congress",
    address: "2400 S Congress Ave, Austin, TX 78704",
    market: "Austin, TX",
    state: "TX",
    position: { lat: 30.241, lng: -97.752 },
  },
  {
    key: "s103",
    name: "Sprouts Arcadia",
    address: "4402 E Camelback Rd, Phoenix, AZ 85018",
    market: "Phoenix, AZ",
    state: "AZ",
    position: { lat: 33.509, lng: -111.986 },
  },
  {
    key: "s104",
    name: "Wegmans Brooklyn",
    address: "21 Flushing Ave, Brooklyn, NY 11205",
    market: "Brooklyn, NY",
    state: "NY",
    position: { lat: 40.699, lng: -73.973 },
  },
];

describe("waveSchedule", () => {
  it("enumerates matching weekdays inside a date window", () => {
    // 2026-07-10 is Friday, 2026-07-11 is Saturday, 2026-07-17 is Friday, 2026-07-18 is Saturday
    const dates = matchingDatesInWindow("2026-07-09", "2026-07-19", [5, 6]);
    expect(dates).toEqual([
      "2026-07-10",
      "2026-07-11",
      "2026-07-17",
      "2026-07-18",
    ]);
  });

  it("spreads stores across matching dates in spread mode and multiplies in every mode", () => {
    const spread = buildWavePreviewRows({
      stores: SAMPLE_STORES,
      dateMode: "window",
      singleDate: "2026-07-10",
      windowStart: "2026-07-10",
      windowEnd: "2026-07-11",
      weekdays: [5, 6],
      assignMode: "spread",
      startTime: "12:00",
      endTime: "16:00",
      timezones: SAMPLE_TIMEZONES,
    });
    expect(spread).toHaveLength(4);
    expect(spread.map((r) => [r.storeKey, r.date])).toEqual([
      ["s101", "2026-07-10"],
      ["s102", "2026-07-11"],
      ["s103", "2026-07-10"],
      ["s104", "2026-07-11"],
    ]);

    const every = buildWavePreviewRows({
      stores: SAMPLE_STORES.slice(0, 2),
      dateMode: "window",
      singleDate: "2026-07-10",
      windowStart: "2026-07-10",
      windowEnd: "2026-07-11",
      weekdays: [5, 6],
      assignMode: "every",
      startTime: "12:00",
      endTime: "16:00",
      timezones: SAMPLE_TIMEZONES,
    });
    expect(every).toHaveLength(4);
  });

  it("resolves DST-aware timezones by store state while keeping Arizona on MST year-round", () => {
    // Summer (DST active)
    expect(resolveStoreTimezone(SAMPLE_TIMEZONES, SAMPLE_STORES[0], "2026-07-15")).toEqual({
      timezoneId: "tz-pdt",
      timezoneCode: "PDT",
    });
    expect(resolveStoreTimezone(SAMPLE_TIMEZONES, SAMPLE_STORES[1], "2026-07-15")).toEqual({
      timezoneId: "tz-cdt",
      timezoneCode: "CDT",
    });
    expect(resolveStoreTimezone(SAMPLE_TIMEZONES, SAMPLE_STORES[2], "2026-07-15")).toEqual({
      timezoneId: "tz-mst",
      timezoneCode: "MST",
    });
    expect(resolveStoreTimezone(SAMPLE_TIMEZONES, SAMPLE_STORES[3], "2026-07-15")).toEqual({
      timezoneId: "tz-edt",
      timezoneCode: "EDT",
    });

    // Winter (standard time)
    expect(resolveStoreTimezone(SAMPLE_TIMEZONES, SAMPLE_STORES[0], "2026-12-05")).toEqual({
      timezoneId: "tz-pst",
      timezoneCode: "PST",
    });
    expect(resolveStoreTimezone(SAMPLE_TIMEZONES, SAMPLE_STORES[3], "2026-12-05")).toEqual({
      timezoneId: "tz-est",
      timezoneCode: "EST",
    });
  });

  it("flags missing street addresses and overnight shifts", () => {
    expect(isOvernightShift("22:00", "02:00")).toBe(true);
    expect(isOvernightShift("11:00", "15:00")).toBe(false);

    const rows = buildWavePreviewRows({
      stores: [
        {
          key: "list:no-addr",
          name: "Unplaced Roster Account",
          address: "",
          market: "Denver, CO",
        },
      ],
      dateMode: "single",
      singleDate: "2026-08-01",
      windowStart: "2026-08-01",
      windowEnd: "2026-08-01",
      weekdays: [],
      assignMode: "spread",
      startTime: "22:00",
      endTime: "01:30",
      timezones: SAMPLE_TIMEZONES,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].missingAddress).toBe(true);
    expect(rows[0].overnight).toBe(true);
    expect(extractCityState({ key: "x", name: "Test", address: "", market: "Denver, CO" })).toEqual({
      city: "Denver",
      stateCode: "CO",
    });
  });

  it("uses coordinates for split-timezone states (Pensacola FL, Knoxville TN, El Paso TX, Northern ID)", () => {
    const pensacola: WaveTargetStore = {
      key: "s-fl-west",
      name: "Publix Pensacola",
      address: "2180 W Nine Mile Rd, Pensacola, FL 32534",
      state: "FL",
      position: { lat: 30.5331, lng: -87.3112 },
    };
    const miami: WaveTargetStore = {
      key: "s-fl-east",
      name: "Publix Brickell",
      address: "911 SW 1st Ave, Miami, FL 33130",
      state: "FL",
      position: { lat: 25.7652, lng: -80.1956 },
    };
    const knoxville: WaveTargetStore = {
      key: "s-tn-east",
      name: "Food City Knoxville",
      address: "1950 Western Ave, Knoxville, TN 37921",
      state: "TN",
      position: { lat: 35.9658, lng: -83.9496 },
    };
    const elPaso: WaveTargetStore = {
      key: "s-tx-west",
      name: "Albertsons El Paso",
      address: "3100 N Mesa St, El Paso, TX 79902",
      state: "TX",
      position: { lat: 31.7802, lng: -106.5034 },
    };
    const coeurDAlene: WaveTargetStore = {
      key: "s-id-north",
      name: "Super 1 Coeur d'Alene",
      address: "305 W Kathleen Ave, Coeur d'Alene, ID 83815",
      state: "ID",
      position: { lat: 47.7073, lng: -116.7879 },
    };

    expect(resolveStoreTimezone(SAMPLE_TIMEZONES, pensacola, "2026-07-18")).toEqual({
      timezoneId: "tz-cdt",
      timezoneCode: "CDT",
    });
    expect(resolveStoreTimezone(SAMPLE_TIMEZONES, miami, "2026-07-18")).toEqual({
      timezoneId: "tz-edt",
      timezoneCode: "EDT",
    });
    expect(resolveStoreTimezone(SAMPLE_TIMEZONES, knoxville, "2026-07-18")).toEqual({
      timezoneId: "tz-edt",
      timezoneCode: "EDT",
    });
    expect(resolveStoreTimezone(SAMPLE_TIMEZONES, elPaso, "2026-07-18")).toEqual({
      timezoneId: "tz-mdt",
      timezoneCode: "MDT",
    });
    expect(resolveStoreTimezone(SAMPLE_TIMEZONES, coeurDAlene, "2026-07-18")).toEqual({
      timezoneId: "tz-pdt",
      timezoneCode: "PDT",
    });
  });

  it("retains failed stores and marks completed rows on partial wave creation", () => {
    const activeRows = [
      { rowKey: "s101|2026-07-10", storeKey: "s101" },
      { rowKey: "s102|2026-07-10", storeKey: "s102" },
      { rowKey: "s102|2026-07-11", storeKey: "s102" },
      { rowKey: "s103|2026-07-10", storeKey: "s103" },
    ];

    const partial = partitionWaveOutcome(
      activeRows,
      [
        { rowNumber: 1, success: true, skipped: false },
        { rowNumber: 2, success: true, skipped: false },
        { rowNumber: 3, success: false, skipped: false },
        { rowNumber: 4, success: false, skipped: true },
      ],
      false,
    );
    expect(partial).toEqual({
      retainStoreKeys: ["s102"],
      completedRowKeys: ["s101|2026-07-10", "s102|2026-07-10", "s103|2026-07-10"],
    });

    const rolledBack = partitionWaveOutcome(
      activeRows,
      [{ rowNumber: 1, success: false, skipped: false }],
      true,
    );
    expect(rolledBack).toEqual({
      retainStoreKeys: ["s101", "s102", "s103"],
      completedRowKeys: [],
    });
  });
});
