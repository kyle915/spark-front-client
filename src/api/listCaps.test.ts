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

  it("home attention does not download an unfiltered 2000-row tracker page", () => {
    const attention = src(
      "../components/pages/dashboard-event/AttentionEngine.tsx",
    );
    expect(attention).toContain('statusSlugs: ["pending", "queue"]');
    expect(attention).toContain("startDate");
    expect(attention).toContain("endDate");
    expect(attention).not.toContain(
      "filters: tenantId ? { tenantId } : null",
    );
  });

  it("idle prefetch keeps dashboard and tracker warm without the request map chunk", () => {
    const routes = src("../routes/AppRoutes.tsx");
    const warm = routes.slice(routes.indexOf("export function prefetchHotRoutes"));
    expect(warm).toContain("loadDashboardEvents()");
    expect(warm).toContain("loadMasterTracker()");
    expect(warm).not.toContain("loadSparkRequestView()");
  });

  it("account map still caps a page at 2000, labels a short page, and mounts Maps after the first query", () => {
    const map = src("../components/pages/map/SparkAccountMap.tsx");
    const query = src("./queries/AccountMapQuery.ts");
    // 2,000 a page for admins; brand users are served 200 a request, so
    // the map asks for (and steps offsets by) that.
    expect(src("../components/pages/map/accountMapPages.ts")).toContain(
      "ACCOUNT_MAP_PAGE_SIZE = 2000",
    );
    expect(map).toContain("accountMapPageSize(!canToggleRole)");
    expect(map).toContain("offset += pageSize");
    expect(map).toContain("setMapsReady(true)");
    expect(map).toContain("accountMapTruncation");
    expect(map).toContain("Load the rest");
    expect(query).toContain("accountMapPinTotal");
    expect(query).toContain("offset: $offset");
  });

  it("sidebar badges do not download the 2000-request list", () => {
    expect(src("../hooks/useSidebarCounts.ts")).not.toContain("first: 2000");
    expect(src("./queries/SidebarCountsQuery.ts")).toContain(
      "sidebarRequestCounts",
    );
  });

  it("recap product pickers request 1000 SKUs, walked by cursor", () => {
    expect(src("../recap/RecapCustomView.tsx")).toContain("useTenantProducts");
    expect(src("../recap/SparkRecapCreate.tsx")).toContain("useTenantProducts");
    const hook = src("../hooks/useTenantProducts.ts");
    expect(hook).toContain("PRODUCT_PICKER_MAX = 1000");
    expect(hook).toContain("useAllConnectionPages");
  });

  it("Client Today reads server TenantRequestsRollupQuery instead of walking request rows", () => {
    const dash = src(
      "../components/pages/client-dashboard/SparkClientDashboard.tsx",
    );
    expect(dash).not.toContain("first: 2000");
    expect(dash).not.toContain("first: 1000");
    expect(dash).not.toContain('from "@/api/queries/RequestsQuery"');
    expect(dash).toContain("TenantRequestsRollupQuery");
    expect(dash).toContain("requestDateKey");
    expect(dash).toContain("horizonDays");
    const rollup = src("./queries/TenantRequestsRollupQuery.ts");
    expect(rollup).toMatch(
      /tenantRequestsRollup[\s\S]*totalCount[\s\S]*byDay[\s\S]*topRetailers/,
    );
  });

  it("Master Tracker rows use slim TrackerListQuery", () => {
    const tracker = src("../requests/MasterTracker.tsx");
    expect(tracker).toContain("TrackerListQuery");
    expect(tracker).toContain("TRACKER_PAGE_SIZE = 50");
    // Row page must not keep the fat RequestsQuery import.
    expect(tracker).not.toContain('from "@/api/queries/RequestsQuery"');
    expect(src("./queries/TrackerListQuery.ts")).toContain("TrackerListQuery");
  });

  it("Invite BA roster uses cursor Load more instead of silent first:500", () => {
    const invite = src("../requests/InviteBAModal.tsx");
    expect(invite).toContain("AMBASSADOR_ROSTER_PAGE_SIZE");
    expect(invite).toContain("Load more");
    expect(invite).not.toMatch(/first:\s*500/);
    expect(src("../requests/inviteBaRoster.ts")).toContain(
      "AMBASSADOR_ROSTER_PAGE_SIZE = 100",
    );
  });

  it("Inbox + Tracker admin roster + Favorites use cursor pages (not first:500)", () => {
    const inbox = src("../components/pages/inbox/SparkInbox.tsx");
    expect(inbox).toContain("INBOX_PAGE_SIZE");
    expect(inbox).toContain("Load more pending");
    // Comment may mention first:500; the live query must not.
    expect(inbox).toMatch(/first:\s*INBOX_PAGE_SIZE/);
    expect(inbox).not.toMatch(/first:\s*500\s*[,}]/);

    const tracker = src("../requests/MasterTracker.tsx");
    expect(tracker).toContain("RMM_ROSTER_PAGE_SIZE = 100");
    expect(tracker).toContain("no silent first:500");
    expect(tracker).not.toMatch(/first:\s*500\s*[,}]/);

    const favorites = src("../components/pages/favorites/SparkFavorites.tsx");
    expect(favorites).toContain("AMBASSADOR_ROSTER_PAGE_SIZE");
    expect(favorites).toContain("Load more");
    expect(favorites).not.toMatch(/first:\s*500\s*[,}]/);
  });

  it("defers SparkTeam first:500 (admin nav; one brand's users are few)", () => {
    expect(src("../components/pages/team/SparkTeam.tsx")).toMatch(
      /first:\s*500/,
    );
  });

  it("Recent submissions asks for the last 7 days and walks every page", () => {
    const recent = src("../components/pages/recent/SparkRecentSubmissions.tsx");
    expect(recent).toContain("createdWithinHours: 7 * 24");
    expect(recent).toContain("useAllConnectionPages");
  });

  it("brand-reachable request lists over 200 rows walk pages (server clamps brand users to 200)", () => {
    for (const rel of [
      "../components/pages/dashboard-event/AttentionEngine.tsx",
      "../components/pages/upcoming/SparkUpcomingEvents.tsx",
      "../components/pages/approvals/SparkClientApprovals.tsx",
      "../components/pages/alerts/SparkAlerts.tsx",
    ]) {
      expect(src(rel), rel).toContain("useAllConnectionPages");
    }
    for (const rel of ["./queries/HomeAttentionQuery.ts"]) {
      expect(src(rel), rel).toContain("$after: String");
      expect(src(rel), rel).toContain("endCursor");
    }
  });

  it("Reports charts read server rollups instead of walking request/recap connection rows", () => {
    const reports = src("../components/pages/reports/SparkReports.tsx");
    expect(reports).not.toContain('from "@/api/queries/RequestsQuery"');
    expect(reports).not.toContain('from "@/api/queries/RecapsQuery"');
    expect(reports).not.toContain("ReportsRequestsChartQuery");
    expect(reports).toContain("TenantRequestsRollupQuery");
    // Consumer charts read one server rollup, not a page of recap rows: the
    // recap lists return 50 rows a page, which cut those charts short.
    expect(reports).not.toContain("ReportsEngagementsChartQuery");
    expect(reports).toContain("useConsumerBreakdown");
    const rollup = src("./queries/TenantRequestsRollupQuery.ts");
    expect(rollup).toMatch(
      /tenantRequestsRollup[\s\S]*byDay[\s\S]*byRequestType/,
    );
    const breakdown = src("./queries/ConsumerBreakdownQuery.ts");
    expect(breakdown).toMatch(/tenantConsumerBreakdown[\s\S]*byWeek[\s\S]*byStore[\s\S]*byState/);
  });
});
