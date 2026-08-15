import { lazy, Suspense, useMemo, useState } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import Layout from "@/layout/Layout";
import { useAuthStore } from "@/store/authStore";
import useSparkRole from "@/hooks/useSparkRole";
import useSidebarCounts from "@/hooks/useSidebarCounts";
import { useEventDashboardData } from "@/hooks/useEventDashboardData";
import { RequestsQuery } from "@/api/queries/RequestsQuery";
import type { RequestsQuery as RequestsQueryType } from "@api/queries/__generated__/RequestsQuery.graphql";
import AttentionEngine from "./AttentionEngine";
import PaceWidget from "./PaceWidget";
import AskAiButton from "@/components/ai/AskAiButton";
import ClockSummaryCard from "@/components/dashboard/ClockSummaryCard";
import type { DashboardFilters } from "@/components/filters/FiltersPanel";
import { useNavigate } from "react-router";
import { DashboardSkeleton } from "@/layout/PageSkeletons";

const TenantKpiCharts = lazy(() => import("@/components/ai/TenantKpiCharts"));
const TenantKpiComparison = lazy(
  () => import("@/components/ai/TenantKpiComparison"),
);
const TenantGoalsPanel = lazy(() => import("@/components/ai/TenantGoalsPanel"));
const TenantInsightsPanel = lazy(
  () => import("@/components/ai/TenantInsightsPanel"),
);
const TenantSentimentCard = lazy(
  () => import("@/components/ai/TenantSentimentCard"),
);
const TenantGeoHeatmap = lazy(() => import("@/components/ai/TenantGeoHeatmap"));
const TenantBaLeaderboard = lazy(
  () => import("@/components/ai/TenantBaLeaderboard"),
);
const MetroBreakdownCard = lazy(() => import("./MetroBreakdownCard"));

/**
 * Compact priority-glance card: shows pending approvals (with SLA
 * breach call-out), upcoming events in the next 14d, and unread
 * alerts. Each tile is clickable and routes to the relevant page.
 *
 * Sourced from useSidebarCounts so it shares the same RequestsQuery
 * cache the sidebar already paid for — no extra network hit.
 */
