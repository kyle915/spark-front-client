import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../../..");

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

describe("client home stays slim", () => {
  const dash = read(
    "src/components/pages/client-dashboard/SparkClientDashboard.tsx",
  );
  const insights = read("src/components/pages/insights/SparkInsights.tsx");

  it("renames the home title and keeps week-ahead plus narration outside Performance", () => {
    expect(dash).not.toContain('title="Today"');
    expect(dash).toContain('title="Home"');
    expect(dash).toContain("<WeekAheadPanel");
    expect(dash).toContain("<WeeklyNarrationCard");
    expect(dash).toContain("<ClientApprovalsBody");
    expect(dash).not.toContain("tenantWeeklyNarration");
  });

  it("mounts the insights stack only after Performance is opened", () => {
    expect(dash).toContain("performanceOpen ?");
    expect(dash).toContain("<InsightsBody embedded omitNarration />");
    expect(insights).toContain("omitNarration");
    expect(insights).toContain("<WeeklyNarrationCard");
    expect(insights).toContain("<PaceToGoalHero");
  });
});
