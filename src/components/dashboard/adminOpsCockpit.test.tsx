import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  attentionRows,
  startsTodayRows,
  type BoardAssignee,
  type BoardShift,
} from "./todayAttention";
import { formatElapsedSince, formatSyncAge } from "./clockSummaryHelpers";
import {
  buildSevenDayStaffingSummary,
  parseMondayOfDateYmd,
} from "./staffingGlanceHelpers";
import {
  OPS_ANALYTICS_COLLAPSED_KEY,
  OPS_JUMP_SECTIONS,
  readOpsAnalyticsCollapsed,
  writeOpsAnalyticsCollapsed,
} from "../pages/dashboard-event/opsCockpitHelpers";

const here = dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = join(here, "../..");

const makeBa = (over: Partial<BoardAssignee> = {}): BoardAssignee => ({
  ambassadorUuid: "ba-42",
  name: "Maya Lin",
  status: "upcoming",
  clockInAt: null,
  clockOutAt: null,
  pendingApproval: false,
  ...over,
});

const makeShift = (over: Partial<BoardShift> = {}): BoardShift => ({
  eventUuid: "ev-99",
  eventName: "Whole Foods Lamar",
  brandName: "Liquid Death",
  store: "Whole Foods Lamar",
  startTime: "12:00",
  endTime: "16:00",
  assigned: [makeBa()],
  ...over,
});

