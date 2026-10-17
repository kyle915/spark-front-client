import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

/** Query documents the dashboard must be able to render without narration. */
const DASHBOARD_QUERIES = [
  "src/api/queries/DashboardQuery.ts",
  "src/api/queries/EventDashboardQuery.ts",
  "src/api/queries/EventDashboardTimelineQuery.ts",
  "src/api/queries/EventDashboardConsumersQuery.ts",
  "src/api/queries/TenantInsightsQuery.ts",
  "src/api/queries/RecapDashboardQuery.ts",
];

describe("dashboard does not require tenantWeeklyNarration", () => {
  it("keeps the narration field out of dashboard query documents", () => {
    for (const file of DASHBOARD_QUERIES) {
      expect(read(file), file).not.toContain("tenantWeeklyNarration");
    }
    const insights = read("src/components/pages/insights/SparkInsights.tsx");
    expect(insights).toContain("<WeeklyNarrationCard");
    expect(insights).not.toContain("tenantWeeklyNarration");
  });

  it("loads narration from its own query behind a quiet error boundary", () => {
    const query = read("src/api/queries/TenantWeeklyNarrationQuery.ts");
    expect(query).toContain("query TenantWeeklyNarrationQuery");
    expect(query).toContain("tenantWeeklyNarration(tenantId: $tenantId)");

    const card = read("src/components/ai/WeeklyNarrationCard.tsx");
    expect(card).toContain("TenantWeeklyNarrationQuery");
    expect(card).toMatch(
      /<ErrorBoundary fallback=\{null\}>[\s\S]*<WeeklyNarrationBody/,
    );
  });
});
