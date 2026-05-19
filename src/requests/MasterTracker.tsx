import React, { Suspense, useEffect, useMemo, useState } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import { useNavigate } from "react-router";
import Layout from "@/layout/Layout";
import { RequestsQuery } from "@/api/queries/RequestsQuery";
import type { RequestsQuery as RequestsQueryType } from "@api/queries/__generated__/RequestsQuery.graphql";
import { RmmClientsQuery } from "@/api/queries/RmmClientsQuery";
import type { RmmClientsQuery as RmmClientsQueryType } from "@api/queries/__generated__/RmmClientsQuery.graphql";
import { UsersQuery } from "@/api/queries/UsersQuery";
import type { UsersQuery as UsersQueryType } from "@api/queries/__generated__/UsersQuery.graphql";
import { useEventDashboardData } from "@/hooks/useEventDashboardData";
import { useAuthStore } from "@/store/authStore";
import useSparkRole from "@/hooks/useSparkRole";
import useLinkedSheetUrl from "@/hooks/useLinkedSheetUrl";
import type { DashboardFilters } from "@/components/filters/FiltersPanel";

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
 *   [EVENTS] [CONSUMERS] [FIRST-TIME] [INDIVIDUAL : BULK] [$/SAMPLE]
 *
 *   | DATE | STATUS | MARKET | VENUE | TYPE | CONSUMERS | 1ST-TIME | $/SAMPLE | RECAP |
 *   ...
 */

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

// "Active" = anything not yet completed. Default landing for admins.
const ACTIVE_STATUSES = new Set([
  "pending",
  "queue",
  "approved",
  "scheduled",
]);

const STATUS_FILTERS: { key: string; label: string; chip: string }[] = [
  { key: "active", label: "Active", chip: "chip chip-lime" },
  { key: "pending", label: "Pending", chip: "chip chip-orange" },
  { key: "queue", label: "Queue", chip: "chip chip-gold" },
  { key: "approved", label: "Approved", chip: "chip chip-purple" },
  { key: "scheduled", label: "Scheduled", chip: "chip chip-sky" },
  { key: "done", label: "Done", chip: "chip chip-muted" },
  { key: "all", label: "All", chip: "chip chip-muted" },
];

const fmtNum = (v: number | null | undefined) =>
  typeof v === "number" ? v.toLocaleString() : "0";

type Row = {
  uuid: string;
  date: string;
  dateLabel: string;
  timeLabel: string;
  statusSlug: string;
  market: string;
  venue: string;
  address: string;
  type: string;
  eventUuid: string | null;
};

const fmtDateLabel = (raw: string | null | undefined) => {
  if (!raw) return "—";
  try {
    return new Date(raw).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return raw;
  }
};

const fmtTimeRange = (
  start: string | null | undefined,
  end: string | null | undefined,
) => {
  const tone = (raw: string) => {
    const [h, m] = raw.split(":");
    const hh = parseInt(h ?? "0", 10);
    const ampm = hh >= 12 ? "p" : "a";
    const h12 = ((hh + 11) % 12) + 1;
    return m && m !== "00" ? `${h12}:${m}${ampm}` : `${h12}${ampm}`;
  };
  if (!start && !end) return "";
  if (start && end) return `${tone(start)}–${tone(end)}`;
  return tone(start ?? end ?? "");
};

/* ─────────────────────────── TABLE ────────────────────────────── */

import InternalNotesPanel from "./InternalNotesPanel";

type Mentionable = { id: string; name: string; email: string };

// Fallback roster used only when the live admin lookup hasn't loaded
// yet or returns nothing. Real admins come from the UsersQuery below.
const ADMIN_ROSTER_FALLBACK: Mentionable[] = [
  { id: "kyle", name: "Kyle Christiansen", email: "kyle@igniteproductions.co" },
];

