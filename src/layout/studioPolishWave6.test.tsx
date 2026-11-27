import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import PublicDeadLink from "@/public/PublicDeadLink";
import { PhotoLightbox } from "@/shared/PhotoLightbox";
import {
  filterUpcomingRows,
  rowNeedsAttention,
  UPCOMING_HORIZONS,
} from "@/components/pages/upcoming/upcomingFilters";
import { routeAskSparkPrompts } from "@/components/ai/routeAskSparkPrompts";

describe("6-part visual & workflow upgrades", () => {
  it("filters Upcoming rows by attention status and search query", () => {
    expect(UPCOMING_HORIZONS.map((h) => h.days)).toEqual([7, 14, 30]);
    const rows = [
      { name: "Whole Foods", location: "Austin, TX", statusSlug: "scheduled", hasAddress: true },
      { name: "Sprouts #412", location: "Denver, CO", statusSlug: "pending", hasAddress: true },
      { name: "Total Wine", location: "Miami, FL", statusSlug: "approved", hasAddress: false },
    ];
    expect(rowNeedsAttention(rows[0])).toBe(false);
    expect(rowNeedsAttention(rows[1])).toBe(true);
    expect(rowNeedsAttention(rows[2])).toBe(true);

    expect(filterUpcomingRows(rows, "attention", "")).toHaveLength(2);
    expect(filterUpcomingRows(rows, "all", "denver")).toHaveLength(1);
    expect(filterUpcomingRows(rows, "attention", "miami")[0].name).toBe("Total Wine");
  });

  it("returns tailored Ask Spark starter prompts per route", () => {
    const reports = routeAskSparkPrompts("/reports", true);
    const upcoming = routeAskSparkPrompts("/upcoming", false);
    const recaps = routeAskSparkPrompts("/my-approvals", true);
    const map = routeAskSparkPrompts("/account-map", true);

    expect(reports[0]).toContain("last period");
    expect(upcoming[0]).toContain("upcoming");
    expect(recaps[0]).toContain("recaps");
    expect(map[0]).toContain("wave");
  });

  it("renders PublicDeadLink on light studio paper and PhotoLightbox with headerAction", () => {
    const deadHtml = renderToStaticMarkup(
      <PublicDeadLink
        eyebrow="Invoice"
        title="Link expired"
        message="Ask for a fresh copy."
      />,
    );
    expect(deadHtml).toContain('data-spark-mode="light"');
    expect(deadHtml).not.toContain("Georgia");

    const lightboxHtml = renderToStaticMarkup(
      <PhotoLightbox
        photos={[{ url: "https://example.com/a.jpg", caption: "Endcap display" }]}
        index={0}
        onClose={() => {}}
        onStep={() => {}}
        headerAction={<button type="button">+ Select for deck</button>}
      />,
    );
    expect(lightboxHtml).toContain("+ Select for deck");
    expect(lightboxHtml).toContain("Endcap display");
  });

  it("verifies light invoices, photo gallery lightbox, quick-peek queues, NotificationBell, Login, and ShiftReplay light map", () => {
    const invoiceSrc = readFileSync(
      resolve(__dirname, "../public/billing/PublicInvoice.tsx"),
      "utf8",
    );
    expect(invoiceSrc).toContain("RecapDocument");
    expect(invoiceSrc).not.toContain("#0a0d09");
    expect(invoiceSrc).not.toContain("rgba(255,255,255");

    const gallerySrc = readFileSync(
      resolve(__dirname, "../components/pages/photos/SparkPhotoGallery.tsx"),
      "utf8",
    );
    expect(gallerySrc).toContain("PhotoLightbox");
    expect(gallerySrc).toContain("Select for deck");

    const clientApprovalsSrc = readFileSync(
      resolve(__dirname, "../components/pages/approvals/SparkClientApprovals.tsx"),
      "utf8",
    );
    expect(clientApprovalsSrc).toContain("RecapQuickPeekSheet");
    expect(clientApprovalsSrc).toContain("allowClientApprove");

    const inboxSrc = readFileSync(
      resolve(__dirname, "../components/pages/inbox/SparkInbox.tsx"),
      "utf8",
    );
    expect(inboxSrc).toContain("RequestQuickPeekSheet");

    const bellSrc = readFileSync(
      resolve(__dirname, "./NotificationBell.tsx"),
      "utf8",
    );
    expect(bellSrc).not.toContain("#11140e");
    expect(bellSrc).not.toContain("#0a0d09");

    const loginSrc = readFileSync(resolve(__dirname, "../auth/Login.tsx"), "utf8");
    expect(loginSrc).not.toContain('setAttribute("color-scheme", "dark")');

    const replaySrc = readFileSync(
      resolve(__dirname, "../requests/ShiftReplayPanel.tsx"),
      "utf8",
    );
    expect(replaySrc).toContain("useAppearance");
    expect(replaySrc).toContain("LIGHT_MAP_STYLES");

    for (const rel of [
      "../public/approve/PublicApprove.tsx",
      "../public/receipts/ReceiptUpload.tsx",
      "../public/receipts/CampaignUpload.tsx",
    ]) {
      const src = readFileSync(resolve(__dirname, rel), "utf8");
      expect(src, `${rel} should use warm-stone #f6f6f2 ground`).toContain("#f6f6f2");
      expect(src, `${rel} should drop legacy rounded-3xl`).not.toContain("rounded-3xl");
      expect(src, `${rel} should drop legacy Georgia serif`).not.toContain("Georgia");
      expect(src, `${rel} should drop legacy #faf7f1 cream`).not.toContain("#faf7f1");
    }
  });
});
