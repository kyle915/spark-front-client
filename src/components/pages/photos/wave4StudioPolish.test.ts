import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  moveOrderedPhoto,
  selectManyOrderedPhotos,
  summarizeDeckSelection,
  toggleOrderedPhoto,
  type GalleryPhoto,
} from "./photoGallery";
import { buildDeckHtml } from "./photoDeck";
import {
  deriveShiftOpsState,
  formatGhostSlotLabel,
  stepCalendarPeekIndex,
} from "../calendar/calendarGridUtils";
import {
  approvableSelectedUuids,
  filterInboxItems,
  stepInboxFocusIndex,
} from "../inbox/inboxListFilters";
import {
  computeAccountCoverageSummary,
  summarizeWaveIsland,
} from "../map/storeMapPolish";

const readSrc = (relFromSrc: string) =>
  readFileSync(resolve(__dirname, "../../..", relFromSrc), "utf8");

const p1: GalleryPhoto = {
  id: "p1",
  url: "https://cdn.example.com/1.jpg",
  category: "Endcap display",
  recapUuid: "r1",
  store: "Whole Foods #102",
  state: "TX",
  eventDate: "2026-10-04",
  caption: "Eye-level cold box placement",
};

const p2: GalleryPhoto = {
  id: "p2",
  url: "https://cdn.example.com/2.jpg",
  category: "Sampling table",
  recapUuid: "r2",
  store: "Erewhon Venice",
  state: "CA",
  eventDate: "2026-10-18",
};

const p3: GalleryPhoto = {
  id: "p3",
  url: "https://cdn.example.com/3.jpg",
  category: "Shopper engagement",
  recapUuid: "r3",
  store: "Whole Foods #102",
  state: "TX",
  eventDate: "2026-11-02",
};

