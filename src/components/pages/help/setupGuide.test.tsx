import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  computeSetupGuideProgress,
  filterSetupGuideTracks,
  SETUP_GUIDE_TRACKS,
  setupGuideStorageKey,
} from "./setupGuideData";

describe("In-app Spark Setup Guide (/setup-guide)", () => {
  it("covers all newly shipped capabilities with actionable routes and snippets", () => {
    const ids = SETUP_GUIDE_TRACKS.map((t) => t.id);
    expect(ids).toEqual([
      "sandbox",
      "shelf-voice",
      "buyer-deck",
      "saved-views",
      "webhooks",
      "ai-connector",
    ]);

    const sandbox = SETUP_GUIDE_TRACKS.find((t) => t.id === "sandbox");
    expect(sandbox?.adminOnly).toBe(true);
    expect(sandbox?.summary).toContain("Meadowlark Botanicals");

    const webhooks = SETUP_GUIDE_TRACKS.find((t) => t.id === "webhooks");
    expect(webhooks?.snippets?.length).toBeGreaterThanOrEqual(2);
    expect(webhooks?.snippets?.[1]?.code).toContain("createHmac");

    const savedViews = SETUP_GUIDE_TRACKS.find((t) => t.id === "saved-views");
    expect(savedViews?.adminOnlyNote?.code).toContain(
      "/internal/cron/send-saved-view-digests",
    );
  });

  it("filters tracks by category and keyword and computes progress cleanly", () => {
    expect(
      filterSetupGuideTracks(SETUP_GUIDE_TRACKS, "integrations", "").map(
        (t) => t.id,
      ),
    ).toEqual(["webhooks", "ai-connector"]);

    expect(
      filterSetupGuideTracks(SETUP_GUIDE_TRACKS, "all", "Zapier").map(
        (t) => t.id,
      ),
    ).toEqual(["webhooks"]);

    expect(
      filterSetupGuideTracks(SETUP_GUIDE_TRACKS, "all", "MSRP").map(
        (t) => t.id,
      ),
    ).toContain("shelf-voice");

    const prog = computeSetupGuideProgress(
      SETUP_GUIDE_TRACKS,
      new Set(["sandbox", "webhooks", "saved-views"]),
    );
    expect(prog).toEqual({ done: 3, total: 6, pct: 50 });
    expect(setupGuideStorageKey(42)).toBe("spark.setupGuide.completed.42");
  });

  it("wires /setup-guide into AppRoutes, routeTitles, sidebar, Help, and feature headers", () => {
    const routes = readFileSync(
      resolve(__dirname, "../../../routes/AppRoutes.tsx"),
      "utf8",
    );
    expect(routes).toContain('path: "/setup-guide"');
    expect(routes).toContain("SparkSetupGuide");

    const titles = readFileSync(
      resolve(__dirname, "../../../layout/routeTitles.ts"),
      "utf8",
    );
    expect(titles).toContain('"/setup-guide"');

    const sidebar = readFileSync(
      resolve(__dirname, "../../../layout/SparkSidebar.tsx"),
      "utf8",
    );
    expect(sidebar).toContain('to: "/setup-guide"');

    const help = readFileSync(resolve(__dirname, "./SparkHelp.tsx"), "utf8");
    expect(help).toContain('to="/setup-guide"');

    const aiConn = readFileSync(
      resolve(__dirname, "../ai-connector/SparkAiConnector.tsx"),
      "utf8",
    );
    expect(aiConn).toContain("/setup-guide#webhooks");

    const shelf = readFileSync(
      resolve(__dirname, "../reports/ShelfVoicePage.tsx"),
      "utf8",
    );
    expect(shelf).toContain("/setup-guide#shelf-voice");
  });
});
