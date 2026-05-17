import { Suspense, useMemo, useState } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import { useNavigate } from "react-router";
import Layout from "@/layout/Layout";
import { RequestsQuery } from "@/api/queries/RequestsQuery";
import type { RequestsQuery as RequestsQueryType } from "@api/queries/__generated__/RequestsQuery.graphql";
import { useEventDashboardData } from "@/hooks/useEventDashboardData";
import { useAuthStore } from "@/store/authStore";
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

const STATUS_FILTERS: { key: string; label: string; chip: string }[] = [
  { key: "all", label: "All", chip: "chip chip-muted" },
  { key: "pending", label: "Pending", chip: "chip chip-orange" },
  { key: "queue", label: "Queue for Ignite", chip: "chip chip-gold" },
  { key: "approved", label: "Approved", chip: "chip chip-purple" },
  { key: "scheduled", label: "Scheduled", chip: "chip chip-sky" },
  { key: "done", label: "Done", chip: "chip chip-lime" },
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

const TrackerTable: React.FC<{ rows: Row[] }> = ({ rows }) => {
  const navigate = useNavigate();
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
              <th className="px-4 py-3">RECAP</th>
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
            {rows.map((r) => {
              const slug = r.statusSlug.toLowerCase();
              const isDone = slug === "done";
              const chipClass = STATUS_CHIP[slug] ?? "chip chip-muted";
              const label = STATUS_LABEL[slug] ?? r.statusSlug.toUpperCase();
              // Past/done rows open the recap area; in-progress rows open
              // the event view; pending rows open the request editor.
              const onClick = () => {
                if (isDone && r.eventUuid) {
                  navigate(`/event/view/${r.eventUuid}`);
                } else if (isDone) {
                  navigate("/recap/list");
                } else if (r.eventUuid) {
                  navigate(`/event/view/${r.eventUuid}`);
                } else {
                  navigate(`/request/edit/${r.uuid}`);
                }
              };
              return (
                <tr
                  key={r.uuid}
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
                  <td className="px-4 py-3">
                    <span
                      className="mono text-[10px]"
                      style={{
                        letterSpacing: "0.14em",
                        color: "rgba(255,255,255,0.3)",
                      }}
                    >
                      —
                    </span>
                  </td>
                </tr>
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
  onCountsChange: (counts: Record<string, number>, total: number) => void;
}> = ({ activeStatus, search, onCountsChange }) => {
  const { tenantId } = useAuthStore();

  // Fetch a large page so all current requests render. Real pagination
  // with cursor-based "Load more" comes in v2.
  // Tenant scoping is REQUIRED — without it the query returns nothing.
  const data = useLazyLoadQuery<RequestsQueryType>(
    RequestsQuery,
    {
      first: 1000,
      q: search || null,
      filters: tenantId ? { tenantId } : null,
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

  // Apply status filter client-side (the backend filter shape would change
  // this to a server-side filter — v2).
  const rows = useMemo(
    () =>
      activeStatus === "all"
        ? allRows
        : allRows.filter((r) => r.statusSlug === activeStatus),
    [allRows, activeStatus],
  );

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

  return <TrackerTable rows={rows} />;
};

/* ─────────────────────────── PAGE ────────────────────────────── */

export default function MasterTracker() {
  const navigate = useNavigate();
  const { tenantId } = useAuthStore();
  const [activeStatus, setActiveStatus] = useState<string>("all");
  const [search, setSearch] = useState<string>("");
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
              ALL EVENTS · ONE TABLE
            </p>
            <h1
              className="display text-4xl font-bold mt-2"
              style={{ letterSpacing: "-0.04em" }}
            >
              Master tracker.
            </h1>
            <p
              className="mt-2"
              style={{ color: "rgba(255,255,255,0.55)" }}
            >
              Every event, every status, every recap link.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => navigate("/requests/create")}
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
              onClick={() => alert("CSV export coming soon")}
              className="px-4 py-2 rounded-xl text-sm font-semibold transition"
              style={{
                background: "transparent",
                color: "var(--spark-text)",
                border: "1px solid var(--spark-border)",
              }}
            >
              ↗ Export CSV
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
              + Log event
            </button>
          </div>
        </div>

        {/* Status chips + search */}
        <div className="spark-card p-4 flex flex-wrap items-center gap-2">
          <span className="label-mini mr-2">STATUS</span>
          {STATUS_FILTERS.map((f) => {
            const n =
              f.key === "all" ? total : (counts[f.key] ?? 0);
            const active = f.key === activeStatus;
            return (
              <button
                key={f.key}
                onClick={() => setActiveStatus(f.key)}
                className={`${f.chip} ${active ? "ring-2 ring-offset-0" : ""}`}
                style={
                  active
                    ? { outline: "1.5px solid currentColor", outlineOffset: 0 }
                    : undefined
                }
              >
                {f.key !== "all" && "● "}
                {f.label} · {n}
              </button>
            );
          })}
          <span className="flex-1" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="rounded-xl text-xs"
            style={{
              padding: "0.45rem 0.9rem",
              background: "var(--spark-bg)",
              border: "1px solid var(--spark-border)",
              color: "var(--spark-text)",
              maxWidth: 200,
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
            onCountsChange={handleCounts}
          />
        </Suspense>
      </div>
    </Layout>
  );
}