describe("Wave 4 Studio Polish — Deck, Calendar, Inbox, Store & Map", () => {
  it("curates, reorders, and summarizes Buyer Pitch Deck selections", () => {
    let cur = toggleOrderedPhoto<GalleryPhoto>([], p1);
    cur = toggleOrderedPhoto(cur, p2);
    cur = selectManyOrderedPhotos(cur, [p2, p3], true);
    expect(cur.map((x) => x.id)).toEqual(["p1", "p2", "p3"]);

    cur = moveOrderedPhoto(cur, "p3", -1);
    expect(cur.map((x) => x.id)).toEqual(["p1", "p3", "p2"]);
    cur = moveOrderedPhoto(cur, "p3", -1);
    expect(cur.map((x) => x.id)).toEqual(["p3", "p1", "p2"]);

    const summary = summarizeDeckSelection(cur, 2 as unknown as 4, true);
    expect(summary.photoCount).toBe(3);
    expect(summary.uniqueStores).toBe(2);
    expect(summary.uniqueStates).toBe(2);
    expect(summary.dateWindowLabel).toContain("Oct 4, 2026");
    expect(summary.dateWindowLabel).toContain("Nov 2, 2026");

    const paperHtml = buildDeckHtml({
      title: "Acme Beverage <Lookbook>",
      brandName: "ACME BEVERAGE",
      subtitle: "90 days · National",
      photos: cur,
      perPage: 4,
      theme: "paper",
      includeCover: true,
    });
    expect(paperHtml).toContain("cover-page");
    expect(paperHtml).toContain("#FAF9F5");
    expect(paperHtml).toContain("CURATED PHOTOS");
    expect(paperHtml).toContain("RETAIL DOORS");
    expect(paperHtml).toContain("Acme Beverage &lt;Lookbook&gt;");
    expect(paperHtml).toContain("Eye-level cold box placement");

    const darkHtml = buildDeckHtml({
      title: "Night Mode Deck",
      subtitle: "All time",
      photos: [p1],
      perPage: 1,
      theme: "dark",
      includeCover: false,
    });
    expect(darkHtml).toContain("#0E100C");
    expect(darkHtml).not.toContain('<section class="page cover-page">');
  });

  it("derives Calendar shift operational badges, stepping, and ghost slots safely by role", () => {
    expect(
      deriveShiftOpsState({
        onClock: true,
        isClient: false,
        hasSignal: true,
        ambassadorCount: 1,
        recapsFiledCount: 0,
        isPastDay: false,
      }),
    ).toBe("live");

    // Brand clients never see internal live clock or unstaffed states.
    expect(
      deriveShiftOpsState({
        onClock: true,
        isClient: true,
        hasSignal: true,
        ambassadorCount: 0,
        recapsFiledCount: 0,
        isPastDay: false,
      }),
    ).toBe("scheduled");

    expect(
      deriveShiftOpsState({
        onClock: false,
        isClient: false,
        hasSignal: true,
        ambassadorCount: 0,
        recapsFiledCount: 0,
        isPastDay: false,
      }),
    ).toBe("unstaffed");

    expect(
      deriveShiftOpsState({
        onClock: false,
        isClient: true,
        hasSignal: true,
        ambassadorCount: 0,
        recapsFiledCount: 2,
        isPastDay: true,
      }),
    ).toBe("recap_filed");

    expect(stepCalendarPeekIndex(0, 5, -1)).toBe(4);
    expect(stepCalendarPeekIndex(4, 5, 1)).toBe(0);
    expect(formatGhostSlotLabel(11)).toBe("+ 11 AM – 2 PM");
  });

  it("filters, steps focus, and selects approvable items in Workflow Inbox", () => {
    const sample = [
      { uuid: "u1", kind: "sla" as const },
      { uuid: "u2", kind: "pending" as const },
      { uuid: "u3", kind: "declined" as const },
    ];
    expect(filterInboxItems(sample, "all")).toHaveLength(3);
    expect(filterInboxItems(sample, "sla").map((x) => x.uuid)).toEqual(["u1"]);
    expect(stepInboxFocusIndex(0, 3, 1)).toBe(1);
    expect(stepInboxFocusIndex(0, 3, -1)).toBe(0);
    expect(stepInboxFocusIndex(2, 3, 1)).toBe(2);
    expect(
      approvableSelectedUuids(sample, new Set(["u1", "u2", "u3"])),
    ).toEqual(["u1", "u2"]);
  });

  it("computes Account Map coverage meter and Wave Builder Island summaries", () => {
    const cov = computeAccountCoverageSummary({
      all: 200,
      sampled: 50,
      repeat: 30,
      planned: 20,
      neverVisited: 100,
    });
    expect(cov.visitedCount).toBe(80);
    expect(cov.visitedPct).toBe(40);
    expect(cov.headline).toBe("40% sampled (80 of 200)");

    const wave = summarizeWaveIsland([
      { market: "Austin", state: "TX" },
      { market: "Austin", state: "TX" },
      { market: "Los Angeles", state: "CA" },
      { market: "Denver", state: "CO" },
      { market: "Miami", state: "FL" },
    ]);
    expect(wave.storeCount).toBe(5);
    expect(wave.marketCount).toBe(4);
    expect(wave.topMarkets).toEqual(["Austin", "Denver", "Los Angeles"]);
    expect(wave.overflowMarkets).toBe(1);
    expect(wave.summaryLabel).toBe("5 stores · 4 markets");
  });

  it("wires all four surfaces cleanly without breaking existing studio invariants", () => {
    const gallery = readSrc("components/pages/photos/SparkPhotoGallery.tsx");
    expect(gallery).toContain("PhotoGridSkeleton");
    expect(gallery).toContain("LeafTabs");
    expect(gallery).toContain("PhotoLightbox");
    expect(gallery).toContain("Select for deck");
    expect(gallery).toContain("<LikeBurst");

    const cal = readSrc("components/pages/calendar/SparkCalendar.tsx");
    expect(cal).toContain("EventQuickPeekSheet");
    expect(cal).toContain("LeafTabs");
    expect(cal).toContain("formatGhostSlotLabel");
    expect(cal).not.toContain("borderRadius: 22");

    const inbox = readSrc("components/pages/inbox/SparkInbox.tsx");
    expect(inbox).toContain("RequestQuickPeekSheet");
    expect(inbox).toContain("ActionMorphButton");
    expect(inbox).toContain("spark-done-mark");
    expect(inbox).toContain("Bulk inbox actions");
    expect(inbox).toContain("handleUndoDismiss");

    const store = readSrc("components/pages/store/SparkStoreProfile.tsx");
    expect(store).toContain("Shelf &amp; setup proof");
    expect(store).toContain("PhotoLightbox");
    expect(store).toContain("dispatchOpenAskSpark");

    const map = readSrc("components/pages/map/SparkAccountMap.tsx");
    expect(map).toContain("TideProgress");
    expect(map).toContain("Launch Wave Schedule →");
    expect(map).not.toContain("#c5f546");
  });
});
