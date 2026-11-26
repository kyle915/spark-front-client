import { describe, expect, it } from "vitest";
import {
  matchWaveTargetStores,
  parseAiWaveParams,
  stripAiWaveSearchParams,
} from "./aiWaveParams";

describe("aiWaveParams", () => {
  it("returns null unless wave=1 and at least one store identifier is present", () => {
    expect(parseAiWaveParams(new URLSearchParams("state=TX"))).toBeNull();
    expect(parseAiWaveParams(new URLSearchParams("wave=1"))).toBeNull();
  });

  it("parses store keys, fallback names, window dates, weekdays, and hours", () => {
    const params = new URLSearchParams(
      "wave=1&waveStores=s101,s103&waveNames=HEB+Mueller|Sprouts+Sunset&waveStart=2026-12-01&waveEnd=2026-12-31&waveDays=5,6,0&waveHours=11:00-15:00&state=TX",
    );
    const parsed = parseAiWaveParams(params);
    expect(parsed).toEqual({
      storeKeys: ["s101", "s103"],
      storeNames: ["HEB Mueller", "Sprouts Sunset"],
      windowStart: "2026-12-01",
      windowEnd: "2026-12-31",
      weekdays: [0, 5, 6],
      startTime: "11:00",
      endTime: "15:00",
    });

    const stripped = stripAiWaveSearchParams(params);
    expect(stripped.get("wave")).toBeNull();
    expect(stripped.get("waveStores")).toBeNull();
    expect(stripped.get("state")).toBe("TX");
  });

  it("matches stores by key first and falls back to case-insensitive store name", () => {
    const roster = [
      { key: "s101", name: "HEB Mueller", address: "1801 E 51st St", state: "TX" },
      { key: "s205", name: "Sprouts Sunset", address: "6920 Manchaca Rd", state: "TX" },
      { key: "s300", name: "Other Store", address: "100 Main St", state: "TX" },
    ];
    const matched = matchWaveTargetStores(
      {
        storeKeys: ["s101", "s999"],
        storeNames: ["HEB Mueller", "sprouts sunset"],
      },
      roster,
    );
    expect(matched.map((s) => s.key)).toEqual(["s101", "s205"]);
  });
});
