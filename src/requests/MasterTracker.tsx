import React, {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import DuplicateEventsButton from "./DuplicateEventsButton";
import TrackerSavedViews, {
  type TrackerViewSnapshot,
} from "./TrackerSavedViews";
import { useLazyLoadQuery, useRelayEnvironment } from "react-relay/hooks";
import { fetchQuery } from "relay-runtime";
import { Link, useNavigate, useSearchParams } from "react-router";
import Layout from "@/layout/Layout";
import { TrackerListQuery } from "@/api/queries/TrackerListQuery";
import type { TrackerListQuery as TrackerListQueryType } from "@api/queries/__generated__/TrackerListQuery.graphql";
import { TrackerStatusCountsQuery } from "@/api/queries/TrackerStatusCountsQuery";
import type { TrackerStatusCountsQuery as TrackerStatusCountsQueryType } from "@api/queries/__generated__/TrackerStatusCountsQuery.graphql";
import { RmmClientsQuery } from "@/api/queries/RmmClientsQuery";
import type { RmmClientsQuery as RmmClientsQueryType } from "@api/queries/__generated__/RmmClientsQuery.graphql";
import { UsersQuery } from "@/api/queries/UsersQuery";
import type { UsersQuery as UsersQueryType } from "@api/queries/__generated__/UsersQuery.graphql";
import { useConsumersSampled } from "@/hooks/useConsumersSampled";
import { useFirstTimeConsumers } from "@/hooks/useFirstTimeConsumers";
import { useProductsPurchased } from "@/hooks/useProductsPurchased";
import { useAuthStore } from "@/store/authStore";
import useSparkRole from "@/hooks/useSparkRole";
import useLinkedSheetUrl from "@/hooks/useLinkedSheetUrl";
import TrackerPlanFilter from "@/plans/TrackerPlanFilter";
import TrackerPlanAttachBar from "@/plans/TrackerPlanAttachBar";
import TrackerBulkBar from "./TrackerBulkBar";
import SparkPageHeader from "@/shared/SparkPageHeader";
import SparkPrimaryButton from "@/shared/SparkPrimaryButton";
import SparkGhostButton from "@/shared/SparkGhostButton";
import SparkFilterBar from "@/shared/SparkFilterBar";
import SparkEmptyState from "@/shared/SparkEmptyState";
import { trackerRowDestination } from "./trackerRowDestination";
import { CountReel } from "@/motion/CountReel";
import {
  buildTrackerUrlParams,
  parseTrackerUrlParams,
  trackerDateRangeToServer,
  trackerSortToServer,
  trackerStatusToServer,
  VALID_TRACKER_DATE_RANGES,
  type TrackerCustomRange,
  type TrackerDateRange,
} from "@/requests/masterTrackerFilters";
import InternalNotesPanel from "./InternalNotesPanel";
import BulkCloneModal from "./BulkCloneModal";
import InviteBAModal from "./InviteBAModal";
import PostToBoardModal from "./PostToBoardModal";
import DeleteRequestModal from "./DeleteRequestModal";
import CancelDemoDialog from "./CancelDemoDialog";
import ProgramSwitch from "@/field/ProgramSwitch";
import { isTorchTenant } from "@/field/torch";
import { isRecapDue } from "../lib/recapDue";

/**
 * Spark v2 — Master Tracker
 *
 * Wireframe: spark-demo/index.html lines 912-984 + 3861-3878.
 *
 *   ALL EVENTS · ONE TABLE
 *   Master tracker.            [⤴ Bulk upload] [↗ Export CSV] [+ Log event]
 *   Every event, every status, every recap link.
 *
 *   [STATUS] All·N | Pending·N | Queue·N | Approved·N | Scheduled·N | Done·N    [Search…]
 *
 *   [SCHEDULED] [CONSUMERS] [FIRST-TIME] [PRODUCTS PURCHASED]
 *
 *   | DATE | REQUESTED | STATUS | MARKET | VENUE | TYPE | CONSUMERS | 1ST-TIME | RECAP |
 *   ...
 *
 * DATE is the venue calendar day. REQUESTED is Request.startTime–endTime
 * (the demo/event window the client asked for) — not BA shift clock times.
 */

// The STAFFING select carries two kinds of value: the request's own
// scheduling status, and whether its event has an ambassador on it.
const STAFFING_UNSTAFFED = "__unstaffed";
const STAFFING_STAFFED = "__staffed";
const isSchedulingStatus = (v: string) => v !== "all" && !v.startsWith("__");
const staffingFlag = (v: string): boolean | null =>
  v === STAFFING_UNSTAFFED ? true : v === STAFFING_STAFFED ? false : null;

const STATUS_CHIP: Record<string, string> = {
  done: "chip chip-lime",
  scheduled: "chip chip-sky",
  approved: "chip chip-purple",
  queue: "chip chip-gold",
  pending: "chip chip-orange",
};

const STATUS_LABEL: Record<string, string> = {
  done: "DONE",
  scheduled: "SCHEDULED",
  approved: "APPROVED",
  queue: "QUEUE FOR IGNITE",
  pending: "PENDING",
};

// Friendly export labels for the two-value schedulingStatus metadata.
const SCHEDULING_LABEL: Record<string, string> = {
  already_scheduled: "Already scheduled with the account",
  needs_scheduling: "Needs scheduling by Ignite",
};

// "Active" = anything not yet completed. Default landing for admins.
// Status slugs sent server-side via masterTrackerFilters.ts.

const STATUS_FILTERS: { key: string; label: string; chip: string }[] = [
  { key: "active", label: "Active", chip: "chip chip-lime" },
  { key: "pending", label: "Pending", chip: "chip chip-orange" },
  { key: "queue", label: "Queue", chip: "chip chip-gold" },
  { key: "approved", label: "Approved", chip: "chip chip-purple" },
  { key: "scheduled", label: "Scheduled", chip: "chip chip-sky" },
  { key: "done", label: "Done", chip: "chip chip-muted" },
  { key: "all", label: "All", chip: "chip chip-muted" },
];

type RecapStatus = "submitted" | "due" | "none";

/**
 * Small chrome-matched label+select used by the tracker's REFINE
 * row (date range, market, sort). Sits inline next to the status
 * chips + search so all the filter controls feel like one bar.
 */
const FilterSelect: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}> = ({ label, value, onChange, options }) => (
  <label className="flex items-center gap-1.5">
    <span className="label-mini">{label}</span>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg text-xs"
      style={{
        padding: "0.28rem 0.65rem",
        minHeight: 30,
        background: "var(--spark-bg)",
        border: "1px solid var(--spark-border)",
        color: "var(--spark-text)",
        outline: "none",
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  </label>
);

type Row = {
  uuid: string;
  id: string;
  date: string;
  dateLabel: string;
  // Requested demo/event window from Request.startTime / endTime.
  // Empty string when the request has no start/end (rare legacy rows).
  timeLabel: string;
  statusSlug: string;
  market: string;
  venue: string;
  address: string;
  type: string;
  // Selected SKUs/products on the request (distinct names), shown as a
  // muted sub-line under the activation type. Empty when none selected.
  skus: string[];
  // Shift-swap activity: count of still-open (unclaimed) dropped slots, and
  // a human tooltip of who dropped / who grabbed each.
  openShiftsOpen: number;
  openShiftsTotal: number;
  openShiftsTooltip: string;
  eventUuid: string | null;
  eventId: string | null;
  eventDate: string | null;
  eventAddress: string | null;
  // UUID of the event that actually holds recaps (legacy or custom).
  // The list counts recaps across ALL of a request's events, but the
  // singular `event` (lowest-id) may be recap-less — clicking a "N
  // RECAP" row should land on the event that shows the recap. null when
  // no event on the request has any recap.
  recapEventUuid: string | null;
  // Aggregate of the request's events + recaps for the chip:
  //   "submitted" → at least one event has at least one recap
  //   "due"       → events scheduled but no recaps yet
  //   "none"      → no events scheduled yet (request still pending)
  recapStatus: RecapStatus;
  recapCount: number;
  // Two-value metadata: "already_scheduled" | "needs_scheduling" | "".
  schedulingStatus: string;
  // Torch form: true / false / null when the tenant doesn't collect it.
  isNonActiveProductRequired: boolean | null;
  // BA staffing on the linked event: assigned = invited + confirmed,
  // confirmed = the subset that accepted. Drives the per-row "BA
  // assigned" chip in the status column.
  assignedBa: number;
  confirmedBa: number;
  // Activation Plan this request belongs to (null when unplanned).
  planId: string | null;
  planName: string | null;
  // Assigned RMM (typo preserved from GraphQL: rmmAsigned). Used for
  // "By RMM" group headers; empty label when unassigned.
  rmmId: string | null;
  rmmLabel: string;
};

export const parseCalendarDate = (
  iso: string | null | undefined,
): Date | null => {
  if (!iso) return null;
  const m = iso.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
  }
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
};

const pickIsoDate = (raw: string | null | undefined): string | null => {
  if (!raw) return null;
  const m = raw.trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : raw.trim() || null;
};

const fmtDateLabel = (raw: string | null | undefined) => {
  if (!raw) return "—";
  const d = parseCalendarDate(raw);
  if (!d) return raw;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const fmtTimeRange = (
  start: string | null | undefined,
  end: string | null | undefined,
) => {
  // Backend returns a full naive ISO ("2026-05-30T14:30:00") in the
  // venue's local timezone. The previous version of this helper did
  // `raw.split(":")` expecting bare "14:30", which on a full ISO put
  // the whole "2026-05-30T14" into the hours slot — parseInt happily
  // returned 2026, and every row in the tracker ended up rendering as
  // "10:30p" (10 = (2026+11)%12+1). Extract HH:MM by regex instead so
  // the same call works whether the backend sends time-only or a full
  // datetime.
  const tone = (raw: string) => {
    const m = raw.match(/(?:^|T)(\d{2}):(\d{2})/);
    if (!m) return raw;
    const hh = parseInt(m[1], 10);
    const mm = m[2];
    if (!Number.isFinite(hh)) return raw;
    const ampm = hh >= 12 ? "p" : "a";
    const h12 = ((hh + 11) % 12) + 1;
    return mm && mm !== "00" ? `${h12}:${mm}${ampm}` : `${h12}${ampm}`;
  };
  if (!start && !end) return "";
  if (start && end) return `${tone(start)}–${tone(end)}`;
  return tone(start ?? end ?? "");
};

/* ─────────────────────────── TABLE ────────────────────────────── */

type Mentionable = { id: string; name: string; email: string };

// Fallback roster used only when the live admin lookup hasn't loaded
// yet or returns nothing. Real admins come from the UsersQuery below.
const ADMIN_ROSTER_FALLBACK: Mentionable[] = [
  { id: "kyle", name: "Kyle Christiansen", email: "kyle@igniteproductions.co" },
];

const RMM_ROSTER_PAGE_SIZE = 100;

const adminsFromUsersPage = (
  data: UsersQueryType["response"] | null | undefined,
): Mentionable[] => {
  const rows = (data?.users?.edges ?? [])
    .map((e) => e?.node)
    .filter((n): n is NonNullable<typeof n> => Boolean(n));
  return rows
    .filter((u) => {
      const role = (u.role?.name ?? "").toLowerCase();
      return role === "admin" || role === "spark-admin";
    })
    .map<Mentionable>((u) => ({
      id: String(u.id),
      name:
        [u.firstName, u.lastName].filter(Boolean).join(" ") ||
        u.email ||
        "Admin",
      email: u.email ?? "",
    }))
    .filter((m) => m.email);
};

const AdminMentionablesLoader: React.FC<{
  tenantId: string;
  onLoaded: (admins: Mentionable[]) => void;
}> = ({ tenantId, onLoaded }) => {
  const environment = useRelayEnvironment();
  // Server role=SPARK + page size 100 (People pattern) — no silent first:500.
  const data = useLazyLoadQuery<UsersQueryType>(
    UsersQuery,
    {
      filters: tenantId ? { tenantId, role: "SPARK" } : null,
      first: RMM_ROSTER_PAGE_SIZE,
    },
    { fetchPolicy: "store-or-network" },
  );
  const [extra, setExtra] = useState<Mentionable[]>([]);
  const fetchedKey = useRef<string>("");

  useEffect(() => {
    let cancelled = false;
    const page1 = adminsFromUsersPage(data);
    setExtra([]);
    onLoaded(page1);

    const walk = async () => {
      let cursor =
        typeof data?.users?.pageInfo?.endCursor === "string"
          ? data.users.pageInfo.endCursor
          : null;
      let hasNext = Boolean(data?.users?.pageInfo?.hasNextPage) && Boolean(cursor);
      const key = `${tenantId}|${cursor ?? ""}|${page1.length}`;
      if (fetchedKey.current === key) return;
      fetchedKey.current = key;
      const collected: Mentionable[] = [];
      while (hasNext && cursor && !cancelled) {
        const next = await fetchQuery<UsersQueryType>(
          environment,
          UsersQuery,
          {
            filters: { tenantId, role: "SPARK" },
            first: RMM_ROSTER_PAGE_SIZE,
            after: cursor,
          },
          { fetchPolicy: "network-only" },
        ).toPromise();
        collected.push(...adminsFromUsersPage(next));
        cursor =
          typeof next?.users?.pageInfo?.endCursor === "string"
            ? next.users.pageInfo.endCursor
            : null;
        hasNext = Boolean(next?.users?.pageInfo?.hasNextPage) && Boolean(cursor);
        if (!cancelled && collected.length > 0) {
          setExtra([...collected]);
        }
      }
    };
    void walk().catch(() => {
      /* keep page-1 admins on cursor failure */
    });
    return () => {
      cancelled = true;
    };
  }, [data, environment, onLoaded, tenantId]);

  useEffect(() => {
    onLoaded([...adminsFromUsersPage(data), ...extra]);
  }, [data, extra, onLoaded]);

  return null;
};

const fmtGroupHeading = (raw: string): string => {
  if (!raw) return "Undated";
  const d = parseCalendarDate(raw);
  if (!d) return raw;
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

type TrackerGroupBy = "none" | "date" | "rmm";

const UNASSIGNED_RMM_LABEL = "Unassigned RMM";

const rmmGroupKey = (r: Row): string => r.rmmId ?? "";
const rmmGroupHeading = (r: Row): string =>
  r.rmmLabel.trim() || UNASSIGNED_RMM_LABEL;

const TrackerTable: React.FC<{
  rows: Row[];
  mentionables: Mentionable[];
  groupBy: TrackerGroupBy;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  selectionEnabled?: boolean;
  onClone?: (row: Row) => void;
  onAssignBa?: (row: Row) => void;
  onPostBoard?: (row: Row) => void;
  onDelete?: (row: Row) => void;
  onNotesOpened?: () => void;
}> = ({
  rows,
  mentionables,
  groupBy,
  selectedIds,
  onToggleSelect,
  selectionEnabled,
  onClone,
  onAssignBa,
  onPostBoard,
  onDelete,
  onNotesOpened,
}) => {
  const navigate = useNavigate();
  const { isClient } = useSparkRole();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [approvedIds, setApprovedIds] = useState<Set<string>>(new Set());
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const colCount = selectionEnabled ? 12 : 11;

  // Inline request approval from the Tracker (clients + admins). Backend
  // `approveRequest` enforces tenant membership + blocks BAs (same as the
  // emailed link), so it's safe for clients. Raw authenticated fetch (same
  // pattern as the approvals queue / request view) — no Relay artifact.
  const approveRow = async (row: Row) => {
    setApprovingId(row.uuid);
    try {
      const res = await fetch(import.meta.env.VITE_GRAPHQL_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `JWT ${localStorage.getItem("@token") ?? ""}`,
        },
        body: JSON.stringify({
          query:
            "mutation Approve($input: ApproveRequestInput!) { approveRequest(input: $input) { success message } }",
          variables: { input: { id: row.id } },
        }),
      });
      const json = await res.json();
      if (!json.errors?.length && json?.data?.approveRequest?.success) {
        setApprovedIds((prev) => new Set(prev).add(row.uuid));
      } else {
        window.alert(
          json.errors?.[0]?.message ||
            json?.data?.approveRequest?.message ||
            "Couldn't approve — please try again.",
        );
      }
    } catch {
      window.alert("Couldn't approve — please try again.");
    } finally {
      setApprovingId(null);
    }
  };
  // Progressive row rendering — large tenants can hit 1,000+ tracker rows
  // and mounting them all at once janks the tab for seconds. Render the
  // first viewport-plus chunk immediately, then grow during idle frames
  // until everything is in the DOM. Filter/sort changes swap the `rows`
  // array identity, which resets the window. Everything BELOW the table
  // (counts, export) still reads the full `rows`.
  // DOM window — mount only the first N filtered rows; grow on scroll.
  const TRACKER_DOM_WINDOW = 120;
  const [visibleCount, setVisibleCount] = useState(TRACKER_DOM_WINDOW);
  useEffect(() => {
    setVisibleCount(120);
  }, [rows]);
  useEffect(() => {
    if (visibleCount >= rows.length) return;
    const grow = () => setVisibleCount((c) => Math.min(rows.length, c + 240));
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(grow, { timeout: 200 });
      return () => window.cancelIdleCallback(id);
    } else {
      const id = setTimeout(grow, 40);
      return () => clearTimeout(id);
    }
  }, [visibleCount, rows]);
  const visibleRows = rows.slice(0, visibleCount);
  const openRow = (r: Row) => {
    navigate(trackerRowDestination(r), { state: { from: "/requests/list" } });
  };

  return (
    <div className="spark-card spark-tracker-shell overflow-hidden">
      <div className="md:hidden">
        {rows.length === 0 ? (
          <SparkEmptyState
            className="border-0 rounded-none"
            title="No events match"
            body="Try clearing status, when, or market filters."
          />
        ) : (
          <ul className="divide-y" style={{ borderColor: "var(--spark-hairline, var(--spark-border))" }}>
            {visibleRows.map((r, rowIdx) => {
              const slug = r.statusSlug.toLowerCase();
              const chipClass = STATUS_CHIP[slug] ?? "chip chip-muted";
              const label = STATUS_LABEL[slug] ?? r.statusSlug.toUpperCase();
              const prev = rowIdx > 0 ? visibleRows[rowIdx - 1] : null;
              const thisDate = r.date.slice(0, 10);
              const showDateHeader =
                groupBy === "date" && thisDate !== (prev?.date.slice(0, 10) ?? "");
              const showRmmHeader =
                groupBy === "rmm" &&
                rmmGroupKey(r) !== (prev ? rmmGroupKey(prev) : null);
              const groupHeading = showDateHeader
                ? fmtGroupHeading(thisDate)
                : showRmmHeader
                  ? rmmGroupHeading(r)
                  : null;
              return (
                <li key={r.uuid}>
                  {groupHeading ? (
                    <div
                      className="px-3 py-1.5 mono spark-tracker-group"
                    >
                      {groupHeading.toUpperCase()}
                    </div>
                  ) : null}
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2.5"
                    onClick={() => openRow(r)}
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span className="text-sm" style={{ color: "var(--spark-text)" }}>
                        {r.dateLabel}
                        {r.timeLabel ? (
                          <span
                            className="mono block text-[10px] mt-0.5 tracking-[0.08em]"
                            style={{ color: "var(--spark-text-meta)" }}
                          >
                            Requested {r.timeLabel}
                          </span>
                        ) : null}
                      </span>
                      <span className={`${chipClass} chip-sm`}>{label}</span>
                    </span>
                    <span className="block text-sm font-semibold mt-1">{r.venue}</span>
                    <span
                      className="block text-xs mt-0.5"
                      style={{ color: "var(--spark-text-meta)" }}
                    >
                      {r.market}
                      {r.assignedBa > 0
                        ? ` · ${r.assignedBa} BA${r.assignedBa === 1 ? "" : "s"}`
                        : " · No BA"}
                      {r.type && r.type !== "—" ? ` · ${r.type}` : ""}
                    </span>
                    <span
                      className="mono block text-[10px] mt-1"
                      style={{
                        letterSpacing: "0.12em",
                        color: "var(--spark-orange)",
                      }}
                    >
                      OPEN →
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <div className="hidden md:block overflow-auto max-h-[75vh]">
        {/* Daisy table APIs only (table / table-sm / table-pin-rows) —
            Tabler density + hairlines live in .spark-tracker-table CSS. */}
        <table
          className="table table-sm table-pin-rows spark-tracker-table w-full"
          style={{ minWidth: 1200 }}
        >
          <thead>
            <tr className="text-left mono">
              {selectionEnabled ? (
                <th className="w-10 spark-table-sticky-bg" aria-label="Select" />
              ) : null}
              <th className="spark-table-sticky-date">DATE</th>
              <th className="spark-table-sticky-bg" title="Requested demo / event window">
                REQUESTED
              </th>
              <th className="spark-table-sticky-bg">STATUS</th>
              <th className="spark-table-sticky-bg">MARKET</th>
              <th className="spark-table-sticky-bg">VENUE</th>
              <th className="spark-table-sticky-bg spark-table-hide-sm">
                ADDRESS
              </th>
              <th className="spark-table-sticky-bg">TYPE</th>
              <th className="text-right spark-table-sticky-bg">CONSUMERS</th>
              <th className="text-right spark-table-sticky-bg">1ST-TIME</th>
              <th className="spark-table-sticky-bg">RECAP</th>
              <th className="spark-table-sticky-bg">NOTES</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={colCount} className="p-0">
                  <SparkEmptyState
                    className="border-0 rounded-none"
                    title="No events match"
                    body="Try clearing status, when, or market filters."
                  />
                </td>
              </tr>
            )}
            {visibleRows.map((r, rowIdx) => {
              // Group headers — insert when the active group key changes
              // vs the previous row. Date grouping relies on date sort;
              // RMM grouping sorts by label in MasterTrackerInner.
              const prev = rowIdx > 0 ? visibleRows[rowIdx - 1] : null;
              const thisDate = r.date.slice(0, 10);
              const showDateHeader =
                groupBy === "date" && thisDate !== (prev?.date.slice(0, 10) ?? "");
              const showRmmHeader =
                groupBy === "rmm" &&
                rmmGroupKey(r) !== (prev ? rmmGroupKey(prev) : null);
              const showGroupHeader = showDateHeader || showRmmHeader;
              const groupHeading = showDateHeader
                ? fmtGroupHeading(thisDate)
                : showRmmHeader
                  ? rmmGroupHeading(r)
                  : "";
              const headerEl = showGroupHeader ? (
                <tr key={`hdr-${rowIdx}`} className="spark-tracker-group-row">
                  <td colSpan={colCount} className="mono spark-tracker-group">
                    {groupHeading.toUpperCase()}
                  </td>
                </tr>
              ) : null;
              const slug = r.statusSlug.toLowerCase();
              const isDone = slug === "done";
              const chipClass = STATUS_CHIP[slug] ?? "chip chip-muted";
              const label = STATUS_LABEL[slug] ?? r.statusSlug.toUpperCase();
              const isExpanded = expanded.has(r.uuid);
              const toggleExpand = (e: React.MouseEvent) => {
                e.stopPropagation();
                setExpanded((prev) => {
                  const next = new Set(prev);
                  if (next.has(r.uuid)) next.delete(r.uuid);
                  else {
                    next.add(r.uuid);
                    onNotesOpened?.();
                  }
                  return next;
                });
              };
              // Click target by row state:
              //   has recap        → the event that HOLDS the recap
              //                      (recapEventUuid), so a "N RECAP" row
              //                      lands on a page that shows it — the
              //                      list counts recaps across all events
              //                      but `event` is the lowest-id one,
              //                      which may be recap-less.
              //   done + has event → event detail
              //   done, no event   → recap list
              //   has event row    → event detail
              //   pending / queue  → Spark v2 request DETAIL (not
              //                      the edit form — kyle wants to
              //                      see context first, then edit
              //                      via the Edit button there).
              // Every navigation off the Master Tracker stamps
              // `from: "/requests/list"` so the destination's Back link
              // returns HERE, not the legacy "All Events" view.
              const onClick = () => openRow(r);
              const selected = Boolean(selectedIds?.has(r.id));
              const zebra = rowIdx % 2 === 1;
              return (
                <React.Fragment key={r.uuid}>
                {headerEl}
                <tr
                  className={
                    selected
                      ? "spark-row-selected cursor-pointer transition-colors"
                      : zebra
                        ? "cursor-pointer transition-colors bg-white/[0.025] hover:bg-white/[0.07]"
                        : "cursor-pointer transition-colors hover:bg-white/[0.07]"
                  }
                  onClick={onClick}
                >
                  {selectionEnabled && onToggleSelect ? (
                    <td
                      className="align-top"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds?.has(r.id) ?? false}
                        onChange={() => onToggleSelect(r.id)}
                        aria-label={`Select ${r.venue}`}
                        className="checkbox checkbox-xs"
                        style={{
                          borderColor: "rgba(var(--spark-ink-rgb),0.35)",
                          accentColor: "var(--spark-orange, #ef5a2a)",
                        }}
                      />
                    </td>
                  ) : null}
                  <td className="align-top spark-table-sticky-date">
                    <p className="text-[13px] leading-tight">{r.dateLabel}</p>
                  </td>
                  <td className="align-top whitespace-nowrap">
                    {r.timeLabel ? (
                      <p
                        className="mono text-[12px] leading-tight spark-tracker-cell-primary tracking-[0.04em]"
                        title="Requested start–end"
                      >
                        {r.timeLabel}
                      </p>
                    ) : (
                      <span className="spark-tracker-cell-muted">—</span>
                    )}
                  </td>
                  <td>
                    <div className="flex flex-col items-start gap-0.5">
                      <span className={`${chipClass} chip-sm`}>{label}</span>
                      {r.assignedBa > 0 ? (
                        <span
                          className={
                            r.confirmedBa > 0
                              ? "chip chip-lime chip-sm"
                              : "chip chip-muted chip-sm"
                          }
                          style={{ display: "inline-flex" }}
                          title={`${r.confirmedBa} confirmed of ${r.assignedBa} assigned`}
                        >
                          👤 {r.assignedBa}
                          {r.confirmedBa >= r.assignedBa ? " ✓" : ""}
                        </span>
                      ) : null}
                      {(r.statusSlug === "pending" ||
                        r.statusSlug === "queue") &&
                        (approvedIds.has(r.uuid) ? (
                          <span className="chip chip-purple chip-sm">
                            APPROVED
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={approvingId === r.uuid}
                            onClick={(e) => {
                              e.stopPropagation();
                              approveRow(r);
                            }}
                            title="Approve this request"
                            className="mono text-[10px] px-2 py-0.5 rounded-full"
                            style={{
                              letterSpacing: "0.1em",
                              border: "1px solid var(--spark-lime)",
                              color: "var(--spark-lime)",
                              background: "transparent",
                              cursor:
                                approvingId === r.uuid ? "default" : "pointer",
                              opacity: approvingId === r.uuid ? 0.6 : 1,
                            }}
                          >
                            {approvingId === r.uuid ? "APPROVING…" : "APPROVE"}
                          </button>
                        ))}
                    </div>
                  </td>
                  <td className="spark-tracker-cell-muted text-[12px]">
                    {r.market}
                  </td>
                  <td>
                    <span className="font-semibold text-[13px] leading-tight spark-tracker-cell-primary">
                      {r.venue}
                    </span>
                    <span
                      className="block text-[10px] mt-0.5 spark-tracker-cell-muted tracking-wide"
                      style={{ fontVariantNumeric: "tabular-nums" }}
                      title="Request number — search the tracker by this (e.g. REQ-925)"
                    >
                      REQ-{reqCodeOf(r.id)}
                    </span>
                    {r.planName ? (
                      <span
                        className="block mono text-[9px] mt-0.5 truncate max-w-[160px] spark-tracker-cell-muted tracking-[0.1em]"
                        title={`Plan: ${r.planName}`}
                      >
                        ▸ {r.planName}
                      </span>
                    ) : null}
                    {r.schedulingStatus === "needs_scheduling" ? (
                      <span
                        className="chip chip-gold chip-sm mt-1"
                        style={{ display: "inline-flex" }}
                        title="Ignite still needs to schedule this with the account"
                      >
                        ◷ NEEDS SCHEDULING
                      </span>
                    ) : r.schedulingStatus === "already_scheduled" ? (
                      <span
                        className="chip chip-muted chip-sm mt-1"
                        style={{ display: "inline-flex" }}
                        title="Already scheduled with the account"
                      >
                        ✓ SCHEDULED
                      </span>
                    ) : null}
                    {r.isNonActiveProductRequired === true ? (
                      <span
                        className="chip chip-gold chip-sm mt-1"
                        style={{ display: "inline-flex" }}
                        title="Is Non-Active Product Required?"
                      >
                        NON-ACTIVE REQUIRED
                      </span>
                    ) : r.isNonActiveProductRequired === false ? (
                      <span
                        className="chip chip-muted chip-sm mt-1"
                        style={{ display: "inline-flex" }}
                        title="Is Non-Active Product Required?"
                      >
                        NO NON-ACTIVE
                      </span>
                    ) : null}
                    {r.openShiftsOpen > 0 ? (
                      <span
                        className="chip chip-gold chip-sm mt-1"
                        style={{ display: "inline-flex" }}
                        title={r.openShiftsTooltip || "A booked shift was dropped and is open to claim"}
                      >
                        ⚡ {r.openShiftsOpen} OPEN SHIFT{r.openShiftsOpen > 1 ? "S" : ""}
                      </span>
                    ) : r.openShiftsTotal > 0 ? (
                      <span
                        className="chip chip-muted chip-sm mt-1"
                        style={{ display: "inline-flex" }}
                        title={r.openShiftsTooltip}
                      >
                        ⇄ SWAPPED
                      </span>
                    ) : null}
                  </td>
                  <td className="text-[12px] max-w-[280px] spark-table-hide-sm spark-tracker-cell-muted">
                    <span className="line-clamp-2">{r.address || "—"}</span>
                  </td>
                  <td className="text-xs spark-tracker-cell-muted">
                    {r.type}
                    {r.skus.length > 0 ? (
                      <span
                        className="block mt-0.5 text-[10px] line-clamp-2 spark-tracker-cell-muted"
                        title={r.skus.join(", ")}
                      >
                        {r.skus.join(", ")}
                      </span>
                    ) : null}
                  </td>
                  <td
                    className="text-right tab-num spark-tracker-cell-muted"
                    style={{
                      color: isDone ? "var(--spark-text)" : undefined,
                    }}
                  >
                    {isDone ? "—" : "—"}
                  </td>
                  <td
                    className="text-right tab-num"
                    style={{
                      color: isDone
                        ? "var(--spark-lime)"
                        : "var(--spark-text-meta, rgba(var(--spark-ink-rgb),0.3))",
                    }}
                  >
                    —
                  </td>
                  <td className="whitespace-nowrap">
                    {r.recapStatus === "submitted" ? (
                      <span
                        className="chip chip-lime chip-sm"
                        title={`${r.recapCount} recap${r.recapCount === 1 ? "" : "s"} submitted`}
                      >
                        ● {r.recapCount} RECAP{r.recapCount === 1 ? "" : "S"}
                      </span>
                    ) : r.recapStatus === "due" ? (
                      <span className="chip chip-orange chip-sm" title="Activation scheduled, no recap filed yet">
                        ◌ DUE
                      </span>
                    ) : (
                      <span className="mono text-[10px] tracking-[0.14em] spark-tracker-cell-muted">
                        —
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap">
                    {isClient ? (
                      <span className="mono text-[10px] tracking-[0.14em] spark-tracker-cell-muted">
                        —
                      </span>
                    ) : (
                      // Cap the action cluster's width + allow wrapping so a
                      // full row of actions (incl. 🗑 DELETE) never pushes the
                      // table wider than the viewport — otherwise the last
                      // action lands in the horizontal-scroll region and you
                      // have to scroll sideways to reach it.
                      <div
                        className="spark-row-actions spark-row-actions--until-hover"
                        style={{ maxWidth: 300 }}
                      >
                        <button
                          onClick={toggleExpand}
                          className="mono text-[10px] transition"
                          style={{
                            letterSpacing: "0.14em",
                            color: isExpanded
                              ? "var(--spark-lime)"
                              : "var(--spark-muted, rgba(var(--spark-ink-rgb),0.5))",
                          }}
                          title="Internal notes & shipments"
                        >
                          {isExpanded ? "× CLOSE" : "✎ NOTES"}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/report-view/${r.uuid}`);
                          }}
                          className="mono text-[10px] transition"
                          style={{
                            letterSpacing: "0.14em",
                            color: "var(--spark-lime)",
                          }}
                          title="Open this request's branded campaign report"
                        >
                          REPORT
                        </button>
                        {onClone && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onClone(r);
                            }}
                            className="mono text-[10px] transition"
                            style={{
                              letterSpacing: "0.14em",
                              color: "var(--spark-muted, rgba(var(--spark-ink-rgb),0.5))",
                            }}
                            title="Clone this request to N new dates"
                          >
                            ⎘ CLONE
                          </button>
                        )}
                        {onAssignBa && r.eventId && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onAssignBa(r);
                            }}
                            className="mono text-[10px] transition"
                            style={{
                              letterSpacing: "0.14em",
                              color: "var(--spark-muted, rgba(var(--spark-ink-rgb),0.5))",
                            }}
                            title="Assign a BA to this event — sends a shift offer"
                          >
                            ✚ ASSIGN BA
                          </button>
                        )}
                        {onPostBoard && r.eventId && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onPostBoard(r);
                            }}
                            className="mono text-[10px] transition"
                            style={{
                              letterSpacing: "0.14em",
                              color: "var(--spark-muted, rgba(var(--spark-ink-rgb),0.5))",
                            }}
                            title="Post this event's job to the public BA board — open to all eligible BAs"
                          >
                            POST TO BOARD
                          </button>
                        )}
                        {onDelete && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDelete(r);
                            }}
                            className="mono text-[10px] transition"
                            style={{
                              letterSpacing: "0.14em",
                              color: "var(--spark-orange)",
                            }}
                            title="Delete this gig — removes it from the tracker (recoverable)"
                          >
                            DELETE
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
                {isExpanded && !isClient && (
                  <tr>
                    <td colSpan={colCount} className="!py-2 !px-3">
                      <InternalNotesPanel
                        requestUuid={r.uuid}
                        requestLabel={`${r.venue} · ${r.market}`}
                        mentionables={mentionables}
                      />
                    </td>
                  </tr>
                )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* ─────────────────────────── INNER (queries) ────────────────────── */

/**
 * The human-facing request number shown in the request view + approval
 * emails: "REQ-" + the last 4 chars of the request id, uppercased. Kept in
 * one place so the tracker's search + row label match SparkRequestView
 * (`REQ-${String(request.id).slice(-4).toUpperCase()}`) exactly.
 */
const reqCodeOf = (id: string): string => id.slice(-4).toUpperCase();

const TRACKER_PAGE_SIZE = 50;

/**
 * Server status-chip + market totals. Independent of the paged rows query
 * so chips stay accurate past page 1 and while a status filter is active.
 */
const TrackerStatusCountsLoader: React.FC<{
  tenantId: string;
  search: string;
  rmmFilter: string;
  dateRange: TrackerDateRange;
  customRange: TrackerCustomRange | null;
  marketFilter: string;
  schedulingFilter: string;
  planId: string | null;
  refreshKey?: number;
  onCounts: (counts: Record<string, number>, total: number) => void;
  onMarkets: (markets: string[]) => void;
}> = ({
  tenantId,
  search,
  rmmFilter,
  dateRange,
  customRange,
  marketFilter,
  schedulingFilter,
  planId,
  refreshKey = 0,
  onCounts,
  onMarkets,
}) => {
  const reqNeedle = useMemo(() => {
    const m = search.trim().match(/^req[-\s]*([a-z0-9]{1,4})$/i);
    return m ? m[1].toUpperCase() : null;
  }, [search]);

  const filters = useMemo(() => {
    const dateBounds = reqNeedle
      ? {}
      : trackerDateRangeToServer(dateRange, customRange);
    return {
      tenantId,
      rmmAsigned: rmmFilter === "all" ? null : rmmFilter,
      ...dateBounds,
      // Status intentionally omitted — trackerStatusCounts ignores it
      // server-side too, but don't send a chip filter that could confuse
      // future schema changes.
      schedulingStatus:
        reqNeedle || !isSchedulingStatus(schedulingFilter)
          ? null
          : schedulingFilter,
      unstaffed: reqNeedle ? null : staffingFlag(schedulingFilter),
      stateCode: reqNeedle || marketFilter === "all" ? null : marketFilter,
      activationPlanId: reqNeedle || !planId ? null : planId,
    };
  }, [
    tenantId,
    rmmFilter,
    dateRange,
    customRange,
    schedulingFilter,
    marketFilter,
    planId,
    reqNeedle,
  ]);

  const filterKey = useMemo(
    () =>
      [
        tenantId,
        rmmFilter,
        dateRange,
        customRange?.startDate ?? "",
        customRange?.endDate ?? "",
        schedulingFilter,
        marketFilter,
        planId ?? "",
        search,
        refreshKey,
      ].join("|"),
    [
      tenantId,
      rmmFilter,
      dateRange,
      customRange,
      schedulingFilter,
      marketFilter,
      planId,
      search,
      refreshKey,
    ],
  );

  const data = useLazyLoadQuery<TrackerStatusCountsQueryType>(
    TrackerStatusCountsQuery,
    {
      filters,
      q: reqNeedle ? null : search || null,
    },
    {
      fetchPolicy: refreshKey > 0 ? "network-only" : "store-or-network",
      fetchKey: filterKey,
    },
  );

  useEffect(() => {
    const buckets = data?.trackerStatusCounts?.buckets ?? [];
    const next: Record<string, number> = {};
    for (const b of buckets) {
      if (!b?.slug) continue;
      next[b.slug.toLowerCase()] = b.count ?? 0;
    }
    onCounts(next, data?.trackerStatusCounts?.total ?? 0);
    onMarkets(
      (data?.trackerStatusCounts?.marketCodes ?? []).filter(
        (c): c is string => Boolean(c),
      ),
    );
  }, [data, onCounts, onMarkets]);

  return null;
};

const MasterTrackerInner: React.FC<{
  activeStatus: string;
  search: string;
  rmmFilter: string;
  groupBy: TrackerGroupBy;
  dateRange: TrackerDateRange;
  customRange: TrackerCustomRange | null;
  sortMode: "date-desc" | "date-asc" | "venue" | "status";
  marketFilter: string;
  schedulingFilter: string;
  planId: string | null;
  mentionables: Mentionable[];
  listRefreshKey: number;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  selectionEnabled?: boolean;
  onNotesOpened?: () => void;
  onVisibleRowsChange?: (rows: Row[]) => void;
  onClone?: (row: Row) => void;
  onAssignBa?: (row: Row) => void;
  onPostBoard?: (row: Row) => void;
  onDelete?: (row: Row) => void;
}> = ({
  activeStatus,
  search,
  rmmFilter,
  groupBy,
  dateRange,
  customRange,
  sortMode,
  marketFilter,
  schedulingFilter,
  planId,
  mentionables,
  listRefreshKey,
  selectedIds,
  onToggleSelect,
  selectionEnabled,
  onNotesOpened,
  onVisibleRowsChange,
  onClone,
  onAssignBa,
  onPostBoard,
  onDelete,
}) => {
  const { tenantId } = useAuthStore();
  const environment = useRelayEnvironment();

  const reqNeedle = useMemo(() => {
    const m = search.trim().match(/^req[-\s]*([a-z0-9]{1,4})$/i);
    return m ? m[1].toUpperCase() : null;
  }, [search]);

  const serverFilters = useMemo(() => {
    if (!tenantId) return null;
    const dateBounds = reqNeedle
      ? {}
      : trackerDateRangeToServer(dateRange, customRange);
    const statusBounds = reqNeedle ? {} : trackerStatusToServer(activeStatus);
    const sortBounds = reqNeedle ? {} : trackerSortToServer(sortMode);
    return {
      tenantId,
      rmmAsigned: rmmFilter === "all" ? null : rmmFilter,
      ...dateBounds,
      ...statusBounds,
      ...sortBounds,
      schedulingStatus:
        reqNeedle || !isSchedulingStatus(schedulingFilter)
          ? null
          : schedulingFilter,
      unstaffed: reqNeedle ? null : staffingFlag(schedulingFilter),
      stateCode: reqNeedle || marketFilter === "all" ? null : marketFilter,
      activationPlanId: reqNeedle || !planId ? null : planId,
    };
  }, [
    tenantId,
    rmmFilter,
    dateRange,
    customRange,
    activeStatus,
    sortMode,
    schedulingFilter,
    marketFilter,
    planId,
    reqNeedle,
  ]);

  const filterKey = useMemo(
    () =>
      [
        tenantId,
        rmmFilter,
        dateRange,
        customRange?.startDate ?? "",
        customRange?.endDate ?? "",
        activeStatus,
        sortMode,
        schedulingFilter,
        marketFilter,
        planId ?? "",
        search,
        listRefreshKey,
      ].join("|"),
    [
      tenantId,
      rmmFilter,
      dateRange,
      customRange,
      activeStatus,
      sortMode,
      schedulingFilter,
      marketFilter,
      planId,
      search,
      listRefreshKey,
    ],
  );

  const data = useLazyLoadQuery<TrackerListQueryType>(
    TrackerListQuery,
    {
      first: TRACKER_PAGE_SIZE,
      after: null,
      q: reqNeedle ? null : search || null,
      filters: serverFilters,
    },
    {
      fetchPolicy: listRefreshKey > 0 ? "network-only" : "store-or-network",
      fetchKey: filterKey,
    },
  );

  type RequestNode = NonNullable<
    NonNullable<
      NonNullable<TrackerListQueryType["response"]["requests"]>["edges"]
    >[number]
  >["node"];

  const mapNodeToRow = useCallback((n: RequestNode | null | undefined): Row | null => {
      if (!n) return null;
      const market = n.market ?? "";
      const recapCount = n.recapsFiledCount ?? 0;
      // Prefer startTime's calendar date (which carries the venue's local
      // offset) before date so a UTC-serialized date never shifts by a day.
      const activationDate =
        pickIsoDate(n.event?.startTime) ||
        pickIsoDate(n.startTime) ||
        pickIsoDate(n.event?.date) ||
        pickIsoDate(n.date) ||
        null;
      const recapStatus: RecapStatus =
        (n.eventsCount ?? 0) === 0
          ? "none"
          : recapCount > 0
            ? "submitted"
            : isRecapDue(activationDate, 30)
              ? "due"
              : "none";
      return {
        uuid: String(n.uuid),
        id: String(n.id),
        date: activationDate ?? "",
        dateLabel: fmtDateLabel(activationDate),
        // Requested window on the Request row (spark-form / Create Request),
        // not event clock-in/out or BA shift times.
        timeLabel: fmtTimeRange(n.startTime, n.endTime),
        statusSlug: (n.status?.slug ?? n.status?.name ?? "pending")
          .toString()
          .toLowerCase(),
        market: market || "—",
        venue: n.retailer?.name ?? n.name ?? "—",
        address: n.address ?? "",
        type: n.requestType?.name ?? "—",
        skus: (n.productNames ?? [])
          .map((s) => (s ?? "").trim())
          .filter((s) => s.length > 0),
        openShiftsOpen: n.openShiftsOpen ?? 0,
        openShiftsTotal: n.openShiftsTotal ?? 0,
        openShiftsTooltip: n.openShiftsTooltip ?? "",
        eventUuid: n.event?.uuid ? String(n.event.uuid) : null,
        eventId: n.event?.id ? String(n.event.id) : null,
        eventDate: activationDate ? String(activationDate) : null,
        eventAddress: n.address ? String(n.address) : null,
        recapEventUuid: n.recapEventUuid ? String(n.recapEventUuid) : null,
        recapStatus,
        recapCount,
        schedulingStatus: n.schedulingStatus ?? "",
        isNonActiveProductRequired: n.isNonActiveProductRequired ?? null,
        assignedBa: n.event?.assignedAmbassadorsCount ?? 0,
        confirmedBa: n.event?.confirmedAmbassadorsCount ?? 0,
        planId: n.activationPlan?.id ? String(n.activationPlan.id) : null,
        planName: n.activationPlan?.name
          ? String(n.activationPlan.name)
          : null,
        rmmId: n.rmmAsigned?.id ? String(n.rmmAsigned.id) : null,
        rmmLabel: n.rmmAsigned
          ? [n.rmmAsigned.firstName, n.rmmAsigned.lastName]
              .filter(Boolean)
              .join(" ")
              .trim() || UNASSIGNED_RMM_LABEL
          : UNASSIGNED_RMM_LABEL,
      };
  }, []);

  const page1Rows: Row[] = useMemo(() => {
    return (
      data?.requests?.edges
        ?.map((e) => mapNodeToRow(e?.node ?? null))
        ?.filter((r): r is Row => Boolean(r)) ?? []
    );
  }, [data, mapNodeToRow]);

  const [extraRows, setExtraRows] = useState<Row[]>([]);
  const [endCursor, setEndCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const loadingMoreRef = useRef(false);

  useEffect(() => {
    setExtraRows([]);
    setEndCursor(data?.requests?.pageInfo?.endCursor ?? null);
    setHasMore(Boolean(data?.requests?.pageInfo?.hasNextPage));
  }, [filterKey, data?.requests?.pageInfo?.endCursor, data?.requests?.pageInfo?.hasNextPage]);

  const allRows = useMemo(
    () => [...page1Rows, ...extraRows],
    [page1Rows, extraRows],
  );

  const loadMore = useCallback(async () => {
    if (!endCursor || loadingMoreRef.current || !hasMore) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const next = await fetchQuery<TrackerListQueryType>(
        environment,
        TrackerListQuery,
        {
          first: TRACKER_PAGE_SIZE,
          after: endCursor,
          q: reqNeedle ? null : search || null,
          filters: serverFilters,
        },
        { fetchPolicy: "network-only" },
      ).toPromise();
      const edges = next?.requests?.edges ?? [];
      const mapped = edges
        .map((e) => mapNodeToRow(e?.node ?? null))
        .filter((r): r is Row => Boolean(r));
      setExtraRows((prev) => {
        const seen = new Set(prev.map((r) => r.id));
        return [...prev, ...mapped.filter((r) => !seen.has(r.id))];
      });
      setEndCursor(next?.requests?.pageInfo?.endCursor ?? null);
      setHasMore(Boolean(next?.requests?.pageInfo?.hasNextPage));
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [
    endCursor,
    environment,
    hasMore,
    mapNodeToRow,
    reqNeedle,
    search,
    serverFilters,
  ]);

  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el || !hasMore) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      { rootMargin: "200px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, loadMore, filterKey]);

  // REQ-number search is client-side only (backend q doesn't match id suffix).
  const rows = useMemo(() => {
    const base = reqNeedle
      ? allRows.filter((r) => reqCodeOf(r.id).includes(reqNeedle))
      : allRows;
    const out = [...base];
    if (reqNeedle) return out;
    switch (sortMode) {
      case "date-desc":
        out.sort(
          (a, b) =>
            (parseCalendarDate(b.date)?.getTime() ?? 0) -
            (parseCalendarDate(a.date)?.getTime() ?? 0),
        );
        break;
      case "date-asc":
        out.sort(
          (a, b) =>
            (parseCalendarDate(a.date)?.getTime() ?? 0) -
            (parseCalendarDate(b.date)?.getTime() ?? 0),
        );
        break;
      case "venue":
        out.sort((a, b) => (a.venue ?? "").localeCompare(b.venue ?? ""));
        break;
      case "status": {
        const rank: Record<string, number> = {
          pending: 0,
          queue: 1,
          approved: 2,
          scheduled: 3,
          done: 4,
          completed: 4,
          declined: 5,
          cancelled: 6,
          canceled: 6,
        };
        out.sort(
          (a, b) =>
            (rank[a.statusSlug] ?? 99) - (rank[b.statusSlug] ?? 99),
        );
        break;
      }
    }
    // Contiguous RMM sections for group headers; keep prior sort as
    // the within-group order via stable secondary compare.
    if (groupBy === "rmm") {
      out.sort((a, b) => {
        const byLabel = rmmGroupHeading(a).localeCompare(rmmGroupHeading(b));
        if (byLabel !== 0) return byLabel;
        return 0;
      });
    }
    return out;
  }, [allRows, sortMode, reqNeedle, groupBy]);

  useEffect(() => {
    if (onVisibleRowsChange) onVisibleRowsChange(rows);
  }, [rows, onVisibleRowsChange]);

  return (
    <div className="space-y-2">
      <TrackerTable
        rows={rows}
        mentionables={mentionables}
        groupBy={groupBy}
        selectedIds={selectedIds}
        onToggleSelect={onToggleSelect}
        selectionEnabled={selectionEnabled}
        onClone={onClone}
        onAssignBa={onAssignBa}
        onPostBoard={onPostBoard}
        onDelete={onDelete}
        onNotesOpened={onNotesOpened}
      />
      {hasMore && (
        <div ref={loadMoreRef} className="py-3 text-center">
          <p
            className="mono text-[10px]"
            style={{ letterSpacing: "0.16em", color: "var(--spark-faint, rgba(var(--spark-ink-rgb),0.38))" }}
          >
            {loadingMore ? "LOADING MORE…" : "SCROLL FOR MORE"}
          </p>
        </div>
      )}
    </div>
  );
};

/* ─────────────────────────── PAGE ────────────────────────────── */

const RmmFilterInner: React.FC<{
  tenantId: string;
  value: string;
  onChange: (v: string) => void;
  onRmms: (rmms: Mentionable[]) => void;
}> = ({ tenantId, value, onChange, onRmms }) => {
  const data = useLazyLoadQuery<RmmClientsQueryType>(
    RmmClientsQuery,
    { tenantId },
    { fetchPolicy: "store-or-network" },
  );
  const rmms = useMemo(
    () => (data?.rmmClients ?? []).filter(Boolean),
    [data],
  );
  useEffect(() => {
    onRmms(
      rmms.map((r) => ({
        id: String(r!.id),
        name:
          [r!.firstName, r!.lastName].filter(Boolean).join(" ") ||
          r!.username ||
          "RMM",
        email: r!.username ?? "rmm@spark.app",
      })),
    );
  }, [rmms, onRmms]);

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg text-xs"
      style={{
        padding: "0.28rem 0.65rem",
        minHeight: 30,
        background: "var(--spark-bg)",
        border: "1px solid var(--spark-border)",
        color: "var(--spark-text)",
        maxWidth: 200,
        outline: "none",
      }}
    >
      <option value="all">All RMMs</option>
      {rmms.map((r) =>
        r ? (
          <option key={r.id} value={String(r.id)}>
            {[r.firstName, r.lastName].filter(Boolean).join(" ") ||
              r.username}
          </option>
        ) : null,
      )}
    </select>
  );
};

/**
 * Consumers-sampled KPI, isolated in its OWN query boundary.
 *
 * `eventDashboard` is the heaviest query on this page and scales with tenant
 * size (worst on big tenants like Liquid Death). It used to be fetched in the
 * MasterTracker body — and because the app has a single router-level Suspense
 * boundary, that suspension BLOCKED THE WHOLE PAGE (the rows included) on every
 * cold load / hard refresh, purely to fill this one number. Isolated here it
 * suspends only this stat: the table + the rest of the totals strip paint
 * immediately and this figure streams in behind a "…" placeholder.
 */
const ConsumersStat: React.FC<{ tenantId: string }> = ({ tenantId }) => {
  const consumers = useConsumersSampled(tenantId, 0);
  return <CountReel value={consumers} />;
};

/**
 * FIRST-TIME strip — same isolation pattern as ConsumersStat. Pulled from
 * tenantKpis so custom-recap "First Time …" fields (Torch, LD, etc.) count.
 * Renders "—" when the tenant has no first-time signal yet (honest empty).
 */
const FirstTimeStat: React.FC<{ tenantId: string }> = ({ tenantId }) => {
  const firstTime = useFirstTimeConsumers(tenantId, 0);
  return firstTime == null ? "—" : <CountReel value={firstTime} />;
};

/**
 * PRODUCTS PURCHASED strip — tenantKpis.productsSold (same soldUnits matcher
 * as Insights / recap list: cans/packs primary, purchase/sold fallback).
 * Torch: single cans + packs purchased fields. Honest "—" when empty.
 */
const ProductsPurchasedStat: React.FC<{ tenantId: string }> = ({
  tenantId,
}) => {
  const purchased = useProductsPurchased(tenantId, 0);
  return purchased == null ? "—" : <CountReel value={purchased} />;
};

export default function MasterTracker() {
  const navigate = useNavigate();
  const { tenantId, tenantSlug, tenantMeta } = useAuthStore();
  const torchProgram = isTorchTenant(tenantSlug, tenantMeta?.requestUrlName);
  const { isClient, isAdmin } = useSparkRole();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialUrlState = parseTrackerUrlParams(searchParams);
  const [activeStatus, setActiveStatus] = useState<string>(
    initialUrlState.status,
  );
  const [groupBy, setGroupBy] = useState<TrackerGroupBy>("none");
  const [search, setSearch] = useState<string>("");
  const [cancelDemoOpen, setCancelDemoOpen] = useState(false);
  const [rmmFilter, setRmmFilter] = useState<string>("all");
  const [rmmList, setRmmList] = useState<Mentionable[]>([]);
  const [adminList, setAdminList] = useState<Mentionable[]>([]);
  // Defer UsersQuery until someone expands Notes — most tracker visits
  // never open the @-mention panel.
  const [needAdminRoster, setNeedAdminRoster] = useState(false);
  const [visibleRows, setVisibleRows] = useState<Row[]>([]);
  // Date-range / scheduling filters are applied server-side via
  // RequestFiltersInput (see masterTrackerFilters.ts + trackerStatusCounts).
  const [dateRange, setDateRange] = useState<TrackerDateRange>(
    initialUrlState.dateRange,
  );
  const [customRange, setCustomRange] =
    useState<TrackerCustomRange | null>(initialUrlState.customRange);
  // Client-side sort for venue / status urgency; date sort is server-side.
  const [sortMode, setSortMode] = useState<
    "date-desc" | "date-asc" | "venue" | "status"
  >("date-desc");
  // Market filter — options come from trackerStatusCounts.marketCodes.
  // `?market=CA` from Insights geo drill pre-selects a state.
  // `?plan=<id>` from Activation Plan detail scopes rows to that plan.
  const [marketFilter, setMarketFilter] = useState<string>(
    initialUrlState.market,
  );
  const [planId, setPlanId] = useState<string | null>(initialUrlState.planId);

  const statusParam = searchParams.get("status");
  const whenParam = searchParams.get("when");
  const marketParam = searchParams.get("market");
  const planParam = searchParams.get("plan");
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  useEffect(() => {
    const parsed = parseTrackerUrlParams(searchParams);
    setActiveStatus(parsed.status);
    setDateRange(parsed.dateRange);
    setCustomRange(parsed.customRange);
    setMarketFilter(parsed.market);
    setPlanId(parsed.planId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusParam, whenParam, marketParam, planParam, fromParam, toParam]);

  const [markets, setMarkets] = useState<string[]>([]);
  // Scheduling-status filter — server-side via schedulingStatus.
  const [schedulingFilter, setSchedulingFilter] = useState<string>("all");

  const updateStatusFilter = (nextStatus: string) => {
    setActiveStatus(nextStatus);
    setSearchParams(
      buildTrackerUrlParams(searchParams, { status: nextStatus }),
      { replace: true },
    );
  };
  const updateDateRangeFilter = (nextRange: TrackerDateRange) => {
    setDateRange(nextRange);
    if (nextRange !== "custom") setCustomRange(null);
    setSearchParams(
      buildTrackerUrlParams(searchParams, { dateRange: nextRange }),
      { replace: true },
    );
  };
  const updateMarketFilter = (nextMarket: string) => {
    setMarketFilter(nextMarket);
    setSearchParams(
      buildTrackerUrlParams(searchParams, { market: nextMarket }),
      { replace: true },
    );
  };
  const clearPlanFilter = () => {
    setPlanId(null);
    setSearchParams(
      buildTrackerUrlParams(searchParams, { planId: null }),
      { replace: true },
    );
  };
  const setPlanFilter = (nextPlanId: string | null) => {
    setPlanId(nextPlanId);
    setSearchParams(
      buildTrackerUrlParams(searchParams, { planId: nextPlanId }),
      { replace: true },
    );
  };

  // Saved views — everything a "view" captures, and how to re-apply one.
  // Unknown/missing keys fall back to each filter's default so an old
  // saved view survives future filter additions.
  const viewSnapshot = useMemo<TrackerViewSnapshot>(
    () => ({
      activeStatus,
      groupBy,
      search,
      rmmFilter,
      dateRange,
      sortMode,
      marketFilter,
      schedulingFilter,
    }),
    [
      activeStatus,
      groupBy,
      search,
      rmmFilter,
      dateRange,
      sortMode,
      marketFilter,
      schedulingFilter,
    ],
  );
  const applyView = (v: TrackerViewSnapshot) => {
    const nextStatus = v.activeStatus ?? "active";
    const foundRange =
      VALID_TRACKER_DATE_RANGES.find((d) => d === v.dateRange) ?? "all";
    // Saved views don't capture custom from/to bounds, so a stored
    // "custom" would have no range to apply — fall back to all dates.
    const nextRange = foundRange === "custom" ? "all" : foundRange;
    const nextMarket = v.marketFilter ?? "all";
    setActiveStatus(nextStatus);
    setGroupBy(
      v.groupBy === "date" || v.groupBy === "rmm" ? v.groupBy : "none",
    );
    setSearch(v.search ?? "");
    setRmmFilter(v.rmmFilter ?? "all");
    setDateRange(nextRange);
    setSortMode(
      (["date-desc", "date-asc", "venue", "status"] as const).find(
        (m) => m === v.sortMode,
      ) ?? "date-desc",
    );
    setMarketFilter(nextMarket);
    setCustomRange(null);
    setSchedulingFilter(v.schedulingFilter ?? "all");
    setSearchParams(
      buildTrackerUrlParams(searchParams, {
        status: nextStatus,
        dateRange: nextRange,
        market: nextMarket,
      }),
      { replace: true },
    );
  };
  // Source row for the "⎘ Clone ×N" modal. null = closed.
  const [cloneSource, setCloneSource] = useState<{
    id: string;
    label: string;
  } | null>(null);
  // Source event for the "✚ Assign BA" modal (InviteBAModal). null = closed.
  const [assignBaSource, setAssignBaSource] = useState<{
    eventId: string;
    eventDate: string | null;
    eventAddress: string | null;
  } | null>(null);
  // Source event for the "📣 Post to board" modal (PostToBoardModal). null = closed.
  const [postBoardSource, setPostBoardSource] = useState<{
    eventId: string;
    eventName: string | null;
  } | null>(null);
  // Source request for the "🗑 Delete" confirm modal (DeleteRequestModal).
  // Holds the request's Relay id (deleteRequest resolves it to a PK) + a
  // friendly label for the confirm copy. null = closed.
  const [deleteSource, setDeleteSource] = useState<{
    id: string;
    label: string;
  } | null>(null);
  // Bump to force MasterTrackerInner to refetch after a successful
  // clone so the new requests show up immediately.
  const [refetchTick, setRefetchTick] = useState(0);
  // Multi-select for Add to plan / Remove from plan.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    setSelectedIds(new Set());
  }, [planId, activeStatus, search, rmmFilter, dateRange, marketFilter, schedulingFilter]);
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  // CSV export of the currently-visible tracker rows. Quotes any field
  // containing commas/quotes/newlines. Filename includes the status
  // filter + date so kyle gets a self-describing download.
  const exportCsv = () => {
    if (visibleRows.length === 0) {
      window.alert("Nothing to export.");
      return;
    }
    const header = [
      "Date",
      "Requested time",
      "Status",
      "Market",
      "Venue",
      "Address",
      "Type",
      "SKUs",
      "RMM",
      "Scheduling",
      "Non-Active Product",
      "Recap",
      "Recap Count",
      "Event UUID",
      "Request UUID",
    ];
    const esc = (raw: string) => {
      const s = (raw ?? "").toString();
      if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const lines = [header.join(",")];
    for (const r of visibleRows) {
      lines.push(
        [
          r.dateLabel,
          r.timeLabel,
          r.statusSlug,
          r.market,
          r.venue,
          r.address,
          r.type,
          r.skus.join("; "),
          r.rmmLabel,
          r.schedulingStatus
            ? (SCHEDULING_LABEL[r.schedulingStatus] ?? r.schedulingStatus)
            : "",
          r.isNonActiveProductRequired == null
            ? ""
            : r.isNonActiveProductRequired
              ? "Yes"
              : "No",
          r.recapStatus,
          String(r.recapCount),
          r.eventUuid ?? "",
          r.uuid,
        ]
          .map(esc)
          .join(","),
      );
    }
    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const today = new Date().toISOString().slice(0, 10);
    a.download = `spark-tracker-${activeStatus}-${today}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Copy the currently-visible rows to clipboard as TSV (tab-
  // separated). Pasted directly into a Google Sheet cell, Sheets
  // parses the tabs as column boundaries and lays the rows out
  // correctly — no Import dialog needed. Fast path to keep the
  // linked sheet in sync with the live tracker.
  const [copyState, setCopyState] = useState<"idle" | "copying" | "copied">(
    "idle",
  );
  const copyForSheets = async () => {
    if (visibleRows.length === 0 || copyState !== "idle") return;
    setCopyState("copying");
    const headers = [
      "Date",
      "Requested time",
      "Status",
      "Market",
      "Venue",
      "Address",
      "Type",
      "SKUs",
      "RMM",
      "Scheduling",
      "Non-Active Product",
      "Recap",
      "Recap Count",
      "Event UUID",
      "Request UUID",
    ];
    const sanitize = (raw: string) =>
      (raw ?? "").toString().replace(/\t/g, " ").replace(/\r?\n/g, " ");
    const rows = [headers.join("\t")];
    for (const r of visibleRows) {
      rows.push(
        [
          r.dateLabel,
          r.timeLabel,
          r.statusSlug,
          r.market,
          r.venue,
          r.address,
          r.type,
          r.skus.join("; "),
          r.rmmLabel,
          r.schedulingStatus
            ? (SCHEDULING_LABEL[r.schedulingStatus] ?? r.schedulingStatus)
            : "",
          r.isNonActiveProductRequired == null
            ? ""
            : r.isNonActiveProductRequired
              ? "Yes"
              : "No",
          r.recapStatus,
          String(r.recapCount),
          r.eventUuid ?? "",
          r.uuid,
        ]
          .map(sanitize)
          .join("\t"),
      );
    }
    try {
      await navigator.clipboard.writeText(rows.join("\n"));
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 2000);
    } catch {
      setCopyState("idle");
      window.alert(
        "Couldn't access the clipboard. Try the CSV download instead.",
      );
    }
  };
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [total, setTotal] = useState<number>(0);

  const handleCounts = useMemo(
    () =>
      (next: Record<string, number>, nextTotal: number) => {
        setCounts(next);
        setTotal(nextTotal);
      },
    [],
  );

  // NOTE: the heavy `eventDashboard` aggregation (consumers-sampled KPI) is no
  // longer fetched here — it moved into <ConsumersStat>, isolated in its own
  // Suspense boundary, so it can't block the whole page on a cold load. See the
  // component's docstring.

  // Per-tenant linked Google Sheet — kyle's brief: "Link the master
  // tracker to a living breathing google sheet file. Per-client."
  // Stored in localStorage keyed by tenantId so each brand can point
  // at its own sheet (e.g. the Liquid Death sheet kyle shared). Real
  // Backend-backed via useLinkedSheetUrl — tenant.linkedSheetUrl
  // replaces the per-device localStorage that lived here. The hook
  // handles the one-time migration when a tenant has a localStorage
  // value but no backend value yet.
  const { url: linkedSheetUrl, setUrl: persistLinkedSheet } =
    useLinkedSheetUrl();
  const [editingSheet, setEditingSheet] = useState(false);
  const [sheetDraft, setSheetDraft] = useState(linkedSheetUrl);
  useEffect(() => {
    setSheetDraft(linkedSheetUrl);
  }, [linkedSheetUrl]);

  const saveLinkedSheet = async (raw: string) => {
    const res = await persistLinkedSheet(raw);
    if (!res.ok && res.message) {
      window.alert(res.message);
    }
  };

  return (
    <Layout>
      <div className="spark-page spark-page-wide spark-tracker-page spark-fade-in">
        <SparkPageHeader
          className="spark-tracker-header"
          titleClassName="text-3xl md:text-4xl font-bold"
          eyebrow={isClient ? "YOUR EVENTS" : "ALL EVENTS · ONE TABLE"}
          title={isClient ? "My requests." : "Master tracker."}
          support={
            isClient
              ? "Every request you've submitted, with live status updates from your RMM."
              : "Every event, every status, every recap link."
          }
          action={
            <>
            {linkedSheetUrl ? (
              <a
                href={linkedSheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="spark-btn-ghost"
                style={{
                  color: "var(--spark-sky)",
                  borderColor: "rgba(95,184,239,0.35)",
                }}
                title="Open the brand's linked Google Sheet in a new tab"
              >
                Linked sheet ↗
              </a>
            ) : null}
            <SparkGhostButton
              onClick={() => {
                setSheetDraft(linkedSheetUrl);
                setEditingSheet(true);
              }}
              title="Link this brand to a Google Sheet for tracking"
            >
              {linkedSheetUrl ? "Edit sheet link" : "+ Link sheet"}
            </SparkGhostButton>
            <SparkGhostButton onClick={() => navigate("/requests/bulk-upload")}>
              Bulk upload
            </SparkGhostButton>
            <SparkGhostButton
              onClick={copyForSheets}
              disabled={visibleRows.length === 0 || copyState === "copying"}
              title={
                visibleRows.length === 0
                  ? "Nothing to copy"
                  : `Copy ${visibleRows.length} rows as TSV — paste straight into Google Sheets`
              }
            >
              {copyState === "copied"
                ? `Copied (${visibleRows.length})`
                : copyState === "copying"
                  ? "Copying…"
                  : `Copy for Sheets${visibleRows.length > 0 ? ` (${visibleRows.length})` : ""}`}
            </SparkGhostButton>
            <SparkGhostButton
              onClick={exportCsv}
              disabled={visibleRows.length === 0}
              title={
                visibleRows.length === 0
                  ? "Nothing to export"
                  : `Download ${visibleRows.length} rows as CSV`
              }
            >
              Export CSV{visibleRows.length > 0 ? ` (${visibleRows.length})` : ""}
            </SparkGhostButton>
            <SparkGhostButton onClick={() => setCancelDemoOpen(true)}>
              Cancel event
            </SparkGhostButton>
            <SparkPrimaryButton
              onClick={() =>
                navigate(
                  planId
                    ? `/requests/create?plan=${encodeURIComponent(planId)}`
                    : "/requests/create",
                )
              }
            >
              {isClient ? "+ Submit request" : "Create Request"}
            </SparkPrimaryButton>
            </>
          }
        />

        {torchProgram ? <ProgramSwitch active="retail" /> : null}

        <div className="sticky top-0 z-20 flex flex-col spark-sticky-filters spark-tracker-filters">
        <SparkFilterBar
          label="STATUS"
          search={
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search venue, address, market, or REQ-…"
              className="spark-filter-search"
            />
          }
          trailing={
            <>
              <div className="pill-group">
                <button
                  onClick={() => setGroupBy("none")}
                  className={`pill-btn ${groupBy === "none" ? "on" : ""}`}
                >
                  Flat
                </button>
                <button
                  onClick={() => setGroupBy("date")}
                  className={`pill-btn ${groupBy === "date" ? "on" : ""}`}
                >
                  By date
                </button>
                <button
                  onClick={() => setGroupBy("rmm")}
                  className={`pill-btn ${groupBy === "rmm" ? "on" : ""}`}
                >
                  By RMM
                </button>
              </div>
              <TrackerSavedViews snapshot={viewSnapshot} onApply={applyView} />
              <DuplicateEventsButton />
              {tenantId && (
                <Suspense fallback={null}>
                  <RmmFilterInner
                    tenantId={tenantId}
                    value={rmmFilter}
                    onChange={setRmmFilter}
                    onRmms={setRmmList}
                  />
                </Suspense>
              )}
            </>
          }
        >
          {STATUS_FILTERS.map((f) => {
            const n =
              f.key === "all"
                ? total
                : f.key === "active"
                  ? (counts.pending ?? 0) +
                    (counts.queue ?? 0) +
                    (counts.approved ?? 0) +
                    (counts.scheduled ?? 0)
                  : (counts[f.key] ?? 0);
            const active = f.key === activeStatus;
            return (
              <button
                key={f.key}
                onClick={() => updateStatusFilter(f.key)}
                className={f.chip}
                style={
                  active
                    ? { outline: "1.5px solid currentColor", outlineOffset: 0 }
                    : undefined
                }
              >
                {f.key !== "all" && f.key !== "active" && "● "}
                {f.label} · {n}
              </button>
            );
          })}
        </SparkFilterBar>

        <SparkFilterBar label="REFINE">
          <FilterSelect
            label="WHEN"
            value={dateRange}
            onChange={(v) => updateDateRangeFilter(v as TrackerDateRange)}
            options={[
              { value: "all", label: "All dates" },
              { value: "next7", label: "Next 7 days" },
              { value: "next30", label: "Next 30 days" },
              { value: "next90", label: "Next 90 days" },
              { value: "month", label: "This month" },
              { value: "past7", label: "Past 7 days" },
              { value: "past30", label: "Past 30 days" },
              ...(dateRange === "custom" && customRange
                ? [
                    {
                      value: "custom",
                      label: `Custom · ${customRange.startDate} → ${customRange.endDate}`,
                    },
                  ]
                : []),
            ]}
          />
          <FilterSelect
            label="MARKET"
            value={marketFilter}
            onChange={updateMarketFilter}
            options={[
              { value: "all", label: "All markets" },
              ...markets.map((m) => ({ value: m, label: m })),
            ]}
          />
          <TrackerPlanFilter
            tenantId={tenantId}
            planId={planId}
            onChange={setPlanFilter}
          />
          <FilterSelect
            label="STAFFING"
            value={schedulingFilter}
            onChange={setSchedulingFilter}
            options={[
              { value: "all", label: "All scheduling" },
              { value: "already_scheduled", label: "Already scheduled" },
              { value: "needs_scheduling", label: "Needs scheduling" },
              { value: STAFFING_UNSTAFFED, label: "No ambassador assigned" },
              { value: STAFFING_STAFFED, label: "Ambassador assigned" },
            ]}
          />
          <FilterSelect
            label="SORT"
            value={sortMode}
            onChange={(v) =>
              setSortMode(v as "date-desc" | "date-asc" | "venue" | "status")
            }
            options={[
              { value: "date-desc", label: "Date · newest" },
              { value: "date-asc", label: "Date · oldest" },
              { value: "venue", label: "Venue · A → Z" },
              { value: "status", label: "Status · urgency" },
            ]}
          />
          {(dateRange !== "all" ||
            customRange !== null ||
            marketFilter !== "all" ||
            schedulingFilter !== "all" ||
            sortMode !== "date-desc" ||
            planId) && (
            <button
              onClick={() => {
                setDateRange("all");
                setCustomRange(null);
                setMarketFilter("all");
                setSchedulingFilter("all");
                setSortMode("date-desc");
                setPlanId(null);
                setSearchParams(
                  buildTrackerUrlParams(searchParams, {
                    dateRange: "all",
                    market: "all",
                    planId: null,
                  }),
                  { replace: true },
                );
              }}
              className="mono text-[10px] px-3 py-1.5 rounded-xl"
              style={{
                letterSpacing: "0.16em",
                color: "var(--spark-muted, rgba(var(--spark-ink-rgb),0.5))",
                border: "1px solid var(--spark-border)",
                background: "transparent",
              }}
            >
              × RESET REFINE
            </button>
          )}
        </SparkFilterBar>
        </div>

        {planId ? (
          <div
            className="spark-card px-4 py-3 flex flex-wrap items-center justify-between gap-2"
            style={{
              borderColor: "rgba(var(--spark-accent-rgb),0.35)",
              background: "rgba(var(--spark-accent-rgb),0.06)",
            }}
          >
            <p
              className="mono text-[10px]"
              style={{
                letterSpacing: "0.14em",
                color: "var(--spark-lime)",
              }}
            >
              PLAN FILTER · SHOWING REQUESTS ON THIS ACTIVATION PLAN
            </p>
            <div className="flex gap-2">
              <Link
                to={torchProgram ? "/field-marketing" : "/plans"}
                className="mono text-[10px]"
                style={{
                  letterSpacing: "0.12em",
                  color: "var(--spark-muted, rgba(var(--spark-ink-rgb),0.5))",
                }}
              >
                {torchProgram ? "PLANS" : "ALL PLANS"}
              </Link>
              <button
                type="button"
                onClick={clearPlanFilter}
                className="mono text-[10px]"
                style={{
                  letterSpacing: "0.12em",
                  color: "var(--spark-muted, rgba(var(--spark-ink-rgb),0.5))",
                }}
              >
                × CLEAR
              </button>
            </div>
          </div>
        ) : null}

        {/* Totals strip — shadcn-admin-style KPI lockup under filters */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 spark-tracker-kpis">
          <div className="spark-card p-3">
            <p className="label-mini">SCHEDULED</p>
            <p
              className="tab-num text-2xl font-bold mt-1"
              style={{ color: "var(--spark-lime)" }}
              title="Master Tracker requests (all statuses). Insights 'events' count only those with filed recaps."
            >
              {/* Match the status chips (all-time, this tenant). Distinct from
                  Insights Program KPIs events (= activations that produced a
                  recap). */}
              <CountReel value={total} />
            </p>
            <p
              className="mono text-[9px] mt-1"
              style={{
                letterSpacing: "0.12em",
                color: "var(--spark-faint, rgba(var(--spark-ink-rgb),0.38))",
              }}
            >
              TRACKER REQUESTS
            </p>
          </div>
          <div className="spark-card p-3">
            <p className="label-mini">CONSUMERS</p>
            <p className="tab-num text-2xl font-bold mt-1">
              {tenantId ? (
                <Suspense
                  fallback={<span style={{ opacity: 0.4 }}>…</span>}
                >
                  <ConsumersStat tenantId={tenantId} />
                </Suspense>
              ) : (
                "—"
              )}
            </p>
            <p
              className="mono text-[9px] mt-1"
              style={{
                letterSpacing: "0.12em",
                color: "var(--spark-faint, rgba(var(--spark-ink-rgb),0.38))",
              }}
              title="Program-to-date, same numbers as Insights. Not narrowed by the tracker filters above."
            >
              ALL-TIME · ALL MARKETS
            </p>
          </div>
          <div className="spark-card p-3">
            <p className="label-mini">FIRST-TIME</p>
            <p className="tab-num text-2xl font-bold mt-1">
              {tenantId ? (
                <Suspense
                  fallback={<span style={{ opacity: 0.4 }}>…</span>}
                >
                  <FirstTimeStat tenantId={tenantId} />
                </Suspense>
              ) : (
                "—"
              )}
            </p>
            <p
              className="mono text-[9px] mt-1"
              style={{
                letterSpacing: "0.12em",
                color: "var(--spark-faint, rgba(var(--spark-ink-rgb),0.38))",
              }}
              title="Program-to-date, same numbers as Insights. Not narrowed by the tracker filters above."
            >
              ALL-TIME · ALL MARKETS
            </p>
          </div>
          <div className="spark-card p-3">
            <p className="label-mini">PRODUCTS PURCHASED</p>
            <p className="tab-num text-2xl font-bold mt-1">
              {tenantId ? (
                <Suspense
                  fallback={<span style={{ opacity: 0.4 }}>…</span>}
                >
                  <ProductsPurchasedStat tenantId={tenantId} />
                </Suspense>
              ) : (
                "—"
              )}
            </p>
            <p
              className="mono text-[9px] mt-1"
              style={{
                letterSpacing: "0.12em",
                color: "var(--spark-faint, rgba(var(--spark-ink-rgb),0.38))",
              }}
              title="Program-to-date, same numbers as Insights. Not narrowed by the tracker filters above."
            >
              ALL-TIME · ALL MARKETS
            </p>
          </div>
        </div>

        {/* Background loader: populates the @-mention roster with the
            tenant's real admins. Only mounts after Notes is expanded so
            cold tracker visits skip the Users query. */}
        {tenantId && needAdminRoster && (
          <Suspense fallback={null}>
            <AdminMentionablesLoader
              tenantId={tenantId}
              onLoaded={setAdminList}
            />
          </Suspense>
        )}

        {tenantId && (
          <Suspense fallback={null}>
            <TrackerStatusCountsLoader
              tenantId={tenantId}
              search={search}
              rmmFilter={rmmFilter}
              dateRange={dateRange}
              customRange={customRange}
              marketFilter={marketFilter}
              schedulingFilter={schedulingFilter}
              planId={planId}
              refreshKey={refetchTick}
              onCounts={handleCounts}
              onMarkets={setMarkets}
            />
          </Suspense>
        )}

        {/* Table */}
        {isAdmin && selectedIds.size > 0 ? (
          <TrackerBulkBar
            rows={visibleRows
              .filter((r) => selectedIds.has(r.id))
              .map((r) => ({ id: r.id, statusSlug: r.statusSlug, eventId: r.eventId }))}
            onDone={() => {
              clearSelection();
              setRefetchTick((t) => t + 1);
            }}
          />
        ) : null}
        {isAdmin && tenantId && selectedIds.size > 0 ? (
          <TrackerPlanAttachBar
            tenantId={tenantId}
            planId={planId}
            selectedIds={[...selectedIds]}
            onClear={clearSelection}
            onDone={() => {
              clearSelection();
              setRefetchTick((t) => t + 1);
            }}
          />
        ) : null}
        <Suspense
          fallback={
            <div
              className="spark-card p-8 text-center text-sm"
              style={{ color: "var(--spark-muted, rgba(var(--spark-ink-rgb),0.5))" }}
            >
              Loading events…
            </div>
          }
        >
          <MasterTrackerInner
            key={refetchTick}
            listRefreshKey={refetchTick}
            activeStatus={activeStatus}
            search={search}
            rmmFilter={rmmFilter}
            groupBy={groupBy}
            dateRange={dateRange}
            customRange={customRange}
            sortMode={sortMode}
            marketFilter={marketFilter}
            schedulingFilter={schedulingFilter}
            planId={planId}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            selectionEnabled={isAdmin}
            mentionables={[
              ...rmmList,
              ...(adminList.length > 0 ? adminList : ADMIN_ROSTER_FALLBACK),
            ]}
            onNotesOpened={() => setNeedAdminRoster(true)}
            onVisibleRowsChange={setVisibleRows}
            onClone={(row) =>
              setCloneSource({
                id: row.uuid,
                label: `${row.venue || "Request"} · ${row.dateLabel}`,
              })
            }
            onAssignBa={(row) => {
              if (row.eventId)
                setAssignBaSource({
                  eventId: row.eventId,
                  eventDate: row.eventDate,
                  eventAddress: row.eventAddress,
                });
            }}
            onPostBoard={(row) => {
              if (row.eventId)
                setPostBoardSource({
                  eventId: row.eventId,
                  eventName: row.venue ?? null,
                });
            }}
            onDelete={(row) =>
              setDeleteSource({
                id: row.id,
                label: `${row.venue || "Request"} · ${row.dateLabel}`,
              })
            }
          />
        </Suspense>
      </div>

      {/* Bulk-clone modal — triggered by the ⎘ CLONE row action.
          Reuses the source request's venue / BAs / RMM / type and
          stamps N new requests with the dates the user enters. */}
      {cloneSource && (
        <BulkCloneModal
          sourceRequestId={cloneSource.id}
          sourceLabel={cloneSource.label}
          onClose={() => setCloneSource(null)}
          onCloned={() => {
            setCloneSource(null);
            setRefetchTick((t) => t + 1);
          }}
        />
      )}

      {/* Assign-BA modal — triggered by the ✚ ASSIGN BA row action.
          Reuses the shared InviteBAModal so the admin can pick a BA
          and fire a shift offer for this row's event. */}
      {assignBaSource && (
        // InviteBAModal loads the BA list via useLazyLoadQuery (it suspends).
        // Without a Suspense boundary here the whole page blanks while it
        // loads; the boundary keeps the suspension local to the modal.
        <Suspense
          fallback={
            <div
              className="fixed inset-0 z-[60] flex items-center justify-center"
              style={{
                background: "rgba(10,11,13,0.7)",
                backdropFilter: "blur(8px)",
              }}
            >
              <span
                className="mono text-[11px]"
                style={{ letterSpacing: "0.16em", color: "var(--spark-text-secondary)" }}
              >
                LOADING BAs…
              </span>
            </div>
          }
        >
          <InviteBAModal
            eventId={assignBaSource.eventId}
            eventDate={assignBaSource.eventDate}
            eventAddress={assignBaSource.eventAddress}
            onClose={() => setAssignBaSource(null)}
            onInvited={() => setAssignBaSource(null)}
          />
        </Suspense>
      )}

      {/* Post-to-board modal — triggered by the 📣 POST TO BOARD row
          action. Posts this row's event job to the public BA board via
          the postEventToBoard mutation so any eligible BA can apply. */}
      {postBoardSource && (
        <PostToBoardModal
          eventId={postBoardSource.eventId}
          eventName={postBoardSource.eventName}
          onClose={() => setPostBoardSource(null)}
          onPosted={() => setPostBoardSource(null)}
        />
      )}

      {/* Delete-gig confirm modal — triggered by the 🗑 DELETE row action.
          Soft-deletes the request via deleteRequest, then refetches so the
          row drops off the tracker immediately. */}
      {deleteSource && (
        <DeleteRequestModal
          requestId={deleteSource.id}
          label={deleteSource.label}
          onClose={() => setDeleteSource(null)}
          onDeleted={() => {
            setDeleteSource(null);
            setRefetchTick((t) => t + 1);
          }}
        />
      )}

      {/* Linked-sheet config modal. URL persists per-tenant in
          localStorage. Backend round-trip lands when the sheets-
          sync integration ships. */}
      {editingSheet && (
        <div
          onClick={() => setEditingSheet(false)}
          className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[10vh]"
          style={{
            background: "rgba(10,11,13,0.7)",
            backdropFilter: "blur(8px)",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl spark-card p-6"
            style={{ borderRadius: 20 }}
          >
            <p
              className="mono text-[10px] mb-1"
              style={{
                letterSpacing: "0.18em",
                color: "var(--spark-sky)",
              }}
            >
              LINKED GOOGLE SHEET
            </p>
            <h2
              className="display text-2xl font-bold"
              style={{ letterSpacing: "-0.03em" }}
            >
              Tie this brand to a Sheet.
            </h2>
            <p
              className="text-sm mt-2"
              style={{ color: "var(--spark-text-secondary)", lineHeight: 1.55 }}
            >
              Paste the full Google Sheets URL for this brand's
              tracker. The whole team will see the deep-link in the
              tracker header. To push fresh data to the sheet, use{" "}
              <strong>Export CSV</strong> and File → Import in Sheets.
              Auto-append status (last sync, errors) lives in{" "}
              <Link to="/settings" className="underline" style={{ color: "var(--spark-lime)" }}>
                Settings
              </Link>
              .
            </p>
            <input
              autoFocus
              type="url"
              value={sheetDraft}
              onChange={(e) => setSheetDraft(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/.../edit"
              className="w-full mt-4 rounded-xl px-3 py-2 text-sm"
              style={{
                background: "var(--spark-bg)",
                border: "1px solid var(--spark-border)",
                color: "var(--spark-text)",
              }}
            />
            {sheetDraft && !sheetDraft.includes("docs.google.com") && (
              <p
                className="mono text-[10px] mt-2"
                style={{
                  letterSpacing: "0.14em",
                  color: "var(--spark-orange)",
                }}
              >
                THAT DOESN'T LOOK LIKE A GOOGLE SHEETS URL
              </p>
            )}
            <div className="flex justify-between gap-2 mt-5 flex-wrap">
              {linkedSheetUrl && (
                <button
                  type="button"
                  onClick={() => {
                    saveLinkedSheet("");
                    setSheetDraft("");
                    setEditingSheet(false);
                  }}
                  className="mono text-[10px]"
                  style={{
                    letterSpacing: "0.14em",
                    color: "var(--spark-orange)",
                  }}
                >
                  × REMOVE LINK
                </button>
              )}
              <div className="flex gap-2 ml-auto">
                <button
                  type="button"
                  onClick={() => setEditingSheet(false)}
                  className="mono text-[11px] px-3"
                  style={{
                    letterSpacing: "0.14em",
                    color: "var(--spark-muted, rgba(var(--spark-ink-rgb),0.5))",
                  }}
                >
                  CANCEL
                </button>
                <button
                  type="button"
                  onClick={() => {
                    saveLinkedSheet(sheetDraft);
                    setEditingSheet(false);
                  }}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold"
                  style={{
                    background: "var(--spark-sky)",
                    color: "var(--spark-on-accent)",
                  }}
                >
                  Save link
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <CancelDemoDialog
        open={cancelDemoOpen}
        onClose={() => setCancelDemoOpen(false)}
        onSent={() => setRefetchTick((t) => t + 1)}
      />
    </Layout>
  );
}
