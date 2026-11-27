import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { routeContextLabel } from "./routeAskSparkPrompts";

describe("Floating bottom-right Ask Spark pop-up (Client & Admin)", () => {
  it("maps active routes to concise context labels for the pop-up header", () => {
    expect(routeContextLabel("/")).toBe("Dashboard");
    expect(routeContextLabel("/client-dashboard")).toBe("Dashboard");
    expect(routeContextLabel("/shelf-voice")).toBe("Shelf & Voice");
    expect(routeContextLabel("/buyer-report")).toBe("Buyer Report");
    expect(routeContextLabel("/retailer-pos")).toBe("Retailer POS");
    expect(routeContextLabel("/demo-costs")).toBe("Demo Costs");
    expect(routeContextLabel("/account-map")).toBe("Account Map");
    expect(routeContextLabel("/store/123")).toBe("Store Profile");
    expect(routeContextLabel("/recaps/list")).toBe("Recaps");
    expect(routeContextLabel("/ai-connector")).toBe("AI Connector");
    expect(routeContextLabel("/setup-guide")).toBe("Setup Guide");
    expect(routeContextLabel("/unknown-route")).toBe("Spark");
  });

  it("mounts a persistent bottom-right launcher + floating pop-up for both Client and Admin", () => {
    const hostSrc = readFileSync(resolve(__dirname, "./AskSparkHost.tsx"), "utf8");
    expect(hostSrc).toContain("ask-spark-launcher");
    expect(hostSrc).toContain('e.key.toLowerCase() === "j"');
    expect(hostSrc).toContain("fixed right-6");
    expect(hostSrc).toContain("bottom-20"); // lifts cleanly above /chat composer
    expect(hostSrc).toContain("BrandChatPanel");
    expect(hostSrc).toContain("AskAiModal");
    expect(hostSrc).toContain("useStoreSheetStore");
    expect(hostSrc).toContain("data-vaul-drawer");

    const frameSrc = readFileSync(
      resolve(__dirname, "./AskSparkPopoverFrame.tsx"),
      "utf8",
    );
    expect(frameSrc).toContain('transformOrigin: "bottom right"');
    expect(frameSrc).toContain("md:right-6 md:bottom-6");
    expect(frameSrc).toContain('aria-modal="false"');
    expect(frameSrc).toContain("Expand pop-up");

    // Client pop-up has Program Data + client-safe Spark Help tabs, never admin KB links
    const clientSrc = readFileSync(resolve(__dirname, "./BrandChatPanel.tsx"), "utf8");
    expect(clientSrc).toContain("AskSparkPopoverFrame");
    expect(clientSrc).toContain("Program Data");
    expect(clientSrc).toContain("Spark Help");
    expect(clientSrc).toContain("previewAsClient: true");
    expect(clientSrc).not.toContain("/help-knowledge");

    // Admin pop-up uses floating frame + multi-turn data & help threads
    const adminSrc = readFileSync(resolve(__dirname, "./AskAiButton.tsx"), "utf8");
    expect(adminSrc).toContain("AskSparkPopoverFrame");
    expect(adminSrc).toContain("dataTurns");
    expect(adminSrc).toContain("helpTurns");
    expect(adminSrc).toContain("dispatchOpenAskSpark");

    // Redundant inline Ask Spark buttons removed from Dashboard & Client Home headers
    const adminDash = readFileSync(
      resolve(__dirname, "../pages/dashboard-event/DashboardEvent.tsx"),
      "utf8",
    );
    expect(adminDash).not.toContain("ActiveTenantAskAi");

    const clientDash = readFileSync(
      resolve(__dirname, "../pages/client-dashboard/SparkClientDashboard.tsx"),
      "utf8",
    );
    expect(clientDash).not.toContain("ActiveTenantAskAi");
  });
});
