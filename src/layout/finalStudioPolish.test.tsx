import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";

vi.mock("@/store/authStore", () => ({
  useAuthStore: (selector?: (s: { tenantId: string | null }) => unknown) => {
    const state = { tenantId: "42" };
    return typeof selector === "function" ? selector(state) : state;
  },
}));

vi.mock("@/hooks/useSparkRole", () => ({
  default: () => ({
    role: "admin",
    isAdmin: true,
    isClient: false,
    canToggleRole: true,
    setRole: () => {},
  }),
  useSparkRole: () => ({
    role: "admin",
    isAdmin: true,
    isClient: false,
    canToggleRole: true,
    setRole: () => {},
  }),
}));

import { MobileNavProvider } from "./MobileNavContext";
import SparkMobileDock from "./SparkMobileDock";
import { activeMobileDockKey, buildMobileDockItems } from "./mobileDockItems";
import PilotPeriodBar from "@/pilot/PilotPeriodBar";
import { resolvePilotPeriod } from "@/pilot/pilotPeriodFilter";

describe("final 5-part studio & UX finishing touches", () => {
  it("resolves pilot analytics date presets and normalizes inverted custom ranges", () => {
    const ref = new Date(2026, 10, 27); // Nov 27, 2026
    expect(resolvePilotPeriod("all", "", "", ref)).toEqual({
      periodStart: null,
      periodEnd: null,
    });
    expect(resolvePilotPeriod("30d", "", "", ref)).toEqual({
      periodStart: "2026-10-29",
      periodEnd: "2026-11-27",
    });
    expect(resolvePilotPeriod("ytd", "", "", ref)).toEqual({
      periodStart: "2026-01-01",
      periodEnd: "2026-11-27",
    });
    expect(
      resolvePilotPeriod("custom", "2026-11-20", "2026-11-01", ref),
    ).toEqual({
      periodStart: "2026-11-01",
      periodEnd: "2026-11-20",
    });
  });

  it("renders PilotPeriodBar segmented track and custom date inputs", () => {
    const presetHtml = renderToStaticMarkup(
      <PilotPeriodBar
        range="90d"
        onRangeChange={() => {}}
        customStart=""
        onCustomStartChange={() => {}}
        customEnd=""
        onCustomEndChange={() => {}}
      />,
    );
    expect(presetHtml).toContain("pill-group");
    expect(presetHtml).toContain("90 days");
    expect(presetHtml).not.toContain('type="date"');

    const customHtml = renderToStaticMarkup(
      <PilotPeriodBar
        range="custom"
        onRangeChange={() => {}}
        customStart="2026-10-01"
        onCustomStartChange={() => {}}
        customEnd="2026-11-27"
        onCustomEndChange={() => {}}
      />,
    );
    expect(customHtml).toContain('aria-label="Period start date"');
    expect(customHtml).toContain('aria-label="Period end date"');
  });

  it("resolves mobile dock items by role and highlights sibling report routes", () => {
    expect(buildMobileDockItems(false)[0].to).toBe("/");
    expect(buildMobileDockItems(true)[0].to).toBe("/client-dashboard");

    expect(activeMobileDockKey("/")).toBe("home");
    expect(activeMobileDockKey("/client-dashboard")).toBe("home");
    expect(activeMobileDockKey("/upcoming")).toBe("schedule");
    expect(activeMobileDockKey("/recaps/list")).toBe("recaps");
    expect(activeMobileDockKey("/custom-recap/abc")).toBe("recaps");
    expect(activeMobileDockKey("/reports")).toBe("reports");
    expect(activeMobileDockKey("/buyer-report")).toBe("reports");
    expect(activeMobileDockKey("/retailer-pos")).toBe("reports");
    expect(activeMobileDockKey("/roi-pacing")).toBe("reports");
    expect(activeMobileDockKey("/demo-costs")).toBe("reports");
    expect(activeMobileDockKey("/account-map")).toBeNull();
  });

  it("renders SparkMobileDock with all 5 mobile actions and print/desktop hiding", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/buyer-report"]}>
        <MobileNavProvider>
          <SparkMobileDock />
        </MobileNavProvider>
      </MemoryRouter>,
    );
    expect(html).toContain("md:hidden");
    expect(html).toContain("print:hidden");
    expect(html).toContain("Home");
    expect(html).toContain("Schedule");
    expect(html).toContain("Recaps");
    expect(html).toContain("Reports");
    expect(html).toContain("Ask Spark");
    expect(html).toContain('aria-current="page"');
  });

  it("wires StoreSheet, studio widths, PublicPitch co-branding, public form summary rail, and collision-free walkups helpers", () => {
    for (const rel of [
      "../pilot/BuyerReportPage.tsx",
      "../pilot/RetailerPosPage.tsx",
      "../pilot/DemoCostsPage.tsx",
      "../pilot/RoiPacingPage.tsx",
    ]) {
      const src = readFileSync(resolve(__dirname, rel), "utf8");
      expect(src, `${rel} should align to max-w-7xl`).toContain("max-w-7xl");
      expect(src, `${rel} should not shrink body to max-w-6xl`).not.toContain(
        "max-w-6xl",
      );
      expect(src, `${rel} should use store-and-network`).toContain(
        'fetchPolicy: "store-and-network"',
      );
    }

    for (const rel of [
      "../pilot/BuyerReportPage.tsx",
      "../pilot/RetailerPosPage.tsx",
      "../pilot/DemoCostsPage.tsx",
    ]) {
      const src = readFileSync(resolve(__dirname, rel), "utf8");
      expect(src, `${rel} should open StoreSheet`).toContain("openStoreSheet");
      expect(src, `${rel} should mount PilotPeriodBar`).toContain(
        "PilotPeriodBar",
      );
    }

    const pitchSrc = readFileSync(
      resolve(__dirname, "../public/pitch/PublicPitch.tsx"),
      "utf8",
    );
    expect(pitchSrc).toContain("RecapKpiStrip");
    expect(pitchSrc).toContain("brandName={brandDisplayName}");
    expect(pitchSrc).toContain("Save PDF");

    const publicFormSrc = readFileSync(
      resolve(__dirname, "../public/form/SparkPublicExpressForm.tsx"),
      "utf8",
    );
    expect(publicFormSrc).toContain('aria-label="Live activation summary"');
    expect(publicFormSrc).toContain('suggestionTheme="light"');
    expect(publicFormSrc).not.toContain("0 0 18px rgba(242,243,238,0.25)");
    expect(publicFormSrc).not.toContain("rgba(255,255,255");
    expect(publicFormSrc).not.toContain("#0a0d09");
    expect(publicFormSrc).not.toContain("#11140e");

    const formLayoutSrc = readFileSync(
      resolve(__dirname, "../public/form/layout/FormLayout.tsx"),
      "utf8",
    );
    expect(formLayoutSrc).toContain('data-spark-mode="light"');
    expect(formLayoutSrc).not.toContain("invert(1)");
    expect(formLayoutSrc).not.toContain("rgba(255,255,255");

    const storeProfileSrc = readFileSync(
      resolve(__dirname, "../components/pages/store/SparkStoreProfile.tsx"),
      "utf8",
    );
    expect(storeProfileSrc).toContain("dispatchOpenAskSpark");
    expect(storeProfileSrc).toContain("tableRows=");

    expect(
      existsSync(
        resolve(
          __dirname,
          "../components/pages/walkups/standingCheckinHelpers.ts",
        ),
      ),
    ).toBe(true);
    expect(
      existsSync(
        resolve(
          __dirname,
          "../components/pages/walkups/standingCheckinStudio.ts",
        ),
      ),
    ).toBe(false);
  });
});
