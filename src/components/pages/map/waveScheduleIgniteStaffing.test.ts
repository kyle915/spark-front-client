import { describe, expect, it } from "vitest";
import { buildIgniteStaffingRequestFromWave } from "./waveScheduleIgniteStaffing";

describe("buildIgniteStaffingRequestFromWave", () => {
  it("dedupes dates and stores from active preview rows", () => {
    const input = buildIgniteStaffingRequestFromWave({
      tenantId: "tenant-1",
      activationTypeName: "Retail Sampling",
      notes: "  Need extra hands  ",
      activeRows: [
        { storeName: "Store A", date: "2026-11-24" },
        { storeName: "Store B", date: "2026-11-24" },
        { storeName: "Store A", date: "2026-11-25" },
      ],
    });

    expect(input.source).toBe("wave_sheet");
    expect(input.tenantId).toBe("tenant-1");
    expect(input.activationType).toBe("Retail Sampling");
    expect(input.requestedShiftCount).toBe(3);
    expect(input.requestedBaCount).toBe(3);
    expect(input.requestedDates).toEqual(["2026-11-24", "2026-11-25"]);
    expect(input.requestedStores).toEqual(["Store A", "Store B"]);
    expect(input.notes).toBe("Need extra hands");
    expect(input.title).toContain("Retail Sampling");
  });
});