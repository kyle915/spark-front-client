import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  canStartViewTransition,
  hubRootSegment,
  isHubSwitch,
  ROUTE_VIEW_TRANSITION_MS,
} from "@/layout/routeViewTransition";
import {
  buildShiftReceiptMetrics,
  clearShiftReceiptSnapshot,
  computeRecapSamplesCount,
  deriveCheckinSyncPill,
  readShiftReceiptSnapshot,
  writeShiftReceiptSnapshot,
} from "./checkinReceiptAndSync";
import { CheckinSyncPill, ShiftReceiptCard } from "./CheckinReceiptCard";

const readSrc = (relFromSrc: string) =>
  readFileSync(resolve(__dirname, "../../..", relFromSrc), "utf8");

describe("Progressive Route View Transitions (140ms) & Field Check-In Sync + Receipt", () => {
  it("classifies sidebar hub switches and honors prefers-reduced-motion", () => {
    expect(ROUTE_VIEW_TRANSITION_MS).toBe(140);
    expect(hubRootSegment("/")).toBe("home");
    expect(hubRootSegment("/client-dashboard")).toBe("home");
    expect(hubRootSegment("/calendar")).toBe("schedule");
    expect(hubRootSegment("/schedule")).toBe("schedule");
    expect(hubRootSegment("/photos")).toBe("recaps");
    expect(hubRootSegment("/recaps")).toBe("recaps");
    expect(hubRootSegment("/account-map")).toBe("map");

    // Sub-tab inside the same hub stays instant; cross-hub animates.
    expect(isHubSwitch("/schedule", "/calendar")).toBe(false);
    expect(isHubSwitch("/recaps", "/photos")).toBe(false);
    expect(isHubSwitch("/dashboard", "/photos")).toBe(true);
    expect(isHubSwitch("/calendar", "/account-map")).toBe(true);

    const mockDoc = {
      startViewTransition: (cb: () => void) => {
        cb();
        return { finished: Promise.resolve() };
      },
      visibilityState: "visible",
      querySelector: () => null,
    };

    expect(
      canStartViewTransition(mockDoc, {
        matchMedia: () => ({ matches: false }),
      }),
    ).toBe(true);

    // Reduced motion disables View Transitions.
    expect(
      canStartViewTransition(mockDoc, {
        matchMedia: () => ({ matches: true }),
      }),
    ).toBe(false);

    // Open Vaul drawers suppress View Transitions.
    expect(
      canStartViewTransition(
        {
          ...mockDoc,
          querySelector: () => ({}) as Element,
        },
        { matchMedia: () => ({ matches: false }) },
      ),
    ).toBe(false);
  });

  it("derives sticky check-in sync pill states accurately across online, draft, offline, and attention", () => {
    expect(
      deriveCheckinSyncPill({
        identified: false,
        isOnline: true,
        syncingNow: false,
        hasQueuedWork: false,
        hasRejectedWork: false,
        hasLocalDraft: false,
        clockState: "not_started",
        hasRecap: false,
      }).visible,
    ).toBe(false);

    const synced = deriveCheckinSyncPill({
      identified: true,
      isOnline: true,
      syncingNow: false,
      hasQueuedWork: false,
      hasRejectedWork: false,
      hasLocalDraft: false,
      clockState: "clocked_in",
      hasRecap: false,
    });
    expect(synced).toEqual({
      visible: true,
      tone: "synced",
      label: "Saved on phone · Synced",
    });

    const draft = deriveCheckinSyncPill({
      identified: true,
      isOnline: true,
      syncingNow: false,
      hasQueuedWork: false,
      hasRejectedWork: false,
      hasLocalDraft: true,
      clockState: "clocked_in",
      hasRecap: false,
    });
    expect(draft.tone).toBe("draft");
    expect(draft.label).toBe("Saved on phone · Draft ready");

    const offline = deriveCheckinSyncPill({
      identified: true,
      isOnline: false,
      syncingNow: false,
      hasQueuedWork: true,
      hasRejectedWork: false,
      hasLocalDraft: true,
      clockState: "clocked_out",
      hasRecap: false,
    });
    expect(offline.tone).toBe("offline");
    expect(offline.label).toBe("Offline queue — safe to close");

    const pillMarkup = renderToStaticMarkup(<CheckinSyncPill state={offline} />);
    expect(pillMarkup).toContain("Offline queue — safe to close");
  });

  it("persists and renders Shift Receipt summary metrics (Hours, Samples, Photos filed)", () => {
    const bag = new Map<string, string>();
    const memStorage = {
      getItem: (k: string) => bag.get(k) ?? null,
      setItem: (k: string, v: string) => {
        bag.set(k, v);
      },
      removeItem: (k: string) => {
        bag.delete(k);
      },
    };

    expect(
      computeRecapSamplesCount({
        productSamples: [{ quantity: 48 }, { quantity: 32 }],
        totalEngagements: 110,
      }),
    ).toBe(80);
    expect(
      computeRecapSamplesCount({
        productSamples: [],
        totalEngagements: 95,
      }),
    ).toBe(95);

    writeShiftReceiptSnapshot(
      "LD-123",
      "tok_abcdef1234567890",
      {
        samplesCount: 142,
        photosCount: 6,
        filedAt: "2026-11-28T18:00:00Z",
      },
      memStorage,
    );
    const snap = readShiftReceiptSnapshot("LD-123", "tok_abcdef1234567890", memStorage);
    expect(snap).toEqual({
      samplesCount: 142,
      photosCount: 6,
      filedAt: "2026-11-28T18:00:00Z",
    });

    const metrics = buildShiftReceiptMetrics({
      workedHoursValue: 4.5,
      clockInAt: "2026-11-28T14:00:00Z",
      clockOutAt: "2026-11-28T18:30:00Z",
      snapshot: snap,
      isQueuedOffline: false,
    });
    expect(metrics.hoursLabel).toBe("4.5 hrs");
    expect(metrics.samplesLabel).toBe("142");
    expect(metrics.photosLabel).toBe("6");

    const html = renderToStaticMarkup(
      <ShiftReceiptCard
        metrics={metrics}
        dateAndPlace="Sat, Nov 28 · Whole Foods Lamar"
        punchLine="In 9:00 AM · Out 1:30 PM"
      />,
    );
    expect(html).toContain("Shift Receipt");
    expect(html).toContain("4.5 hrs");
    expect(html).toContain("142");
    expect(html).toContain("6");
    expect(html).toContain("Photos filed");

    clearShiftReceiptSnapshot("LD-123", "tok_abcdef1234567890", memStorage);
    expect(readShiftReceiptSnapshot("LD-123", "tok_abcdef1234567890", memStorage)).toBeNull();
  });

  it("wires AppRouter, index.css, and SparkCheckin cleanly", () => {
    const router = readSrc("routes/AppRouter.tsx");
    expect(router).toContain("HubViewTransitionRoutes");
    expect(router).toContain("spark-route-stage");

    const css = readSrc("index.css");
    expect(css).toContain("view-transition-name: spark-route-stage");
    expect(css).toContain("animation-duration: 140ms");

    const checkin = readSrc("components/pages/checkin/SparkCheckin.tsx");
    expect(checkin).toContain("<CheckinSyncPill");
    expect(checkin).toContain("<ShiftReceiptCard");
  });
});
