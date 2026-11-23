import { afterEach, describe, expect, it, vi } from "vitest";
import {
  FEEDBACK_RECIPIENTS,
  WHATS_NEW,
  feedbackMailto,
  hasUnseenWhatsNew,
  markWhatsNewSeen,
  whatsNewFor,
  whatsNewSeenKey,
} from "./whatsNew";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("feedbackMailto", () => {
  it("addresses both product owners and carries the page", () => {
    const href = feedbackMailto({
      pageTitle: "Staffing Board",
      pageUrl: "https://client.igniteproductions.co/schedule",
      clientName: "Pivot Energy Drink",
    });
    expect(href.startsWith(`mailto:${FEEDBACK_RECIPIENTS.join(",")}?`)).toBe(true);
    const decoded = decodeURIComponent(href);
    expect(decoded).toContain("Spark feedback — Staffing Board");
    expect(decoded).toContain("Link: https://client.igniteproductions.co/schedule");
    expect(decoded).toContain("Client: Pivot Energy Drink");
  });
  it("omits the client line when unknown", () => {
    const decoded = decodeURIComponent(
      feedbackMailto({ pageTitle: "Recaps", pageUrl: "https://x/recaps/list" }),
    );
    expect(decoded).not.toContain("Client:");
  });
});

describe("whatsNewFor", () => {
  it("keeps staff-only notes out of client view", () => {
    expect(whatsNewFor(false)).toEqual(WHATS_NEW);
    const client = whatsNewFor(true);
    expect(client.some((e) => e.staffOnly)).toBe(false);
    expect(client.length).toBe(WHATS_NEW.filter((e) => !e.staffOnly).length);
    expect(WHATS_NEW.find((e) => e.id === "2026-11-20r")?.staffOnly).toBe(true);
  });

  it("has unique non-empty ids and items across all release notes", () => {
    const ids = WHATS_NEW.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const entry of WHATS_NEW) {
      expect(entry.id.trim().length).toBeGreaterThan(0);
      expect(entry.date.trim().length).toBeGreaterThan(0);
      expect(entry.title.trim().length).toBeGreaterThan(0);
      expect(entry.items.length).toBeGreaterThan(0);
    }
  });

  it("routes November 22 workflow updates to matching client and staff audiences", () => {
    const clientIds = new Set(whatsNewFor(true).map((e) => e.id));
    const staffIds = new Set(whatsNewFor(false).map((e) => e.id));

    // Client-facing portal + navigation updates appear in both client and staff feeds
    expect(clientIds.has("2026-11-22w")).toBe(true);
    expect(clientIds.has("2026-11-22j")).toBe(true);
    expect(staffIds.has("2026-11-22w")).toBe(true);
    expect(staffIds.has("2026-11-22j")).toBe(true);

    // Field BA check-in / clock / job-board updates stay staff-scoped
    expect(clientIds.has("2026-11-22r")).toBe(false);
    expect(clientIds.has("2026-11-22c")).toBe(false);
    expect(staffIds.has("2026-11-22r")).toBe(true);
    expect(staffIds.has("2026-11-22c")).toBe(true);
  });

  it("routes November 23 landed ship notes to matching client and staff audiences", () => {
    const clientIds = new Set(whatsNewFor(true).map((e) => e.id));
    const staffIds = new Set(whatsNewFor(false).map((e) => e.id));

    // Landed on main: Photo Wall / pitch decks, POS + digests, Shifts Board
    for (const id of ["2026-11-23p", "2026-11-23r", "2026-11-23c"] as const) {
      expect(clientIds.has(id)).toBe(true);
      expect(staffIds.has(id)).toBe(true);
    }

    // Staff-only: Today's attention hide (#984) + onboarding UTMs → Close
    for (const id of ["2026-11-23a", "2026-11-23u"] as const) {
      expect(clientIds.has(id)).toBe(false);
      expect(staffIds.has(id)).toBe(true);
      expect(WHATS_NEW.find((e) => e.id === id)?.staffOnly).toBe(true);
    }

    // Still deferred: shelf coach, Clean/Needs Eyes, map-this-store
    for (const id of ["2026-11-23s", "2026-11-23e", "2026-11-23m"] as const) {
      expect(clientIds.has(id)).toBe(false);
      expect(staffIds.has(id)).toBe(false);
      expect(WHATS_NEW.some((e) => e.id === id)).toBe(false);
    }

    // Staff see attention first; clients skip staffOnly → Photo Wall
    expect(whatsNewFor(true)[0]?.id).toBe("2026-11-23p");
    expect(whatsNewFor(false)[0]?.id).toBe("2026-11-23a");
  });

  it("tracks unseen state per audience so staff and client tips stay independent", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => {
          store.set(k, v);
        },
      },
    });

    expect(hasUnseenWhatsNew(false)).toBe(true);
    expect(hasUnseenWhatsNew(true)).toBe(true);

    markWhatsNewSeen(true);
    expect(hasUnseenWhatsNew(true)).toBe(false);
    expect(hasUnseenWhatsNew(false)).toBe(true);
    expect(store.get(whatsNewSeenKey(true))).toBe("2026-11-23p");
    expect(store.get(whatsNewSeenKey(false))).toBeUndefined();

    markWhatsNewSeen(false);
    expect(hasUnseenWhatsNew(false)).toBe(false);
    expect(hasUnseenWhatsNew(true)).toBe(false);
    expect(store.get(whatsNewSeenKey(false))).toBe("2026-11-23a");
  });

  it("only honors the legacy shared key when it matches that audience tip", () => {
    const store = new Map<string, string>([["@spark.whatsNew.seen", "2026-11-23p"]]);
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => {
          store.set(k, v);
        },
      },
    });

    expect(hasUnseenWhatsNew(true)).toBe(false);
    // Staff tip is 2026-11-23a — legacy client tip must not clear the staff unread dot
    expect(hasUnseenWhatsNew(false)).toBe(true);
  });
});
