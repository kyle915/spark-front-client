import { describe, expect, it } from "vitest";
import {
  approvalsDecidedPrefetchVariables,
  approvalsQueuePrefetchVariables,
  clientDashboardRollupVariables,
  programReportsConversionVariables,
  programReportsRollupVariables,
  trackerDefaultPrefetchVariables,
} from "./hotPrefetchVariables";

describe("hotPrefetchVariables (exact Relay cache-key alignment)", () => {
  it("matches SparkApprovals queue & decided query shapes exactly", () => {
    expect(approvalsQueuePrefetchVariables("t-1")).toEqual({
      first: 300,
      filters: { tenantId: "t-1", statusSlugs: ["pending", "queue"] },
    });
    expect(approvalsDecidedPrefetchVariables("t-1")).toEqual({
      first: 300,
      filters: { tenantId: "t-1", statusSlugs: ["approved", "declined"] },
    });
  });

  it("matches MasterTracker default Active + date-desc query shape exactly", () => {
    expect(trackerDefaultPrefetchVariables("t-1")).toEqual({
      first: 50,
      after: null,
      q: null,
      filters: {
        tenantId: "t-1",
        rmmAsigned: null,
        statusSlugs: ["pending", "queue", "approved", "scheduled"],
        dateSort: "desc",
        schedulingStatus: null,
        unstaffed: null,
        stateCode: null,
        activationPlanId: null,
      },
    });
  });

  it("matches SparkClientDashboard 30-day lookahead and SparkReports 90-day ranges", () => {
    const ref = new Date(2026, 10, 27, 14, 30, 0); // Nov 27, 2026 local
    expect(clientDashboardRollupVariables("t-1", ref)).toEqual({
      tenantId: "t-1",
      startDate: "2026-11-27",
      endDate: "2026-12-27",
      dateField: "date",
    });
    expect(programReportsRollupVariables("t-1", ref)).toEqual({
      tenantId: "t-1",
      startDate: "2026-08-29",
      endDate: "2026-11-27",
      dateField: "created_at",
    });
    expect(programReportsConversionVariables("t-1", ref)).toEqual({
      tenantId: "t-1",
      startDate: "2026-08-29",
      endDate: "2026-11-27",
    });
  });
});