const TodaysSnapshot: React.FC = () => {
  const navigate = useNavigate();
  const counts = useSidebarCounts();
  const tiles: Array<{
    label: string;
    value: number;
    sub?: string;
    tone: "lime" | "orange" | "sky" | "gold";
    to: string;
    hide?: boolean;
  }> = [
    {
      label: "Need your call",
      value: counts.approvals,
      sub:
        counts.approvalsSlaBreach > 0
          ? `${counts.approvalsSlaBreach} SLA breach`
          : undefined,
      tone: counts.approvalsSlaBreach > 0 ? "orange" : "gold",
      to: "/approvals",
      hide: counts.approvals === 0 && counts.approvalsSlaBreach === 0,
    },
    {
      // Wraps the same recapsDue signal the sidebar badge uses, but
      // surfaces it on the dashboard so kyle sees it on first open
      // instead of having to scan the sidebar. Drills into the new
      // /recaps/missing page (PR #488) where he can nudge/file in
      // one click per row.
      label: "Recaps due",
      value: counts.recapsDue,
      sub:
        counts.recapsDue > 0
          ? `Review the ${counts.recapsDue} recap${counts.recapsDue === 1 ? "" : "s"} due`
          : "Caught up",
      tone: counts.recapsDue > 0 ? "orange" : "gold",
      to: "/recaps/missing",
    },
    {
      label: "Upcoming · 14d",
      value: counts.upcoming,
      tone: "sky",
      to: "/upcoming",
      hide: counts.upcoming === 0,
    },
    {
      label: "Unread alerts",
      value: counts.alertsUnread,
      tone: "lime",
      to: "/alerts",
      hide: counts.alertsUnread === 0,
    },
    {
      label: "Active requests",
      value: counts.tracker,
      tone: "lime",
      to: "/requests/list",
    },
  ];
  const visible = tiles.filter((t) => !t.hide);
  if (visible.length === 0) return null;
  const toneColor = (t: string) =>
    t === "orange"
      ? "var(--spark-orange)"
      : t === "sky"
        ? "var(--spark-sky)"
        : t === "gold"
          ? "var(--spark-gold)"
          : "var(--spark-lime)";
  return (
    <div
      className="spark-card p-4 lg:p-5"
      style={{ borderRadius: 18 }}
    >
      <div className="flex items-center justify-between mb-3">
        <p
          className="mono text-[10px]"
          style={{
            letterSpacing: "0.18em",
            color: "rgba(255,255,255,0.45)",
          }}
        >
          TODAY'S SNAPSHOT
        </p>
        <p
          className="mono text-[10px]"
          style={{
            letterSpacing: "0.14em",
            color: "rgba(255,255,255,0.4)",
          }}
        >
          TAP TO JUMP
        </p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {visible.map((t) => {
          const color = toneColor(t.tone);
          return (
            <button
              key={t.label}
              type="button"
              onClick={() => navigate(t.to)}
              className="text-left rounded-xl p-3 transition"
              style={{
                background: `${color}10`,
                border: `1px solid ${color}40`,
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = `${color}1a`)
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = `${color}10`)
              }
            >
              <p
                className="mono text-[10px] mb-1"
                style={{
                  letterSpacing: "0.16em",
                  color: "rgba(255,255,255,0.55)",
                }}
              >
                {t.label.toUpperCase()}
              </p>
              <p
                className="tab-num text-2xl lg:text-3xl font-bold leading-none"
                style={{ color }}
              >
                {t.value.toLocaleString()}
              </p>
              {t.sub && (
                <p
                  className="mono text-[10px] mt-1.5"
                  style={{
                    letterSpacing: "0.14em",
                    color: "var(--spark-orange)",
                  }}
                >
                  ⚠ {t.sub.toUpperCase()}
                </p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

/**
 * Phase 2.1 — Spark v2 Dashboard.
 *
 * Renders the layout from spark-demo/index.html lines 794-858 using the
 * lifted .kpi / .pill-group / .spark-card / .nav-* classes. Data comes from
 * useEventDashboardData. Date-range pill is visual-only for v1.
 */

type RangeKey = "today" | "7d" | "30d" | "qtd" | "ytd";

// Apple-style: three meaningful ranges only. Today and YTD removed —
// workflow rarely lands there.
const RANGES: { key: RangeKey; label: string }[] = [
  { key: "7d", label: "7d" },
  { key: "30d", label: "30d" },
  { key: "qtd", label: "90d" },
  { key: "ytd", label: "YTD" },
];

const monthLabel = () =>
  new Date()
    .toLocaleString("en-US", { month: "long", year: "numeric" })
    .toUpperCase();

const slugToName = (slug: string | null | undefined): string => {
  if (!slug) return "—";
  const parts = slug.split("-").filter(Boolean);
  const drop = new Set(["ighn", "ig", "ign"]);
  // A leading tenant-code token (e.g. "c3jw") is a random alphanumeric prefix,
  // not part of the brand — strip it. We only drop a token that mixes letters
  // AND digits (a code), so pure-word brands ("stone") and pure-number brands
  // ("7" in 7-eleven) are kept. Plus the known ig/ign vanity prefixes.
  const isCode = (t: string) => /[a-z]/i.test(t) && /[0-9]/.test(t);
  const brand =
    parts.length > 1 &&
    (drop.has(parts[0].toLowerCase()) || isCode(parts[0]))
      ? parts.slice(1)
      : parts;
  return brand
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(" ");
};

/* ─────────────── ACTIVATION-TYPE BREAKDOWN ─────────────── */

const TYPE_CONFIG: Array<{
  match: RegExp;
  label: string;
  color: string;
}> = [
  // Order matters — first match wins.
  { match: /retail/i, label: "Retail samplings", color: "var(--spark-lime)" },
  { match: /on[-\s]?prem|bar|venue/i, label: "On-premise", color: "var(--spark-purple)" },
  { match: /event|activation|festival|pop[-\s]?up/i, label: "Events", color: "var(--spark-sky)" },
];

const classifyType = (name: string | null | undefined): string => {
  if (!name) return "Other";
  for (const t of TYPE_CONFIG) {
    if (t.match.test(name)) return t.label;
  }
  return "Other";
};

const ActivationBreakdown: React.FC = () => {
  const { tenantId } = useAuthStore();
  const data = useLazyLoadQuery<RequestsQueryType>(
    RequestsQuery,
    { first: 1000, filters: tenantId ? { tenantId } : null },
    { fetchPolicy: "store-or-network" },
  );

  const counts = useMemo(() => {
    const buckets: Record<string, number> = {};
    const edges = data?.requests?.edges ?? [];
    for (const e of edges) {
      const n = e?.node;
      if (!n) continue;
      // Only count events that have a confirmed/scheduled/done status — they
      // happened or are happening. Pending/Queue are speculative.
      const slug = (n.status?.slug ?? n.status?.name ?? "")
        .toString()
        .toLowerCase();
      const counted =
        slug.includes("done") ||
        slug.includes("complete") ||
        slug.includes("scheduled") ||
        slug.includes("approved");
      if (!counted) continue;
      const label = classifyType(n.requestType?.name);
      buckets[label] = (buckets[label] ?? 0) + 1;
    }
    return buckets;
  }, [data]);

  const display = TYPE_CONFIG.map((t) => ({
    label: t.label,
    color: t.color,
    value: counts[t.label] ?? 0,
  }));

  return (
    <div
      className="spark-card p-6 lg:p-8"
      style={{ borderRadius: 22 }}
    >
      <div className="flex items-center justify-between mb-5">
        <h2
          className="display text-lg lg:text-xl font-bold"
          style={{ letterSpacing: "-0.02em" }}
        >
          By activation type
        </h2>
        <p
          className="mono text-[10px]"
          style={{
            letterSpacing: "0.18em",
            color: "rgba(255,255,255,0.45)",
          }}
        >
          CONFIRMED + COMPLETED
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {display.map((s) => (
          <div key={s.label}>
            <div className="flex items-center gap-2 mb-1.5">
              <span
                className="spark-dot"
                style={{
                  background: s.color,
                  boxShadow: `0 0 8px ${s.color}`,
                }}
              />
              <p className="label-mini">{s.label.toUpperCase()}</p>
            </div>
            <p
              className="display tab-num font-bold"
              style={{
                fontSize: "2.5rem",
                letterSpacing: "-0.04em",
                lineHeight: 1,
                color: s.color,
              }}
            >
              {s.value.toLocaleString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ───────────────────────────── PAGE ───────────────────────────── */

function DashboardInner() {
  const { tenantId, tenantMeta } = useAuthStore();
  const { isClient } = useSparkRole();
  const navigate = useNavigate();
  const [range, setRange] = useState<RangeKey>("30d");

  // Read the per-tenant linked Google Sheet URL (set in onboarding
  // or from the Master Tracker header) so we can surface a quick
  // shortcut at the top of the dashboard.
  const linkedSheetUrl = tenantId
    ? (() => {
        try {
          return localStorage.getItem(`@spark.linkedSheet.url/${tenantId}`) ?? "";
        } catch {
          return "";
        }
      })()
    : "";

  // Map the date-range pill into a real DashboardFilters startDate.
  const filters: DashboardFilters = useMemo(() => {
    const today = new Date();
    const start = new Date(today);
    if (range === "ytd") {
      // Jan 1 of the current year — captures the full calendar year.
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
    } else {
      const daysBack =
        range === "7d" ? 7 : range === "30d" ? 30 : 90;
      start.setDate(today.getDate() - daysBack);
    }
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    return {
      distributorIds: [],
      rmmAsignedId: null,
      quarter: null,
      startDate: fmt(start),
      endDate: fmt(today),
    };
  }, [range]);

  const { dashboard } = useEventDashboardData(tenantId || "", filters, 0);
  const tenantDisplay = slugToName(tenantMeta?.requestUrlName);
  const recent = dashboard.recentEvents ?? [];

  return (
      <div className="space-y-6 lg:space-y-8 max-w-7xl">
        {/* Greeting + period pills */}
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <p
              className="mono text-[10px]"
              style={{
                letterSpacing: "0.18em",
                color: "rgba(255,255,255,0.45)",
              }}
            >
              {isClient ? "YOUR PROGRAM · " : ""}
              {tenantDisplay.toUpperCase()} · {monthLabel()}
            </p>
            <h1
              className="display text-2xl lg:text-3xl font-bold mt-2 leading-[1.1]"
              style={{ letterSpacing: "-0.03em" }}
            >
              Today
            </h1>
            <p
              className="mt-3 text-base"
              style={{ color: "rgba(255,255,255,0.55)" }}
            >
              Due recaps and who&apos;s on the clock.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Ask AI about the currently-active tenant — same tenant id
                (useAuthStore().tenantId) every other per-tenant surface
                uses, with the resolved brand name for the modal heading. */}
            <AskAiButton tenantId={tenantId} tenantName={tenantDisplay} />
            {linkedSheetUrl && (
              <a
                href={linkedSheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 rounded-xl text-sm font-semibold inline-flex items-center gap-2"
                style={{
                  background: "rgba(95,184,239,0.10)",
                  color: "var(--spark-sky)",
                  border: "1px solid rgba(95,184,239,0.35)",
                  textDecoration: "none",
                }}
                title="Open the brand's linked Google Sheet in a new tab"
              >
                📊 Sheet ↗
              </a>
            )}
            <div className="pill-group">
              {RANGES.map((r) => (
                <button
                  key={r.key}
                  onClick={() => setRange(r.key)}
                  className={`pill-btn ${r.key === range ? "on" : ""}`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Today's snapshot — one-glance priority card. Pulls counts
            from useSidebarCounts so it shares the same RequestsQuery
            cache the sidebar already paid for. Hidden when nothing
            urgent (zero counts everywhere) so the workspace doesn't
            shout for attention when it doesn't have any. Suspense
            wrapper: snapshot has its own fetch and we don't want it
            to block the hero metrics rendering. */}
        <Suspense fallback={null}>
          <TodaysSnapshot />
        </Suspense>

        {/* Time clock — who's working now (Today) and hours for the current
            pay week. Sits with the action-oriented widgets rather than the
            KPI hero: this is an ops question ("is my team out there, and
            what do I owe them"), not a campaign-performance one. Its own
            Suspense so the live-board fetch can't hold up the page.

            Ignite-only. It names individual BAs and calls out who hasn't
            clocked in yet — staffing execution the agency manages, not
            something a client should be reading mid-shift. */}
        {!isClient && (
          <Suspense fallback={null}>
            <ClockSummaryCard />
          </Suspense>
        )}

        {/* PACE widget — last 7 days at a glance, with delta chips.
            Same data the weekly exec-summary email uses, but live so
            kyle can refresh mid-week. Sits between the action-oriented
            snapshot and the legacy KPI hero so the dashboard reads
            as: "what do I need to do now" → "how's the week going"
            → "deeper KPIs". Self-suspends; hides on empty weeks. */}
        <PaceWidget />

        {/* Program analytics stay below the work-home strip. Chart.js
            widgets lazy-load only when this section mounts — Recaps
            routes never pull them. */}


        {/* Aggregated program KPIs + 12-month trend for the active tenant.
            Scoped to useAuthStore().tenantId (same id the Ask-AI button
            above uses); renders nothing when no tenant is in scope. Self-
            suspends like the other lazy dashboard cards. */}
        {tenantId && (
          <Suspense
            fallback={
              <div
                className="spark-card p-6 text-center text-sm"
                style={{ color: "rgba(255,255,255,0.55)" }}
              >
                Loading program KPIs…
              </div>
            }
          >
            <TenantKpiCharts tenantId={tenantId} />
          </Suspense>
        )}

        {/* Period comparison — each headline KPI this-period vs last-period
            with up/down deltas. Mounted right after the KPI panel, scoped to the
            same useAuthStore().tenantId; renders nothing when no tenant is in
            scope (and the card itself renders nothing when there's no data for
            the period). Self-suspends like the other lazy dashboard cards so it
            doesn't block first paint. */}
        {tenantId && (
          <Suspense
            fallback={
              <div
                className="spark-card p-6 text-center text-sm"
                style={{ color: "rgba(255,255,255,0.55)" }}
              >
                Loading period comparison…
              </div>
            }
          >
            <TenantKpiComparison tenantId={tenantId} />
          </Suspense>
        )}

        {/* Goals & pace-to-target for the active tenant. Scoped to the same
            useAuthStore().tenantId as the KPI panel above; renders nothing when
            no tenant is in scope. Self-suspends like the other lazy dashboard
            cards so it doesn't block first paint. */}
        {tenantId && (
          <Suspense
            fallback={
              <div
                className="spark-card p-6 text-center text-sm"
                style={{ color: "rgba(255,255,255,0.55)" }}
              >
                Loading goals…
              </div>
            }
          >
            <TenantGoalsPanel tenantId={tenantId} />
          </Suspense>
        )}

        {/* Proactive insight cards for the active tenant. Scoped to the same
            useAuthStore().tenantId as the KPI panel above; renders nothing when
            no tenant is in scope. Self-suspends like the other lazy dashboard
            cards so it doesn't block first paint. */}
        {tenantId && (
          <Suspense
            fallback={
              <div
                className="spark-card p-6 text-center text-sm"
                style={{ color: "rgba(255,255,255,0.55)" }}
              >
                Loading insights…
              </div>
            }
          >
            <TenantInsightsPanel tenantId={tenantId} />
          </Suspense>
        )}

        {/* "What people are saying" — consumer-sentiment card for the active
            tenant. Mounted right after Insights, scoped to the same
            useAuthStore().tenantId; renders nothing when no tenant is in scope
            (and the card itself renders nothing when there's no feedback text
            yet). Self-suspends like the other lazy dashboard cards so it
            doesn't block first paint. */}
        {tenantId && (
          <Suspense
            fallback={
              <div
                className="spark-card p-6 text-center text-sm"
                style={{ color: "rgba(255,255,255,0.55)" }}
              >
                Loading sentiment…
              </div>
            }
          >
            <TenantSentimentCard tenantId={tenantId} />
          </Suspense>
        )}

        {/* Geographic performance heatmap (US choropleth) for the active
            tenant. Scoped to the same useAuthStore().tenantId as the KPI panel
            above; renders nothing when no tenant is in scope. Self-suspends
            like the other lazy dashboard cards so it doesn't block first
            paint. */}
        {tenantId && (
          <Suspense
            fallback={
              <div
                className="spark-card p-6 text-center text-sm"
                style={{ color: "rgba(255,255,255,0.55)" }}
              >
                Loading geographic performance…
              </div>
            }
          >
            <TenantGeoHeatmap tenantId={tenantId} />
          </Suspense>
        )}

        {/* "Top performers" BA leaderboard for the active tenant. Scoped to the
            same useAuthStore().tenantId as the KPI panel above; renders nothing
            when no tenant is in scope. Self-suspends like the other lazy
            dashboard cards so it doesn't block first paint. */}
        {tenantId && (
          <Suspense
            fallback={
              <div
                className="spark-card p-6 text-center text-sm"
                style={{ color: "rgba(255,255,255,0.55)" }}
              >
                Loading top performers…
              </div>
            }
          >
            <TenantBaLeaderboard tenantId={tenantId} />
          </Suspense>
        )}

        {/* Week-by-metro-market breakdown — only renders for tenants whose
            events follow the "<Market> — <Corridor> · <date>" naming
            convention (Feel Free's Guerrilla Field Sampling program); every
            other tenant's card resolves to null. Own date-range control,
            independent of the YTD range pill above. */}
        {tenantId && (
          <Suspense
            fallback={
              <div
                className="spark-card p-6 text-center text-sm"
                style={{ color: "rgba(255,255,255,0.55)" }}
              >
                Loading metro breakdown…
              </div>
            }
          >
            <MetroBreakdownCard tenantId={tenantId} />
          </Suspense>
        )}

        {/* Activation-type breakdown (Retail · Event · On-Premise) */}
        <Suspense
          fallback={
            <div
              className="spark-card p-6 text-center text-sm"
              style={{ color: "rgba(255,255,255,0.55)" }}
            >
              Loading activation breakdown…
            </div>
          }
        >
          <ActivationBreakdown />
        </Suspense>

        {/* "What needs you" — real attention signals, hidden when empty */}
        <Suspense fallback={null}>
          <AttentionEngine />
        </Suspense>

        {/* Unified timeline: upcoming + recent in one vertical flow */}
        <div className="spark-card p-6 lg:p-8">
          <div className="flex items-center justify-between mb-5">
            <h2
              className="display text-lg lg:text-xl font-bold"
              style={{ letterSpacing: "-0.02em" }}
            >
              Timeline
            </h2>
            <button
              onClick={() => navigate("/requests/list")}
              className="mono text-[10px] transition"
              style={{
                letterSpacing: "0.18em",
                color: "rgba(255,255,255,0.55)",
              }}
            >
              ALL EVENTS →
            </button>
          </div>

          {recent.length === 0 ? (
            <p
              className="text-sm py-10 text-center"
              style={{ color: "rgba(255,255,255,0.55)" }}
            >
              No data yet. New events show up here as they're scheduled.
            </p>
          ) : (
            <div>
              {recent.slice(0, 10).map((e, i) => {
                const dateStr = e.date ?? "";
                const isToday =
                  dateStr &&
                  new Date(dateStr).toDateString() ===
                    new Date().toDateString();
                const isPast = dateStr && new Date(dateStr) < new Date();
                const dot = isToday
                  ? "var(--spark-lime)"
                  : isPast
                    ? "rgba(255,255,255,0.3)"
                    : "var(--spark-sky)";
                return (
                  <div
                    key={i}
                    onClick={() =>
                      isPast
                        ? navigate("/recap/list")
                        : navigate("/requests/list")
                    }
                    className="flex items-center gap-4 py-3 cursor-pointer"
                    style={{
                      borderBottom:
                        i < Math.min(recent.length, 10) - 1
                          ? "1px solid var(--spark-border)"
                          : "none",
                      opacity: isPast ? 0.72 : 1,
                    }}
                  >
                    <span
                      className="spark-dot shrink-0"
                      style={{
                        background: dot,
                        boxShadow: `0 0 8px ${dot}`,
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">
                        {e.name ?? "Untitled"}
                      </p>
                      <p
                        className="mono text-[10px] mt-0.5 truncate"
                        style={{
                          letterSpacing: "0.14em",
                          color: "rgba(255,255,255,0.45)",
                          textTransform: "uppercase",
                        }}
                      >
                        {e.location ?? ""}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p
                        className="text-sm"
                        style={{ color: "rgba(255,255,255,0.85)" }}
                      >
                        {dateStr || "—"}
                      </p>
                      <p
                        className="mono text-[10px]"
                        style={{
                          letterSpacing: "0.14em",
                          color: isToday
                            ? "var(--spark-lime)"
                            : isPast
                              ? "rgba(255,255,255,0.45)"
                              : "var(--spark-sky)",
                        }}
                      >
                        {isToday
                          ? "TODAY"
                          : isPast
                            ? (e.status ?? "DONE").toUpperCase()
                            : (e.status ?? "SCHEDULED").toUpperCase()}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
  );
}

export default function DashboardIndex() {
  return (
    <Layout>
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardInner />
      </Suspense>
    </Layout>
  );
}
