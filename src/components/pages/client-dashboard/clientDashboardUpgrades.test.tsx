import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  computeSnapshotHorizon,
  SNAPSHOT_HORIZON_OPTIONS,
} from "./clientSnapshotHelpers";
import {
  buildClientProofQuickPeekItem,
  loadLocalPinnedUrls,
  saveLocalPinnedUrls,
} from "./clientProofHelpers";
import {
  buildWeeklySummaryAskPrompt,
  formatWeeklySummaryForShare,
  mergeSummaryArchive,
} from "@/components/ai/weeklySummaryShare";

const here = dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = join(here, "../../..");

describe("Brand Client Dashboard Upgrades", () => {
  it("computes 30d, 90d, and YTD horizons with equal-length prior comparison windows", () => {
    expect(SNAPSHOT_HORIZON_OPTIONS.map((o) => o.key)).toEqual([
      "30d",
      "90d",
      "ytd",
    ]);

    const ref = new Date(2026, 10, 28); // Nov 28, 2026
    const w30 = computeSnapshotHorizon("30d", ref);
    expect(w30.heading).toBe("Last 30 days");
    expect(w30.endDate).toBe("2026-11-28");
    expect(w30.priorLabel).toBe("prior 30d");

    const w90 = computeSnapshotHorizon("90d", ref);
    expect(w90.heading).toBe("Last 90 days");
    expect(w90.priorLabel).toBe("prior 90d");

    const wYtd = computeSnapshotHorizon("ytd", ref);
    expect(wYtd.heading).toBe("Year to date");
    expect(wYtd.startDate).toBe("2026-01-01");
    expect(wYtd.endDate).toBe("2026-11-28");
    expect(wYtd.priorEnd).toBe("2025-12-31");
  });

  it("persists local deck pins and builds RecapQuickPeekItem payloads for ClientFieldProofStrip", () => {
    const mem = new Map<string, string>();
    const storage = {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => {
        mem.set(k, v);
      },
    };

    expect(loadLocalPinnedUrls("42", storage).size).toBe(0);
    saveLocalPinnedUrls(
      "42",
      new Set(["https://img.example/a.jpg", "https://img.example/b.jpg"]),
      storage,
    );
    const loaded = loadLocalPinnedUrls("42", storage);
    expect(loaded.has("https://img.example/a.jpg")).toBe(true);
    expect(loaded.size).toBe(2);

    const peek = buildClientProofQuickPeekItem(
      {
        recapId: "CustomRecapNode:12",
        uuid: "uuid-12",
        url: "https://img.example/a.jpg",
        retailerName: "H-E-B Mueller",
        stateCode: "TX",
        rawDate: "2026-11-21",
        fileCount: 3,
      },
      {
        totalEngagements: 120,
        consumersSampled: 95,
        soldUnits: 34,
        customRecapFilesCount: 4,
        shareToken: "tok_abc",
      },
    );

    expect(peek).toMatchObject({
      kind: "custom",
      uuid: "uuid-12",
      retailerName: "H-E-B Mueller",
      stateCode: "TX",
      engagements: 120,
      consumersSampled: 95,
      productsSold: 34,
      fileCount: 4,
      shareToken: "tok_abc",
    });
  });

  it("formats Slack/email WeeklySummaryCard updates, Ask Spark prompts, and reviewed-only archive lists", () => {
    const share = formatWeeklySummaryForShare({
      brandName: "Liquid Death",
      weekStart: "2026-11-16",
      weekEnd: "2026-11-22",
      text: "Ran 14 events across Texas.\n\nShoppers loved Severed Lime.",
    });
    expect(share).toContain(
      "Weekly Field Update — Liquid Death (Nov 16 to 22, 2026)",
    );
    expect(share).toContain("Ran 14 events across Texas.");
    expect(share).toContain("Shoppers loved Severed Lime.");
    expect(share).toContain("Compiled from approved recaps on Spark");

    const prompt = buildWeeklySummaryAskPrompt({
      weekStart: "2026-11-16",
      weekEnd: "2026-11-22",
    });
    expect(prompt).toContain("Nov 16 to 22, 2026");
    expect(prompt).toContain("2026-11-16 to 2026-11-22");

    const archive = mergeSummaryArchive(
      {
        weekStart: "2026-11-23",
        weekEnd: "2026-11-29",
        text: "Draft week",
        isDraft: true,
      },
      [
        {
          weekStart: "2026-11-09",
          weekEnd: "2026-11-15",
          text: "Older week",
          isDraft: false,
        },
        {
          weekStart: "2026-11-16",
          weekEnd: "2026-11-22",
          text: "Recent week",
          isDraft: false,
        },
      ],
      true,
    );

    // Client archive excludes drafts and sorts newest-first.
    expect(archive.map((a) => a.weekStart)).toEqual([
      "2026-11-16",
      "2026-11-09",
    ]);
  });

  it("wires LeafTabs + Units Sold + Launch card in ClientProgramSnapshot, Lightbox/LikeBurst/QuickPeek in ClientFieldProofStrip, and Copy/Stepper/Ask in WeeklySummaryCard", () => {
    const snapSrc = readFileSync(
      join(
        SRC_ROOT,
        "components/pages/client-dashboard/ClientProgramSnapshot.tsx",
      ),
      "utf8",
    );
    expect(snapSrc).toContain("LeafTabs");
    expect(snapSrc).toContain("TenantConversionKpisQuery");
    expect(snapSrc).toContain("Units sold");
    expect(snapSrc).toContain("Conversion");
    expect(snapSrc).toContain("KpiDeltaBadge");
    expect(snapSrc).toContain("Launch in progress");

    const proofSrc = readFileSync(
      join(
        SRC_ROOT,
        "components/pages/client-dashboard/ClientFieldProofStrip.tsx",
      ),
      "utf8",
    );
    expect(proofSrc).toContain("PhotoLightbox");
    expect(proofSrc).toContain("LikeBurst");
    expect(proofSrc).toContain("RecapQuickPeekSheet");
    expect(proofSrc).toContain("Quick peek");

    const summarySrc = readFileSync(
      join(SRC_ROOT, "components/ai/WeeklySummaryCard.tsx"),
      "utf8",
    );
    expect(summarySrc).toContain("CopyMorphButton");
    expect(summarySrc).toContain("Copy update");
    expect(summarySrc).toContain("Previous week summary");
    expect(summarySrc).toContain("Ask Spark follow-up");
    expect(summarySrc).toContain("dispatchOpenAskSpark");
  });
});