const AdminMentionablesLoader: React.FC<{
  tenantId: string;
  onLoaded: (admins: Mentionable[]) => void;
}> = ({ tenantId, onLoaded }) => {
  const data = useLazyLoadQuery<UsersQueryType>(
    UsersQuery,
    { filters: tenantId ? { tenantId } : null, first: 500 },
    { fetchPolicy: "store-or-network" },
  );
  // Build the @-mention list from real admins (role.name = "admin"
  // or "spark-admin") so notes can tag the actual humans in the
  // workspace instead of the old hardcoded sample names.
  const admins = useMemo(() => {
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
  }, [data]);
  useEffect(() => {
    onLoaded(admins);
  }, [admins, onLoaded]);
  return null;
};

const fmtGroupHeading = (raw: string): string => {
  if (!raw) return "Undated";
  try {
    return new Date(raw).toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return raw;
  }
};

const TrackerTable: React.FC<{
  rows: Row[];
  mentionables: Mentionable[];
  groupBy: "none" | "date";
}> = ({ rows, mentionables, groupBy }) => {
  const navigate = useNavigate();
  const { isClient } = useSparkRole();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  return (
    <div
      className="spark-card overflow-hidden"
      style={{ borderRadius: 20 }}
    >
      <div className="overflow-x-auto">
        <table
          className="w-full text-sm"
          style={{ minWidth: 1200 }}
        >
          <thead
            style={{
              background: "var(--spark-surface-2)",
              borderBottom: "1px solid var(--spark-border)",
            }}
          >
            <tr
              className="text-left mono"
              style={{
                fontSize: 10,
                letterSpacing: "0.14em",
                color: "rgba(255,255,255,0.45)",
              }}
            >
              <th className="px-4 py-3">DATE</th>
              <th className="px-4 py-3">STATUS</th>
              <th className="px-4 py-3">MARKET</th>
              <th className="px-4 py-3">VENUE</th>
              <th className="px-4 py-3">ADDRESS</th>
              <th className="px-4 py-3">TYPE</th>
              <th className="px-4 py-3 text-right">CONSUMERS</th>
              <th className="px-4 py-3 text-right">1ST-TIME</th>
              <th className="px-4 py-3 text-right">$/SAMPLE</th>
              <th className="px-4 py-3">NOTES</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={10}
                  className="px-4 py-10 text-center text-sm"
                  style={{ color: "rgba(255,255,255,0.55)" }}
                >
                  No events match these filters.
                </td>
              </tr>
            )}
            {rows.map((r, rowIdx) => {
              // Date-group headers — insert when the date changes vs the
              // previous row. Rows are already in DB order; for date grouping
              // we rely on that ordering being date-sorted (descending).
              const prevDate = rowIdx > 0 ? rows[rowIdx - 1].date.slice(0, 10) : "";
              const thisDate = r.date.slice(0, 10);
              const showGroupHeader =
                groupBy === "date" && thisDate !== prevDate;
              const headerEl = showGroupHeader ? (
                <tr key={`hdr-${rowIdx}`}>
                  <td
                    colSpan={10}
                    className="px-4 py-3 mono"
                    style={{
                      letterSpacing: "0.16em",
                      fontSize: 11,
                      color: "var(--spark-lime)",
                      background: "rgba(197,245,70,0.04)",
                      borderTop: "1px solid var(--spark-border)",
                      borderBottom: "1px solid var(--spark-border)",
                    }}
                  >
                    {fmtGroupHeading(thisDate).toUpperCase()}
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
                  else next.add(r.uuid);
                  return next;
                });
              };
              // Click target by row state:
              //   done + has event → event detail
              //   done, no event   → recap list
              //   has event row    → event detail
              //   pending / queue  → Spark v2 request DETAIL (not
              //                      the edit form — kyle wants to
              //                      see context first, then edit
              //                      via the Edit button there).
              const onClick = () => {
                if (isDone && r.eventUuid) {
                  navigate(`/event/view/${r.eventUuid}`);
                } else if (isDone) {
                  navigate("/recap/list");
                } else if (r.eventUuid) {
                  navigate(`/event/view/${r.eventUuid}`);
                } else {
                  navigate(`/request/view/${r.uuid}`, {
                    state: { from: "/requests/list" },
                  });
                }
              };
              return (
                <React.Fragment key={r.uuid}>
                {headerEl}
                <tr
                  className="cursor-pointer transition"
                  style={{ borderBottom: "1px solid var(--spark-border)" }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "rgba(255,255,255,0.02)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "transparent")
                  }
                  onClick={onClick}
                >
                  <td
                    className="px-4 py-3 align-top"
                    style={{ color: "rgba(255,255,255,0.85)" }}
                  >
                    <p className="text-sm">{r.dateLabel}</p>
                    {r.timeLabel && (
                      <p
                        className="mono text-[10px] mt-0.5"
                        style={{
                          letterSpacing: "0.14em",
                          color: "rgba(255,255,255,0.45)",
                        }}
                      >
                        {r.timeLabel}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={chipClass}>{label}</span>
                  </td>
                  <td className="px-4 py-3">{r.market}</td>
                  <td className="px-4 py-3 font-medium">{r.venue}</td>
                  <td
                    className="px-4 py-3 text-xs max-w-[280px]"
                    style={{ color: "rgba(255,255,255,0.7)" }}
                  >
                    <span className="line-clamp-2">{r.address || "—"}</span>
                  </td>
                  <td
                    className="px-4 py-3 text-xs"
                    style={{ color: "rgba(255,255,255,0.7)" }}
                  >
                    {r.type}
                  </td>
                  <td
                    className="px-4 py-3 text-right tab-num"
                    style={{
                      color: isDone ? "var(--spark-text)" : "rgba(255,255,255,0.3)",
                    }}
                  >
                    {isDone ? "—" : "—"}
                  </td>
                  <td
                    className="px-4 py-3 text-right tab-num"
                    style={{
                      color: isDone ? "var(--spark-lime)" : "rgba(255,255,255,0.3)",
                    }}
                  >
                    —
                  </td>
                  <td className="px-4 py-3 text-right tab-num">—</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {isClient ? (
                      <span
                        className="mono text-[10px]"
                        style={{
                          letterSpacing: "0.14em",
                          color: "rgba(255,255,255,0.3)",
                        }}
                      >
                        —
                      </span>
                    ) : (
                      <button
                        onClick={toggleExpand}
                        className="mono text-[10px] transition"
                        style={{
                          letterSpacing: "0.14em",
                          color: isExpanded
                            ? "var(--spark-lime)"
                            : "rgba(255,255,255,0.55)",
                        }}
                        title="Internal notes & shipments"
                      >
                        {isExpanded ? "× CLOSE" : "✎ NOTES"}
                      </button>
                    )}
                  </td>
                </tr>
                {isExpanded && !isClient && (
                  <tr style={{ borderBottom: "1px solid var(--spark-border)" }}>
                    <td colSpan={10} style={{ padding: "0.5rem 1rem 1rem" }}>
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

const MasterTrackerInner: React.FC<{
  activeStatus: string;
  search: string;
  rmmFilter: string;
  groupBy: "none" | "date";
  mentionables: Mentionable[];
  onCountsChange: (counts: Record<string, number>, total: number) => void;
  onVisibleRowsChange?: (rows: Row[]) => void;
}> = ({
  activeStatus,
  search,
  rmmFilter,
  groupBy,
  mentionables,
  onCountsChange,
  onVisibleRowsChange,
}) => {
  const { tenantId } = useAuthStore();

  // Fetch a large page so all current requests render. Real pagination
  // with cursor-based "Load more" comes in v2.
  // Tenant scoping is REQUIRED — without it the query returns nothing.
  const data = useLazyLoadQuery<RequestsQueryType>(
    RequestsQuery,
    {
      first: 1000,
      q: search || null,
      filters: tenantId
        ? { tenantId, rmmAsigned: rmmFilter === "all" ? null : rmmFilter }
        : null,
    },
    { fetchPolicy: "store-or-network" },
  );

  const allRows: Row[] = useMemo(() => {
    return (
      data?.requests?.edges
        ?.map((e) => e?.node)
        ?.filter((n): n is NonNullable<typeof n> => Boolean(n))
        ?.map((n) => {
          const stateCode = n.retailer?.location?.state?.code ?? n.state?.code;
          const cityish = n.retailer?.location?.name ?? n.location?.name ?? "";
          const market = [cityish, stateCode].filter(Boolean).join(", ");
          return {
            uuid: String(n.uuid),
            date: n.date ?? "",
            dateLabel: fmtDateLabel(n.date),
            timeLabel: fmtTimeRange(n.startTime, n.endTime),
            statusSlug: (n.status?.slug ?? n.status?.name ?? "pending")
              .toString()
              .toLowerCase(),
            market: market || "—",
            venue: n.retailer?.name ?? n.name ?? "—",
            address: n.address ?? "",
            type: n.requestType?.name ?? "—",
            eventUuid: n.event?.uuid ? String(n.event.uuid) : null,
          };
        }) ?? []
    );
  }, [data, tenantId]);

  // Apply status filter client-side. "active" maps to anything not done.
  const rows = useMemo(() => {
    if (activeStatus === "all") return allRows;
    if (activeStatus === "active")
      return allRows.filter((r) => ACTIVE_STATUSES.has(r.statusSlug));
    return allRows.filter((r) => r.statusSlug === activeStatus);
  }, [allRows, activeStatus]);

  // Tally counts off the unfiltered rows so chips show consistent totals
  // regardless of which status is currently active.
  useMemo(() => {
    const counts: Record<string, number> = {};
    allRows.forEach((r) => {
      counts[r.statusSlug] = (counts[r.statusSlug] ?? 0) + 1;
    });
    const total = data?.requests?.totalCount ?? allRows.length;
    onCountsChange(counts, total);
  }, [allRows, data?.requests?.totalCount, onCountsChange]);

  // Bubble the currently-visible rows up so the outer page can wire
  // them to the CSV export button.
  useEffect(() => {
    if (onVisibleRowsChange) onVisibleRowsChange(rows);
  }, [rows, onVisibleRowsChange]);

  return (
    <TrackerTable rows={rows} mentionables={mentionables} groupBy={groupBy} />
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
      className="rounded-xl text-xs"
      style={{
        padding: "0.45rem 0.9rem",
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

export default function MasterTracker() {
  const navigate = useNavigate();
  const { tenantId } = useAuthStore();
  const { isClient } = useSparkRole();
  const [activeStatus, setActiveStatus] = useState<string>("active");
  // "By RMM" group is on the roadmap — needs rmmAsigned info per row,
  // which requires extending RequestsQuery.
  const [groupBy, setGroupBy] = useState<"none" | "date">("none");
  const [search, setSearch] = useState<string>("");
  const [rmmFilter, setRmmFilter] = useState<string>("all");
  const [rmmList, setRmmList] = useState<Mentionable[]>([]);
  const [adminList, setAdminList] = useState<Mentionable[]>([]);
  const [visibleRows, setVisibleRows] = useState<Row[]>([]);

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
      "Status",
      "Market",
      "Venue",
      "Address",
      "Type",
      "Time",
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
          r.statusSlug,
          r.market,
          r.venue,
          r.address,
          r.type,
          r.timeLabel,
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
      "Status",
      "Market",
      "Venue",
      "Address",
      "Type",
      "Time",
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
          r.statusSlug,
          r.market,
          r.venue,
          r.address,
          r.type,
          r.timeLabel,
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

  const dashFilters: DashboardFilters = useMemo(
    () => ({
      distributorIds: [],
      rmmAsignedId: null,
      quarter: null,
      startDate: null,
      endDate: null,
    }),
    [],
  );
  const { dashboard } = useEventDashboardData(tenantId || "", dashFilters, 0);
  const m = dashboard.metrics;

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
      <div className="space-y-6 max-w-7xl">
        {/* Header */}
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <p
              className="mono text-[10px]"
              style={{
                letterSpacing: "0.18em",
                color: "rgba(255,255,255,0.45)",
              }}
            >
              {isClient ? "YOUR EVENTS" : "ALL EVENTS · ONE TABLE"}
            </p>
            <h1
              className="display text-4xl font-bold mt-2"
              style={{ letterSpacing: "-0.04em" }}
            >
              {isClient ? "My requests." : "Master tracker."}
            </h1>
            <p
              className="mt-2"
              style={{ color: "rgba(255,255,255,0.55)" }}
            >
              {isClient
                ? "Every request you've submitted, with live status updates from your RMM."
                : "Every event, every status, every recap link."}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {/* Linked Google Sheet — per-tenant deep-link. Set once
                per brand and reuse across the team. When set, button
                opens the Sheet in a new tab; otherwise opens the
                config modal. */}
            {linkedSheetUrl ? (
              <a
                href={linkedSheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-xl text-sm font-semibold transition inline-flex items-center gap-2"
                style={{
                  background: "rgba(95,184,239,0.10)",
                  color: "var(--spark-sky)",
                  border: "1px solid rgba(95,184,239,0.35)",
                  textDecoration: "none",
                }}
                title="Open the brand's linked Google Sheet in a new tab"
              >
                📊 Linked sheet ↗
              </a>
            ) : null}
            <button
              type="button"
              onClick={() => {
                setSheetDraft(linkedSheetUrl);
                setEditingSheet(true);
              }}
              className="mono text-[10px] px-3 py-2 rounded-xl"
              style={{
                letterSpacing: "0.18em",
                background: "transparent",
                color: "rgba(255,255,255,0.55)",
                border: "1px solid var(--spark-border)",
              }}
              title="Link this brand to a Google Sheet for tracking"
            >
              {linkedSheetUrl ? "EDIT SHEET LINK" : "+ LINK SHEET"}
            </button>
            <button
              onClick={() => navigate("/requests/bulk-upload")}
              className="px-4 py-2 rounded-xl text-sm font-semibold transition"
              style={{
                background: "transparent",
                color: "var(--spark-text)",
                border: "1px solid var(--spark-border)",
              }}
            >
              ⤴ Bulk upload
            </button>
            <button
              onClick={copyForSheets}
              disabled={visibleRows.length === 0 || copyState === "copying"}
              className="px-4 py-2 rounded-xl text-sm font-semibold transition"
              style={{
                background:
                  copyState === "copied"
                    ? "rgba(95,184,239,0.18)"
                    : "transparent",
                color:
                  copyState === "copied"
                    ? "var(--spark-sky)"
                    : "var(--spark-text)",
                border: `1px solid ${
                  copyState === "copied"
                    ? "rgba(95,184,239,0.5)"
                    : "var(--spark-border)"
                }`,
                opacity: visibleRows.length === 0 ? 0.5 : 1,
              }}
              title={
                visibleRows.length === 0
                  ? "Nothing to copy"
                  : `Copy ${visibleRows.length} rows as TSV — paste straight into Google Sheets`
              }
            >
              {copyState === "copied"
                ? `✓ Copied (${visibleRows.length})`
                : copyState === "copying"
                  ? "Copying…"
                  : `📋 Copy for Sheets ${visibleRows.length > 0 ? `(${visibleRows.length})` : ""}`}
            </button>
            <button
              onClick={exportCsv}
              disabled={visibleRows.length === 0}
              className="px-4 py-2 rounded-xl text-sm font-semibold transition"
              style={{
                background: "transparent",
                color: "var(--spark-text)",
                border: "1px solid var(--spark-border)",
                opacity: visibleRows.length === 0 ? 0.5 : 1,
              }}
              title={
                visibleRows.length === 0
                  ? "Nothing to export"
                  : `Download ${visibleRows.length} rows as CSV`
              }
            >
              ↗ Export CSV {visibleRows.length > 0 ? `(${visibleRows.length})` : ""}
            </button>
            <button
              onClick={() => navigate("/requests/create")}
              className="px-4 py-2 rounded-xl text-sm font-semibold transition"
              style={{
                background: "var(--spark-lime)",
                color: "#0a0d09",
                boxShadow: "0 0 24px rgba(197,245,70,0.35)",
              }}
            >
              {isClient ? "+ Submit request" : "+ Log event"}
            </button>
          </div>
        </div>

        {/* Status chips + group toggle + search */}
        <div className="spark-card p-4 flex flex-wrap items-center gap-2">
          <span className="label-mini mr-2">STATUS</span>
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
                onClick={() => setActiveStatus(f.key)}
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
          <span className="flex-1" />
          {/* Group-by toggle */}
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
          </div>
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
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search venue, address, market…"
            className="rounded-xl text-xs"
            style={{
              padding: "0.45rem 0.9rem",
              background: "var(--spark-bg)",
              border: "1px solid var(--spark-border)",
              color: "var(--spark-text)",
              maxWidth: 240,
              outline: "none",
            }}
          />
        </div>

        {/* Totals strip */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="spark-card p-4">
            <p className="label-mini">EVENTS</p>
            <p
              className="tab-num text-3xl font-bold mt-1"
              style={{ color: "var(--spark-lime)" }}
            >
              {fmtNum(m.totalEvents)}
            </p>
          </div>
          <div className="spark-card p-4">
            <p className="label-mini">CONSUMERS</p>
            <p className="tab-num text-3xl font-bold mt-1">
              {fmtNum(m.consumersSampled)}
            </p>
          </div>
          <div className="spark-card p-4">
            <p className="label-mini">FIRST-TIME</p>
            <p className="tab-num text-3xl font-bold mt-1">—</p>
          </div>
          <div className="spark-card p-4">
            <p className="label-mini">INDIVIDUAL : BULK</p>
            <p className="tab-num text-3xl font-bold mt-1">—</p>
          </div>
          <div className="spark-card p-4">
            <p className="label-mini">$/SAMPLE</p>
            <p
              className="tab-num text-3xl font-bold mt-1"
              style={{ color: "var(--spark-lime)" }}
            >
              —
            </p>
          </div>
        </div>

        {/* Background loader: populates the @-mention roster with the
            tenant's real admins. Suspends inside its own boundary so a
            slow Users query doesn't block the events table from
            rendering. */}
        {tenantId && (
          <Suspense fallback={null}>
            <AdminMentionablesLoader
              tenantId={tenantId}
              onLoaded={setAdminList}
            />
          </Suspense>
        )}

        {/* Table */}
        <Suspense
          fallback={
            <div
              className="spark-card p-8 text-center text-sm"
              style={{ color: "rgba(255,255,255,0.55)" }}
            >
              Loading events…
            </div>
          }
        >
          <MasterTrackerInner
            activeStatus={activeStatus}
            search={search}
            rmmFilter={rmmFilter}
            groupBy={groupBy}
            mentionables={[
              ...rmmList,
              ...(adminList.length > 0 ? adminList : ADMIN_ROSTER_FALLBACK),
            ]}
            onCountsChange={handleCounts}
            onVisibleRowsChange={setVisibleRows}
          />
        </Suspense>
      </div>

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
              style={{ color: "rgba(255,255,255,0.7)", lineHeight: 1.55 }}
            >
              Paste the full Google Sheets URL for this brand's
              tracker. The whole team will see the deep-link in the
              tracker header. To push fresh data to the sheet, use{" "}
              <strong>Export CSV</strong> and File → Import in Sheets
              (a real auto-sync lands when the Sheets backend ships).
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
                    color: "rgba(255,255,255,0.55)",
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
                    color: "#0a0d09",
                  }}
                >
                  Save link
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