describe("Admin Ops Dashboard Cockpit & Triage Upgrades", () => {
  it("attaches eventUuid, unbooked, and ambassador metadata to startsTodayRows and attentionRows", () => {
    const starts = startsTodayRows(
      [
        makeShift({ eventUuid: "ev-empty", assigned: [] }),
        makeShift({
          eventUuid: "ev-booked",
          startTime: "14:00",
          assigned: [makeBa({ ambassadorUuid: "ba-7", name: "Jordan K" })],
        }),
      ],
      { showBrand: false },
    );

    expect(starts[0]).toMatchObject({
      eventUuid: "ev-empty",
      unbooked: true,
      primaryAmbassadorUuid: null,
    });
    expect(starts[1]).toMatchObject({
      eventUuid: "ev-booked",
      unbooked: false,
      primaryAmbassadorUuid: "ba-7",
      primaryAmbassadorName: "Jordan K",
    });

    const attn = attentionRows({
      today: [
        makeShift({
          eventUuid: "ev-ns",
          assigned: [makeBa({ ambassadorUuid: "ba-ns", status: "no_show" })],
        }),
        makeShift({ eventUuid: "ev-unbooked", assigned: [] }),
      ],
      yesterday: [
        makeShift({
          eventUuid: "ev-open",
          assigned: [
            makeBa({
              ambassadorUuid: "ba-open",
              clockInAt: "2026-11-27T18:00:00Z",
            }),
          ],
        }),
      ],
      staleRequests: 2,
      unscheduledRequests: 0,
    });

    expect(attn[0]).toMatchObject({
      kind: "open_punch",
      eventUuid: "ev-open",
      ambassadorUuid: "ba-open",
    });
    expect(attn[1]).toMatchObject({
      kind: "no_show",
      eventUuid: "ev-ns",
      ambassadorUuid: "ba-ns",
    });
    expect(attn[2]).toMatchObject({
      kind: "unbooked",
      eventUuid: "ev-unbooked",
    });
    expect(attn[3]).toMatchObject({
      kind: "stale_requests",
    });
  });

  it("formats live elapsed shift durations and background sync ages cleanly", () => {
    const now = new Date("2026-11-28T15:14:30Z").getTime();
    expect(formatElapsedSince("2026-11-28T13:00:00Z", now)).toBe("2h 14m in");
    expect(formatElapsedSince("2026-11-28T14:36:00Z", now)).toBe("38m in");
    expect(formatElapsedSince("2026-11-28T15:14:10Z", now)).toBe("just in");
    expect(formatElapsedSince(null, now)).toBe("");

    expect(formatSyncAge(now - 10_000, now)).toBe("just now");
    expect(formatSyncAge(now - 125_000, now)).toBe("2m ago");
    expect(formatSyncAge(now - 3_700_000, now)).toBe("1h ago");
  });

  it("builds 7-day staffing breakdown with TideProgress fillPct and unstaffed deep links", () => {
    const summary = buildSevenDayStaffingSummary("2026-11-28", [
      { date: "2026-11-28", isStaffed: true },
      { date: "2026-11-28", isStaffed: false },
      { date: "2026-11-29", isStaffed: false },
      { date: "2026-11-29", isStaffed: false },
      { date: "2026-11-30", isStaffed: true },
    ]);

    expect(summary.totalShifts).toBe(5);
    expect(summary.staffedShifts).toBe(2);
    expect(summary.unstaffedShifts).toBe(3);
    expect(summary.fillPct).toBe(40);
    expect(summary.days).toHaveLength(7);

    expect(summary.days[0]).toMatchObject({
      ymd: "2026-11-28",
      label: "Today",
      total: 2,
      unstaffed: 1,
      to: "/schedule?filter=unstaffed&date=2026-11-28",
    });
    expect(summary.days[1]).toMatchObject({
      ymd: "2026-11-29",
      unstaffed: 2,
      to: "/schedule?filter=unstaffed&date=2026-11-29",
    });
    expect(summary.days[2]).toMatchObject({
      ymd: "2026-11-30",
      unstaffed: 0,
      to: "/schedule?date=2026-11-30",
    });

    const mon = parseMondayOfDateYmd("2026-11-28"); // Saturday -> Monday Nov 23
    expect(mon?.getFullYear()).toBe(2026);
    expect(mon?.getMonth()).toBe(10);
    expect(mon?.getDate()).toBe(23);
    expect(parseMondayOfDateYmd("invalid")).toBeNull();
  });

  it("persists Ops-only cockpit analytics collapse state cleanly", () => {
    expect(OPS_JUMP_SECTIONS.map((s) => s.id)).toEqual([
      "ops-triage",
      "live-clock",
      "performance",
    ]);

    const mem = new Map<string, string>();
    const fakeStorage = {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => {
        mem.set(k, v);
      },
    };

    expect(readOpsAnalyticsCollapsed(fakeStorage)).toBe(false);
    writeOpsAnalyticsCollapsed(true, fakeStorage);
    expect(mem.get(OPS_ANALYTICS_COLLAPSED_KEY)).toBe("1");
    expect(readOpsAnalyticsCollapsed(fakeStorage)).toBe(true);
    writeOpsAnalyticsCollapsed(false, fakeStorage);
    expect(readOpsAnalyticsCollapsed(fakeStorage)).toBe(false);
  });

  it("wires inline triage actions, ClockSummaryCard LeafTabs + auto-sync, StaffingGlanceCard 7d strip, and Ops Jump Rail", () => {
    const panelsSrc = readFileSync(
      join(SRC_ROOT, "components/dashboard/TodayAttentionPanels.tsx"),
      "utf8",
    );
    expect(panelsSrc).toContain("EventQuickPeekSheet");
    expect(panelsSrc).toContain("InviteBAModal");
    expect(panelsSrc).toContain("BAProfileModal");
    expect(panelsSrc).toContain("autoOpenDm");
    expect(panelsSrc).toContain("Nudge BA");
    expect(panelsSrc).toContain("Assign BA");
    expect(panelsSrc).toContain("Show all");

    const clockSrc = readFileSync(
      join(SRC_ROOT, "components/dashboard/ClockSummaryCard.tsx"),
      "utf8",
    );
    expect(clockSrc).toContain("LeafTabs");
    expect(clockSrc).toContain("spark-live-clock-dot");
    expect(clockSrc).toContain("BAProfileModal");
    expect(clockSrc).toContain("/timesheet?ba=");
    expect(clockSrc).toContain("AUTO_SYNC_INTERVAL_MS");

    const staffingCardSrc = readFileSync(
      join(SRC_ROOT, "components/dashboard/StaffingGlanceCard.tsx"),
      "utf8",
    );
    expect(staffingCardSrc).toContain("TideProgress");
    expect(staffingCardSrc).toContain("/schedule?filter=unstaffed");
    expect(staffingCardSrc).toContain("7-day unstaffed breakdown");

    const staffingBoardSrc = readFileSync(
      join(SRC_ROOT, "components/pages/staffing/SparkStaffingBoard.tsx"),
      "utf8",
    );
    expect(staffingBoardSrc).toContain('searchParams.get("filter")');
    expect(staffingBoardSrc).toContain('searchParams.get("date")');

    const payrollSrc = readFileSync(
      join(SRC_ROOT, "components/pages/staffing/SparkPayroll.tsx"),
      "utf8",
    );
    expect(payrollSrc).toContain('searchParams.get("ba")');

    const dashSrc = readFileSync(
      join(SRC_ROOT, "components/pages/dashboard-event/DashboardEvent.tsx"),
      "utf8",
    );
    expect(dashSrc).not.toContain("Ops cockpit navigation");
    expect(dashSrc).toContain("Ops-only");
    expect(dashSrc).toContain("Expand Program Analytics");
    expect(dashSrc).not.toContain("ActiveTenantAskAi");
  });
});
