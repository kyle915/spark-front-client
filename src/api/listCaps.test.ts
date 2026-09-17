import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));

function src(rel: string) {
  return readFileSync(join(here, rel), "utf8");
}

describe("list fetch caps (no silent truncation)", () => {
  it("tenant switcher asks for 500 tenants (API max)", () => {
    expect(src("./queries/TenantQuery.ts")).toContain("first: 500");
    expect(src("./queries/TenantCheckinCodeQuery.ts")).toContain("first: 500");
  });

  it("account map pin fetch uses the API ceiling of 2000", () => {
    expect(src("../components/pages/map/SparkAccountMap.tsx")).toContain(
      "first: 2000",
    );
  });

  it("sidebar badges do not download the 2000-request list", () => {
    expect(src("../hooks/useSidebarCounts.ts")).not.toContain("first: 2000");
    expect(src("./queries/SidebarCountsQuery.ts")).toContain(
      "sidebarRequestCounts",
    );
  });

  it("recap product pickers request 1000 SKUs", () => {
    expect(src("../recap/RecapCustomView.tsx")).toContain("first: 1000");
    expect(src("../recap/SparkRecapCreate.tsx")).toContain("first: 1000");
  });

  it("Client Today does not pull RequestsQuery first:2000", () => {
    const dash = src(
      "../components/pages/client-dashboard/SparkClientDashboard.tsx",
    );
    expect(dash).not.toContain("first: 2000");
    expect(dash).not.toContain('from "@/api/queries/RequestsQuery"');
    expect(dash).toContain("ClientWeekAheadQuery");
    expect(dash).toContain("requestDateKey");
    expect(dash).toContain("first: 1000");
    expect(dash).toContain("horizonDays");
    const weekAhead = src("./queries/ClientWeekAheadQuery.ts");
    expect(weekAhead).toContain("ClientWeekAheadQuery");
    // Slim ahead list — no fat RequestsQuery fields.
    expect(weekAhead).not.toContain("recapsFiledCount");
    expect(weekAhead).not.toContain("first: 2000");
  });

  it("Master Tracker rows use slim TrackerListQuery", () => {
    const tracker = src("../requests/MasterTracker.tsx");
    expect(tracker).toContain("TrackerListQuery");
    expect(tracker).toContain("TRACKER_PAGE_SIZE = 50");
    // Row page must not keep the fat RequestsQuery import.
    expect(tracker).not.toContain('from "@/api/queries/RequestsQuery"');
    expect(src("./queries/TrackerListQuery.ts")).toContain("TrackerListQuery");
  });

  it("Reports charts do not pull fat RequestsQuery / classic-only RecapsQuery", () => {
    const reports = src("../components/pages/reports/SparkReports.tsx");
    expect(reports).not.toContain('from "@/api/queries/RequestsQuery"');
    expect(reports).not.toContain('from "@/api/queries/RecapsQuery"');
    expect(reports).toContain("ReportsRequestsChartQuery");
    expect(reports).toContain("ReportsEngagementsChartQuery");
    expect(reports).toContain("customRecaps");
    const requestsChart = src("./queries/ReportsRequestsChartQuery.ts");
    expect(requestsChart).toContain("ReportsRequestsChartQuery");
    // Assert the operation selection stays slim (not comment text).
    expect(requestsChart).toMatch(
      /query ReportsRequestsChartQuery[\s\S]*createdAt[\s\S]*requestType/,
    );
    expect(requestsChart).not.toMatch(/\bopenShifts\b/);
    expect(requestsChart).not.toMatch(/\bproducts\b/);
    const engagementsChart = src("./queries/ReportsEngagementsChartQuery.ts");
    expect(engagementsChart).toContain("customRecaps");
    expect(engagementsChart).toContain("consumersSampled");
    expect(engagementsChart).toContain("consumerEngagements");
  });
});
