import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { resolveRecapQuickPeekKey } from "@/recap/recapQuickPeek";
import {
  resolveCommandCopyUrl,
  splitHighlightSegments,
} from "@/layout/commandHighlight";
import {
  isPresentModeActive,
  resolvePresentModeKey,
  setPresentMode,
  togglePresentMode,
} from "@/shared/presentMode";
import { PresentModeControl } from "@/shared/PresentModeControl";
import { SparkEmptyState } from "@/shared/SparkEmptyState";
import SparkPromptOverlay from "@/shared/SparkPromptOverlay";
import ThemeToggle from "@/shared/ThemeToggle";

const here = dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = join(here, "..");

function collectSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "__generated__" || entry === "node_modules") continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...collectSourceFiles(full));
    } else if (
      (entry.endsWith(".ts") || entry.endsWith(".tsx")) &&
      !entry.includes(".test.")
    ) {
      out.push(full);
    }
  }
  return out;
}

describe("Wave 3 UI/UX & Craft Upgrades", () => {
  it("exports Wave 3 components cleanly", () => {
    expect(typeof SparkPromptOverlay).toBe("function");
    expect(typeof PresentModeControl).toBe("function");
    expect(typeof SparkEmptyState).toBe("function");
    expect(typeof ThemeToggle).toBe("function");
  });

  it("eliminates every native window.alert / window.confirm / window.prompt call across src/", () => {
    const files = collectSourceFiles(SRC_ROOT);
    const offenders: string[] = [];
    const pattern = /\bwindow\.(alert|confirm|prompt)\s*\(/;
    for (const file of files) {
      const content = readFileSync(file, "utf8");
      if (pattern.test(content)) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("supports Shift+A approve_and_next and ArrowLeft/ArrowRight photo stepping in RecapQuickPeek", () => {
    expect(
      resolveRecapQuickPeekKey({
        key: "a",
        shiftKey: false,
        canApprove: true,
        canShare: true,
      }),
    ).toBe("approve");

    expect(
      resolveRecapQuickPeekKey({
        key: "A",
        shiftKey: true,
        canApprove: true,
        canShare: true,
      }),
    ).toBe("approve_and_next");

    expect(
      resolveRecapQuickPeekKey({
        key: "A",
        shiftKey: true,
        canApprove: false,
        canShare: true,
      }),
    ).toBeNull();

    expect(
      resolveRecapQuickPeekKey({
        key: "ArrowRight",
        canApprove: false,
        canShare: false,
        hasMultiplePhotos: true,
      }),
    ).toBe("photo_next");

    expect(
      resolveRecapQuickPeekKey({
        key: "ArrowLeft",
        canApprove: false,
        canShare: false,
        hasMultiplePhotos: false,
      }),
    ).toBeNull();
  });

  it("splits Command Palette substring highlights case-insensitively and resolves copyable URLs", () => {
    expect(splitHighlightSegments("Whole Foods Austin", "foods")).toEqual([
      { text: "Whole ", match: false },
      { text: "Foods", match: true },
      { text: " Austin", match: false },
    ]);

    expect(splitHighlightSegments("Master Tracker", "")).toEqual([
      { text: "Master Tracker", match: false },
    ]);

    expect(
      resolveCommandCopyUrl(
        { to: "/recaps/list?status=needs_review" },
        "https://client.igniteproductions.co/",
      ),
    ).toBe("https://client.igniteproductions.co/recaps/list?status=needs_review");

    expect(
      resolveCommandCopyUrl(
        {
          to: "",
          hint: "Action · https://checkin.igniteproductions.co/c/ld24",
        },
        "https://client.igniteproductions.co",
      ),
    ).toBe("https://checkin.igniteproductions.co/c/ld24");
  });

  it("toggles html[data-spark-present='true'] and resolves ⌘⇧P / Esc present-mode shortcuts", () => {
    if (typeof document === "undefined") return;
    setPresentMode(false);
    expect(isPresentModeActive()).toBe(false);
    expect(togglePresentMode()).toBe(true);
    expect(document.documentElement.getAttribute("data-spark-present")).toBe(
      "true",
    );
    expect(
      resolvePresentModeKey({
        key: "P",
        metaKey: true,
        shiftKey: true,
        isPresent: true,
      }),
    ).toBe("toggle");
    expect(
      resolvePresentModeKey({
        key: "Escape",
        isPresent: true,
        isTypingTarget: false,
      }),
    ).toBe("exit");
    setPresentMode(false);
    expect(isPresentModeActive()).toBe(false);
  });

  it("renders PresentModeControl, SparkEmptyState presets, and Lucide ThemeToggle cleanly", () => {
    const emptyHtml = renderToStaticMarkup(
      <SparkEmptyState
        title="No regional alert rules yet"
        presets={[
          {
            label: "OOS + Missing Tag Watch",
            description: "Alert on out-of-stock",
            onClick: () => {},
          },
        ]}
      />,
    );
    expect(emptyHtml).toContain("OOS + Missing Tag Watch");
    expect(emptyHtml).toContain("+ Start");

    const themeHtml = renderToStaticMarkup(
      <ThemeToggle value="dark" onChange={() => {}} />,
    );
    expect(themeHtml).toContain('role="switch"');

    if (typeof document !== "undefined") {
      const host = document.createElement("div");
      document.body.appendChild(host);
      const onPick = vi.fn();
      const root = createRoot(host);
      act(() => {
        root.render(
          <div>
            <PresentModeControl />
            <SparkEmptyState
              title="Empty"
              presets={[{ label: "Starter Preset", onClick: onPick }]}
            />
          </div>,
        );
      });
      const buttons = Array.from(host.querySelectorAll("button"));
      const presentBtn = buttons.find((b) => b.textContent?.includes("Present"));
      const presetBtn = buttons.find((b) =>
        b.textContent?.includes("Starter Preset"),
      );
      expect(presentBtn).toBeTruthy();
      expect(presetBtn).toBeTruthy();
      act(() => {
        presentBtn?.click();
        presetBtn?.click();
      });
      expect(isPresentModeActive()).toBe(true);
      expect(onPick).toHaveBeenCalledTimes(1);
      act(() => {
        root.unmount();
      });
      expect(isPresentModeActive()).toBe(false);
      host.remove();
    }
  });

  it("wires public buyer sticky bars, quick-peek filmstrip, gliding nav chrome, and starter presets", () => {
    const publicRecapSrc = readFileSync(
      join(SRC_ROOT, "public/recaps/PublicRecap.tsx"),
      "utf8",
    );
    expect(publicRecapSrc).toContain("Recap summary bar");
    expect(publicRecapSrc).toContain("Filter photos by category");
    expect(publicRecapSrc).toContain("CopyMorphButton");
    expect(publicRecapSrc).toContain("DownloadRingButton");

    const publicReportSrc = readFileSync(
      join(SRC_ROOT, "public/reports/PublicCampaignReport.tsx"),
      "utf8",
    );
    expect(publicReportSrc).toContain("Campaign report summary bar");
    expect(publicReportSrc).toContain("CopyMorphButton");

    const quickPeekSrc = readFileSync(
      join(SRC_ROOT, "recap/RecapQuickPeekSheet.tsx"),
      "utf8",
    );
    expect(quickPeekSrc).toContain("Recap photo filmstrip");
    expect(quickPeekSrc).toContain("Approve &amp; next");

    const topbarSrc = readFileSync(
      join(SRC_ROOT, "layout/SparkTopbar.tsx"),
      "utf8",
    );
    expect(topbarSrc).not.toContain("@heroicons");
    expect(topbarSrc).toContain("LeafTabs");

    const clientDashSrc = readFileSync(
      join(
        SRC_ROOT,
        "components/pages/client-dashboard/SparkClientDashboard.tsx",
      ),
      "utf8",
    );
    expect(clientDashSrc).toContain("has-hub-indicator");
    expect(clientDashSrc).toContain("spark-hub-indicator");
  });
});
