import { describe, expect, it } from "vitest";
import {
  matchPromptProductIds,
  resolveBulkRowTimezone,
} from "./bulkSchedulePrompt";

describe("bulkSchedulePrompt helpers", () => {
  it("resolves state + visit date to DST-aware timezone id", () => {
    const tzs = [
      { id: "tz-cst", code: "CST", name: "Central Standard Time", offset: -6 },
      { id: "tz-cdt", code: "CDT", name: "Central Daylight Time", offset: -5 },
      { id: "tz-pst", code: "PST", name: "Pacific Standard Time", offset: -8 },
    ];
    const june = resolveBulkRowTimezone("TX", "2027-06-05", tzs);
    expect(june.timezoneId).toBe("tz-cdt");
    expect(june.timezoneCode).toBe("CDT");

    const dec = resolveBulkRowTimezone("TX", "2026-12-05", tzs);
    expect(dec.timezoneId).toBe("tz-cst");
    expect(dec.timezoneCode).toBe("CST");
  });

  it("maps matched prompt products to Relay catalog ids by uuid or name", () => {
    const catalog = [
      { id: "P1", uuid: "u-1", name: "Mango Chainsaw" },
      { id: "P2", uuid: "u-2", name: "Severed Lime" },
    ];
    expect(
      matchPromptProductIds(
        [
          { uuid: "u-2", name: "Severed Lime" },
          { uuid: "missing", name: "mango chainsaw" },
        ],
        catalog,
      ),
    ).toEqual(["P2", "P1"]);
  });
});
