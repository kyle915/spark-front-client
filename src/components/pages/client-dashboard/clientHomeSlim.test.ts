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

  it("renames the home title and keeps week-ahead plus the weekly summary outside Performance", () => {
    expect(dash).not.toContain('title="Today"');
    expect(dash).toContain('title="Home"');
    expect(dash).toContain("<WeekAheadPanel");
    // Weekly summary sits beside the program card on desktop (right column),
    // not below photos/recaps on Overview.
    expect(dash).toContain("client-weekly-slot");
    expect(dash).toContain(
      "lg:has-[.client-weekly-slot:not(:empty)]:grid-cols-[minmax(0,1.65fr)_minmax(280px,1fr)]",
    );
    expect(dash).toContain("<WeeklySummaryCard");
    expect(dash).toContain("forClient");
    expect(dash).toContain("lg:sticky");
    expect(dash).not.toContain("WeeklyNarrationCard");
    expect(dash).toContain("<ClientApprovalsBody");
    expect(dash).not.toContain("tenantWeeklySummary");
  });

  it("shows program performance on first paint with no hide control", () => {
    expect(dash).not.toContain("performanceOpen");
    expect(dash).not.toContain('"HIDE"');
    expect(dash).not.toContain('"SHOW"');
    expect(dash).toContain("NEEDS YOU");
    // The Quick links card repeated the sidebar and was removed (Nov 2026).
    expect(dash).not.toContain(">Quick links<");
    expect(dash).toContain("<SparkSheet");
    expect(dash).toContain("<InsightsBody embedded omitNarration />");
    expect(insights).toContain("rangePills");
    expect(insights).toContain("omitNarration");
    expect(insights).toContain("<WeeklySummaryCard");
    expect(insights).not.toContain("WeeklyNarrationCard");
    expect(insights).toContain("<PaceToGoalHero");
  });
});
