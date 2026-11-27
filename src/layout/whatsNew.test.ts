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
  it("addresses events@igniteproductions.co and carries the page", () => {
    const href = feedbackMailto({
      pageTitle: "Staffing Board",
      pageUrl: "https://client.igniteproductions.co/schedule",
      clientName: "Pivot Energy Drink",
    });
    expect(FEEDBACK_RECIPIENTS).toEqual(["events@igniteproductions.co"]);
    expect(href.startsWith("mailto:events@igniteproductions.co?")).toBe(true);
    const decoded = decodeURIComponent(href);
    expect(decoded.match(/[\w.+-]+@[\w.-]+\.\w+/g)).toEqual([
      "events@igniteproductions.co",
    ]);
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

    // Program brief plus notes already on main: deck captions, field-fill, email ?t=, KPI strip,
    // Ask AI, Photo Wall / pitch decks, POS + digests, Shifts Board, Famus store sign-off
    for (const id of [
      "2026-11-23ae",
      "2026-11-23b",
      "2026-11-23v",
      "2026-11-23ab",
      "2026-11-23t",
      "2026-11-23k",
      "2026-11-23q",
      "2026-11-23p",
      "2026-11-23r",
      "2026-11-23c",
    ] as const) {
      expect(clientIds.has(id)).toBe(true);
      expect(staffIds.has(id)).toBe(true);
    }

    // Client + staff: upcoming activations excluded from recaps due
    expect(clientIds.has("2026-11-23h")).toBe(true);
    expect(staffIds.has("2026-11-23h")).toBe(true);
    expect(WHATS_NEW.find((e) => e.id === "2026-11-23h")?.staffOnly).toBeFalsy();

    // Staff-only: operating screens, Check-In Studio, Needs Eyes/CSV, Send, walk-up attach,
    // nudge-all-overdue, denser attention, route lock, finance queue,
    // map-this-store, triage, shelf coach, attention, UTMs
    for (const id of [
      "2026-11-24sb",
      "2026-11-23af",
      "2026-11-23x",
      "2026-11-23aa",
      "2026-11-23z",
      "2026-11-23y",
      "2026-11-23o",
      "2026-11-23n",
      "2026-11-23d",
      "2026-11-23g",
      "2026-11-23f",
      "2026-11-23m",
      "2026-11-23e",
      "2026-11-23s",
      "2026-11-23a",
      "2026-11-23u",
      "2026-11-23ad",
    ] as const) {
      expect(clientIds.has(id)).toBe(false);
      expect(staffIds.has(id)).toBe(true);
      expect(WHATS_NEW.find((e) => e.id === id)?.staffOnly).toBe(true);
    }

    // Newest November 23 tips: the queue chrome for staff, the Famus sign-off for clients.
    expect(WHATS_NEW.findIndex((e) => e.id === "2026-11-23af")).toBeLessThan(
      WHATS_NEW.findIndex((e) => e.id === "2026-11-23ae"),
    );
    // Trust-fix batch: the staff half sits above the client half.
    expect(WHATS_NEW.findIndex((e) => e.id === "2026-11-24ta")).toBeLessThan(
      WHATS_NEW.findIndex((e) => e.id === "2026-11-24tb"),
    );
    expect(WHATS_NEW.find((e) => e.id === "2026-11-24ta")?.staffOnly).toBe(true);
    expect(WHATS_NEW.find((e) => e.id === "2026-11-24tb")?.staffOnly).toBeFalsy();
    // Mobile + layout cleanup is a client-visible tip above the trust batch.
    expect(WHATS_NEW.find((e) => e.id === "2026-11-24ui")?.staffOnly).toBeFalsy();
    expect(WHATS_NEW.findIndex((e) => e.id === "2026-11-24ui")).toBeLessThan(
      WHATS_NEW.findIndex((e) => e.id === "2026-11-24ta"),
    );
    // Account map note is client-visible and sits above the UI cleanup note.
    expect(WHATS_NEW.find((e) => e.id === "2026-11-24am")?.staffOnly).toBeFalsy();
    expect(WHATS_NEW.findIndex((e) => e.id === "2026-11-24am")).toBeLessThan(
      WHATS_NEW.findIndex((e) => e.id === "2026-11-24ui"),
    );
    // Staffing Board default is staff-only and sits above the recap answer check note.
    expect(WHATS_NEW.find((e) => e.id === "2026-11-24sb")?.staffOnly).toBe(true);
    expect(whatsNewFor(true).some((e) => e.id === "2026-11-24sb")).toBe(false);
    expect(WHATS_NEW.findIndex((e) => e.id === "2026-11-24sb")).toBeLessThan(
      WHATS_NEW.findIndex((e) => e.id === "2026-11-24rc"),
    );
    // Recap answer check is staff-only and sits above the Account map note.
    expect(WHATS_NEW.find((e) => e.id === "2026-11-24rc")?.staffOnly).toBe(true);
    expect(whatsNewFor(true).some((e) => e.id === "2026-11-24rc")).toBe(false);
    expect(WHATS_NEW.findIndex((e) => e.id === "2026-11-24rc")).toBeLessThan(
      WHATS_NEW.findIndex((e) => e.id === "2026-11-24am"),
    );
    expect(WHATS_NEW.find((e) => e.id === "2026-11-23ae")?.staffOnly).toBeFalsy();
    expect(WHATS_NEW.find((e) => e.id === "2026-11-23ad")?.staffOnly).toBe(true);
  });

  it("routes the KPI explanation notes: client note on top, template check staff-only", () => {
    expect(WHATS_NEW.find((e) => e.id === "2026-11-24b")?.staffOnly).toBeFalsy();
    expect(whatsNewFor(true).some((e) => e.id === "2026-11-24b")).toBe(true);
    expect(WHATS_NEW.findIndex((e) => e.id === "2026-11-24b")).toBeLessThan(
      WHATS_NEW.findIndex((e) => e.id === "2026-11-24a"),
    );
    expect(whatsNewFor(true).some((e) => e.id === "2026-11-24a")).toBe(false);
    expect(WHATS_NEW.find((e) => e.id === "2026-11-24a")?.staffOnly).toBe(true);
  });

  it("routes November 26 scheduling, approvals, and ops notes to matching audiences", () => {
    const clientIds = new Set(whatsNewFor(true).map((e) => e.id));
    const staffIds = new Set(whatsNewFor(false).map((e) => e.id));

    for (const id of [
      "2026-11-26ux",
      "2026-11-26nl",
      "2026-11-26wp",
      "2026-11-26ha",
      "2026-11-26cal",
      "2026-11-26req",
      "2026-11-26up",
      "2026-11-26app",
    ] as const) {
      expect(clientIds.has(id)).toBe(true);
      expect(staffIds.has(id)).toBe(true);
      expect(WHATS_NEW.find((e) => e.id === id)?.staffOnly).toBeFalsy();
    }

    for (const id of [
      "2026-11-26oh",
      "2026-11-26sc",
      "2026-11-26qa",
      "2026-11-26ops",
    ] as const) {
      expect(clientIds.has(id)).toBe(false);
      expect(staffIds.has(id)).toBe(true);
      expect(WHATS_NEW.find((e) => e.id === id)?.staffOnly).toBe(true);
    }
  });

  it("includes November 27 releases at the top for both brand and staff audiences", () => {
    const clientIds = new Set(whatsNewFor(true).map((e) => e.id));
    const staffIds = new Set(whatsNewFor(false).map((e) => e.id));

    for (const id of [
      "2026-11-27sg",
      "2026-11-27sv",
      "2026-11-27sh",
      "2026-11-27qb",
      "2026-11-27pl",
    ] as const) {
      expect(clientIds.has(id)).toBe(true);
      expect(staffIds.has(id)).toBe(true);
      expect(WHATS_NEW.find((e) => e.id === id)?.staffOnly).toBeFalsy();
    }
    expect(WHATS_NEW[0]?.id).toBe("2026-11-27sg");
    // Admin-only Sandbox preview stays hidden from brand clients
    expect(clientIds.has("2026-11-27sb")).toBe(false);
    expect(staffIds.has("2026-11-27sb")).toBe(true);
    expect(WHATS_NEW.find((e) => e.id === "2026-11-27sb")?.staffOnly).toBe(true);
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

    // Tips come from the data so a new release note does not break this test.
    const clientTip = whatsNewFor(true)[0]?.id;
    const staffTip = whatsNewFor(false)[0]?.id;

    markWhatsNewSeen(true);
    expect(hasUnseenWhatsNew(true)).toBe(false);
    expect(hasUnseenWhatsNew(false)).toBe(true);
    expect(store.get(whatsNewSeenKey(true))).toBe(clientTip);
    expect(store.get(whatsNewSeenKey(false))).toBeUndefined();

    markWhatsNewSeen(false);
    expect(hasUnseenWhatsNew(false)).toBe(false);
    expect(hasUnseenWhatsNew(true)).toBe(false);
    expect(store.get(whatsNewSeenKey(false))).toBe(staffTip);
    expect(store.get(whatsNewSeenKey(true))).toBe(clientTip);
  });

  it("only honors the legacy shared key when it matches that audience tip", () => {
    const store = new Map<string, string>([["@spark.whatsNew.seen", "2026-11-23t"]]);
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => {
          store.set(k, v);
        },
      },
    });

    // Newest tips come from the data: staff and client feeds each have their own head.
    // An older shared key matches neither, so it clears neither feed.
    expect(hasUnseenWhatsNew(true)).toBe(true);
    expect(hasUnseenWhatsNew(false)).toBe(true);

    store.set("@spark.whatsNew.seen", "2026-11-23p");
    expect(hasUnseenWhatsNew(true)).toBe(true);
    expect(hasUnseenWhatsNew(false)).toBe(true);
  });
});
