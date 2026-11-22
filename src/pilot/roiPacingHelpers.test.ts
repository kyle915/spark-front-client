import { describe, expect, it } from "vitest";
import {
  flattenAttentionRows,
  formatPaceMoney,
  formatPaceRate,
  paceStatusLabel,
  spendBarPct,
  syncedTargetEditorAmount,
} from "./roiPacingHelpers";

describe("roiPacingHelpers", () => {
  it("formats money and rates without inventing values", () => {
    expect(formatPaceMoney("1234.5")).toMatch(/\$1,235|\$1,234/);
    expect(formatPaceMoney(null)).toBe("—");
    expect(formatPaceRate("0.2")).toBe("0.20");
    expect(formatPaceRate(undefined)).toBe("—");
  });

  it("labels pace statuses", () => {
    expect(paceStatusLabel("under_booked")).toBe("Under-booked");
    expect(paceStatusLabel("over_booked")).toBe("Over-booked");
    expect(paceStatusLabel("on_track")).toBe("On track");
    expect(paceStatusLabel("no_target")).toBe("No target set");
  });

  it("caps the spend bar at 125% of target", () => {
    expect(spendBarPct(500, 1000)).toBe(0.5);
    expect(spendBarPct(2000, 1000)).toBe(1.25);
    expect(spendBarPct(100, 0)).toBe(0);
  });

  it("resyncs the target editor to the selected month's server value", () => {
    expect(
      syncedTargetEditorAmount({
        selectedMonth: "2026-12",
        serverMonth: "2026-12-01",
        serverTarget: "8000.00",
      }),
    ).toBe("8000.00");
    expect(
      syncedTargetEditorAmount({
        selectedMonth: "2026-12",
        serverMonth: "2026-11-01",
        serverTarget: "5000.00",
      }),
    ).toBe("");
    expect(
      syncedTargetEditorAmount({
        selectedMonth: "2026-12",
        serverMonth: "2026-12-01",
        serverTarget: null,
      }),
    ).toBe("");
  });

  it("flattens attention buckets into deep-link rows", () => {
    const rows = flattenAttentionRows([
      {
        key: "rebooks",
        label: "Rebook stores",
        items: [
          {
            bucket: "rebooks",
            title: "Rebook · Total Wine 1",
            refId: "a1",
            actionUrl: "/buyer-report",
          },
        ],
      },
      {
        key: "receipt_checks",
        label: "Receipt checks",
        items: [
          {
            bucket: "receipt_checks",
            title: "Missing Proof",
            refId: "f1",
            actionUrl: "/finance-queue",
          },
        ],
      },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      actionUrl: "/buyer-report",
      bucketLabel: "Rebook stores",
    });
    expect(rows[1].actionUrl).toBe("/finance-queue");
  });
});
