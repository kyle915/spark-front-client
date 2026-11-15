/**
 * Per-tenant client dashboard — focused view for brand stakeholders.
 *
 * Lives at /client-dashboard (and /client). Answers:
 *   1. What's happening ahead (7 / 30 / 90 days)?
 *   2. Approvals + account map
 *   3. Program performance (pace / KPIs) — Performance tab only
 *
 * Overview stays scannable: week-ahead, narration, quick links.
 * Performance embeds InsightsBody. Approvals / map lazy-load.
 * Legacy /insights redirects here (#performance).
 */

import ClientProgramSnapshot from "./ClientProgramSnapshot";
import { tenantDisplayName } from "@/utils/tenantDisplayName";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import SparkEmptyState from "@/shared/SparkEmptyState";
import SparkSheet from "@/shared/SparkSheet";
import { useLazyLoadQuery } from "react-relay/hooks";
import Layout from "@/layout/Layout";
import { DashboardSkeleton, PanelSkeleton } from "@/layout/PageSkeletons";
import { useAuthStore } from "@/store/authStore";
import { useSidebarCounts } from "@/hooks/useSidebarCounts";
import { ClientWeekAheadQuery } from "@/api/queries/ClientWeekAheadQuery";
import type { ClientWeekAheadQuery as ClientWeekAheadQueryType } from "@api/queries/__generated__/ClientWeekAheadQuery.graphql";
import ActiveTenantAskAi from "@/components/ai/ActiveTenantAskAi";
import AskAiButton from "@/components/ai/AskAiButton";
import WeeklyNarrationCard from "@/components/ai/WeeklyNarrationCard";
import { InsightsBody } from "@/components/pages/insights/SparkInsights";
import { requestDateKey } from "@/lib/requestDateKey";
import { rankUpcomingRetailers } from "@/components/pages/client-dashboard/topRetailers";
import ErrorBoundary from "@/components/ErrorBoundary";
import { buildTrackerUrlParams } from "@/requests/masterTrackerFilters";
import SparkPageHeader from "@/shared/SparkPageHeader";
import { TenantLogo } from "@/layout/TenantLogo.tsx";
import DashboardProgramSwitch from "@/field/DashboardProgramSwitch";
import { isTorchTenant } from "@/field/torch";
import { useDashboardProgram } from "@/field/useDashboardProgram";
import {
  BrandComparePanel,
  BrandViewSwitch,
} from "@/components/brandGroup/BrandCompare";
import { useBrandView } from "@/components/brandGroup/useBrandView";
import { CountReel } from "@/motion/CountReel";
import { ConsumersPerWeekTrend } from "@/components/charts/ConsumerCharts";

const AccountMapBody = lazy(() =>
  import("@/components/pages/map/SparkAccountMap").then((m) => ({
    default: m.AccountMapBody,
  })),
);

const ClientApprovalsBody = lazy(() =>
  import("@/components/pages/approvals/SparkClientApprovals").then((m) => ({
    default: m.ClientApprovalsBody,
  })),
);

type TabKey = "overview" | "performance" | "approvals" | "map";
type AheadHorizon = 7 | 30 | 90;

// Read the active tab from the URL hash so deep-links (e.g.
// /client-dashboard#approvals) land on the right tab and the back
// button works between tabs. Defaults to overview for empty/unknown.
const readTabFromHash = (): TabKey => {
  if (typeof window === "undefined") return "overview";
  const h = (window.location.hash || "").replace(/^#/, "").toLowerCase();
  if (h === "approvals" || h === "map" || h === "performance") return h;
  return "overview";
};

type DayBucket = {
  key: string; // YYYY-MM-DD
  label: string; // "Mon May 26"
  count: number;
  /** Inclusive YYYY-MM-DD bounds this bucket counts — tracker drill-down. */
  startDate: string;
  endDate: string;
};

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const fmtDayLabel = (d: Date) =>
  d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

const dayKey = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const isoDay = (d: Date) => dayKey(d);

const WeekAheadPanel: React.FC<{
  tenantId: string | null;
  horizonDays: AheadHorizon;
  onHorizonDays: (days: AheadHorizon) => void;
  dateWindow: { startDate: string; endDate: string };
  torch: boolean;
}> = ({ tenantId, horizonDays, onHorizonDays, dateWindow }) => {
  const navigate = useNavigate();
  const data = useLazyLoadQuery<ClientWeekAheadQueryType>(
    ClientWeekAheadQuery,
    {
      // Busy tenants can schedule hundreds of demos in a quarter window.
      // Keep first:1000 — the query is already server-bounded to the
      // visible horizon (startDate/endDate below), and lowering the cap
      // would silently truncate buckets/top-retailers for busy tenants
      // at 90d, undercounting the panel.
      first: 1000,
      filters: tenantId
        ? {
            tenantId,
            startDate: dateWindow.startDate,
            endDate: dateWindow.endDate,
            dateSort: "asc",
          }
        : null,
    },
    {
      fetchPolicy: "store-or-network",
      fetchKey: `${tenantId ?? ""}|${horizonDays}|${dateWindow.startDate}`,
    },
  );

  // Bucket strategy: daily for 7d, weekly for 30d, monthly for 90d.
  const aheadBuckets: DayBucket[] = useMemo(() => {
    const today = startOfDay(new Date());
    const buckets: DayBucket[] = [];
    const horizonEnd = new Date(today);
    horizonEnd.setDate(today.getDate() + horizonDays - 1);
    if (horizonDays === 7) {
      for (let i = 0; i < 7; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        buckets.push({
          key: dayKey(d),
          label: fmtDayLabel(d),
          count: 0,
          startDate: dayKey(d),
          endDate: dayKey(d),
        });
      }
    } else if (horizonDays === 30) {
      for (let w = 0; w < 5; w++) {
        const start = new Date(today);
        start.setDate(today.getDate() + w * 7);
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        // Last weekly bucket is partial — clamp to the counted horizon.
        const clampedEnd = end > horizonEnd ? horizonEnd : end;
        buckets.push({
          key: `w${w}-${dayKey(start)}`,
          label: `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
          count: 0,
          startDate: dayKey(start),
          endDate: dayKey(clampedEnd),
        });
      }
    } else {
      for (let m = 0; m < 3; m++) {
        const start = new Date(today.getFullYear(), today.getMonth() + m, 1);
        const monthEnd = new Date(
          today.getFullYear(),
          today.getMonth() + m + 1,
          0,
        );
        // Clamp to the counted horizon (today → today+horizon-1) so the
        // drill-down shows exactly the events this bucket counted.
        const clampedStart = start < today ? today : start;
        const clampedEnd = monthEnd > horizonEnd ? horizonEnd : monthEnd;
        buckets.push({
          key: `m-${start.getFullYear()}-${start.getMonth()}`,
          label: start.toLocaleDateString("en-US", { month: "short" }),
          count: 0,
          startDate: dayKey(clampedStart),
          endDate: dayKey(clampedEnd),
        });
      }
    }
    const rows =
      data?.requests?.edges
        ?.map((e) => e?.node)
        ?.filter((n): n is NonNullable<typeof n> => Boolean(n)) ?? [];
    const endExclusive = new Date(today);
    endExclusive.setDate(today.getDate() + horizonDays);
    for (const r of rows) {
      const k = requestDateKey(r.date);
      if (!k) continue;
      const [y, mo, d] = k.split("-").map(Number);
      const ms = new Date(y, mo - 1, d).getTime();
      if (!Number.isFinite(ms)) continue;
      if (ms < today.getTime() || ms >= endExclusive.getTime()) continue;
      if (horizonDays === 7) {
        const slot = buckets.find((b) => b.key === k);
        if (slot) slot.count += 1;
      } else if (horizonDays === 30) {
        const dayOffset = Math.floor(
          (ms - today.getTime()) / (24 * 60 * 60 * 1000),
        );
        const wi = Math.min(4, Math.max(0, Math.floor(dayOffset / 7)));
        buckets[wi].count += 1;
      } else {
        const mi = Math.min(
          2,
          Math.max(0, (y - today.getFullYear()) * 12 + (mo - 1 - today.getMonth())),
        );
        buckets[mi].count += 1;
      }
    }
    return buckets;
  }, [data, horizonDays]);

  // Top retailers in the selected horizon. Blank retailer names are
  // excluded so a missing account cannot become the top row.
  const topRetailers = useMemo(() => {
    const rows =
      data?.requests?.edges
        ?.map((e) => e?.node)
        ?.filter((n): n is NonNullable<typeof n> => Boolean(n)) ?? [];
    return rankUpcomingRetailers(
      rows.map((r) => ({
        date: r.date,
        retailerName: r.retailer?.name,
      })),
      { today: startOfDay(new Date()), horizonDays, limit: 5 },
    );
  }, [data, horizonDays]);

  const maxWeekCount = Math.max(1, ...aheadBuckets.map((b) => b.count));
  const totalThisWeek = aheadBuckets.reduce((s, b) => s + b.count, 0);
  const trackerWhen =
    horizonDays === 7 ? "next7" : horizonDays === 30 ? "next30" : "next90";
  return (
    <>
      {/* Month-ahead bars */}
      <div className="spark-card spark-stat-band">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <p className="spark-kpi-label">
            Coming up in the next {horizonDays} days ·{" "}
            <CountReel value={totalThisWeek} /> {totalThisWeek === 1 ? "event" : "events"}
          </p>
          <div className="flex items-center gap-1">
            {([7, 30, 90] as AheadHorizon[]).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => onHorizonDays(d)}
                className="text-[12px] px-2 py-1 rounded-lg"
                style={{
                  color:
                    horizonDays === d
                      ? "var(--spark-selected-ink)"
                      : "rgba(var(--spark-ink-rgb),0.55)",
                  background:
                    horizonDays === d
                      ? "var(--spark-selected-bg)"
                      : "transparent",
                  border: "1px solid var(--spark-border)",
                }}
              >
                {d} days
              </button>
            ))}
            <button
              type="button"
              onClick={() =>
                navigate(`/requests/list?when=${trackerWhen}`)
              }
              className="text-[12px] px-2 py-1 rounded-lg ml-1"
              style={{
                color: "var(--spark-lime)",
                border: "1px solid rgba(var(--spark-accent-rgb),0.35)",
                background: "transparent",
              }}
            >
              Open tracker
            </button>
          </div>
        </div>
        <div
          className={`grid gap-2 items-end ${
            horizonDays === 7
              ? "grid-cols-7"
              : horizonDays === 30
                ? "grid-cols-5"
                : "grid-cols-3"
          }`}
        >
          {aheadBuckets.map((b) => {
            // A slim bar up to 56px tall. Scaled to the busiest week, so one
            // event in the only busy week no longer paints a solid block.
            const barHeight = b.count > 0 ? Math.max(6, (b.count / maxWeekCount) * 56) : 3;
            return (
              <button
                key={b.key}
                type="button"
                onClick={() => {
                  const params = buildTrackerUrlParams(
                    new URLSearchParams(),
                    {
                      dateRange: "custom",
                      customRange: {
                        startDate: b.startDate,
                        endDate: b.endDate,
                      },
                    },
                  );
                  navigate(`/requests/list?${params.toString()}`);
                }}
                aria-label={`${b.count} event${b.count === 1 ? "" : "s"} · ${b.label} (${b.startDate} to ${b.endDate}). View in Master Tracker`}
                title={`${b.count} event${b.count === 1 ? "" : "s"} — view in Master Tracker`}
                className="flex flex-col items-stretch gap-2 rounded-md text-left transition hover:opacity-80 focus-visible:outline-2"
                style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0 }}
              >
                <div
                  className="flex items-end justify-center"
                  style={{ height: 56 }}
                  title={`${b.count} event${b.count === 1 ? "" : "s"}`}
                >
                  <div
                    style={{
                      width: "min(44px, 60%)",
                      height: barHeight,
                      borderRadius: 4,
                      background:
                        b.count > 0
                          ? "rgba(var(--spark-ink-rgb),0.82)"
                          : "rgba(var(--spark-ink-rgb),0.12)",
                    }}
                  />
                </div>
                <div className="text-center">
                  <p
                    className="tab-num text-sm font-bold"
                    style={{
                      color:
                        b.count > 0
                          ? "var(--spark-text)"
                          : "rgba(var(--spark-ink-rgb),0.35)",
                    }}
                  >
                    {b.count}
                  </p>
                  <p className="text-[12px]" style={{ color: "var(--spark-text-meta)" }}>
                    {b.label}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Top retailers — only when something is scheduled. An empty card
          (and the old Quick links card beside it, which repeated the
          sidebar) took a third of the screen to say nothing. */}
      {topRetailers.length === 0 ? null : (
        <div className="spark-card spark-stat-band">
          <p className="spark-kpi-label mb-3">
            Top retailers · next {horizonDays} days
          </p>
          {(
            <ul className="space-y-2">
              {topRetailers.map((row) => (
                <li
                  key={row.key}
                  className="flex items-center justify-between gap-3 min-w-0"
                >
                  <span
                    className="text-sm truncate min-w-0"
                    style={
                      row.quiet
                        ? { color: "var(--spark-text-meta)" }
                        : undefined
                    }
                  >
                    {row.name}
                  </span>
                  <span
                    className="mono text-[10px] px-2 py-1 rounded-full shrink-0 whitespace-nowrap"
                    style={{
                      letterSpacing: "0.14em",
                      color: row.quiet
                        ? "rgba(var(--spark-ink-rgb),0.45)"
                        : "var(--spark-lime)",
                      background: row.quiet
                        ? "transparent"
                        : "rgba(var(--spark-accent-rgb),0.08)",
                      border: row.quiet
                        ? "1px solid rgba(var(--spark-ink-rgb),0.12)"
                        : "1px solid rgba(var(--spark-accent-rgb),0.25)",
                    }}
                  >
                    {row.count} {row.count === 1 ? "event" : "events"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  );
};

const ClientInner: React.FC = () => {
  const navigate = useNavigate();
  const { tenantId, tenantSlug, tenantMeta } = useAuthStore();
  const torch = isTorchTenant(tenantSlug, tenantMeta?.requestUrlName);
  const { program, choose } = useDashboardProgram(torch);
  const counts = useSidebarCounts();
  const { view: brandView, choose: chooseBrandView } = useBrandView();

  // Active tab — Overview / Approvals / Account Map. Persists in the
  // URL hash so deep-links land on the right view and the browser
  // back button traverses between tabs without unmounting the
  // dashboard chrome.
  const [activeTab, setActiveTab] = useState<TabKey>(readTabFromHash);
  const [approvalsOpen, setApprovalsOpen] = useState(false);
  useEffect(() => {
    const onHashChange = () => setActiveTab(readTabFromHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);
  const switchTab = (next: TabKey) => {
    setActiveTab(next);
    // Use replaceState — no extra back-stack entry per tab click; the
    // hashchange listener above keeps state in sync if someone
    // navigates via the URL bar.
    const url = new URL(window.location.href);
    url.hash = next === "overview" ? "" : next;
    window.history.replaceState(null, "", url.toString());
  };

  // Horizon: 7 / 30 / 90 days ahead. Defaults to month-ahead (30).
  // Intentionally NOT RequestsQuery first:2000 — that pulls products,
  // openShifts, nested location trees this page never renders.
  const [horizonDays, setHorizonDays] = useState<AheadHorizon>(30);

  const dateWindow = useMemo(() => {
    const today = startOfDay(new Date());
    const end = new Date(today);
    end.setDate(today.getDate() + horizonDays);
    return { startDate: isoDay(today), endDate: isoDay(end) };
  }, [horizonDays]);


  return (
    <div className="space-y-6 max-w-7xl spark-fade-in spark-scale">
      <div className="flex items-start gap-3">
        <TenantLogo
          variant="header"
          tone="dark"
          name={tenantDisplayName(tenantMeta?.requestUrlName, tenantSlug) || tenantMeta?.requestUrlName}
          requestUrlName={tenantMeta?.requestUrlName}
          tenantSlug={tenantSlug}
          image={tenantMeta?.logo}
        />
        <div className="min-w-0 flex-1">
          <SparkPageHeader
            eyebrow="YOUR PROGRAM"
            title="Home"
            support="What happened in the last 30 days, and what's coming up."
            action={
              <Suspense fallback={<AskAiButton tenantId={tenantId} />}>
                <ActiveTenantAskAi />
              </Suspense>
            }
          />
        </div>
      </div>

      <BrandViewSwitch tenantId={tenantId} view={brandView} onChange={chooseBrandView} />
      {brandView === "compare" && tenantId ? (
        <BrandComparePanel tenantId={tenantId} canManageAccess={false} />
      ) : (<>

      {/* Tab bar — Overview / Approvals / Account Map. The latter two
          tabs reuse the existing /approvals and /account-map pages by
          embedding their Layout-less bodies. Active tab is reflected
          in the URL hash so /client-dashboard#approvals deep-links
          straight to that view. */}
      <div
        role="tablist"
        aria-label="Dashboard views"
        className="flex items-center gap-1 border-b"
        style={{ borderColor: "var(--spark-border)" }}
      >
        {(
          [
            { key: "overview", label: "Overview" },
            { key: "performance", label: "Performance" },
            {
              key: "approvals",
              label: `Approvals${counts.approvals > 0 ? ` · ${counts.approvals}` : ""}`,
            },
            { key: "map", label: "Account map" },
          ] as { key: TabKey; label: string }[]
        ).map((t) => {
          const active = activeTab === t.key;
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={active}
              onClick={() => switchTab(t.key)}
              className="px-4 py-2.5 text-sm font-semibold transition relative -mb-px"
              style={{
                color: active
                  ? "var(--spark-text)"
                  : "rgba(var(--spark-ink-rgb),0.55)",
                borderBottom: active
                  ? "2px solid var(--spark-orange)"
                  : "2px solid transparent",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === "approvals" && (
        <ErrorBoundary
          fallback={
            <div
              className="spark-card p-8 text-center text-sm"
              style={{ color: "var(--spark-text-meta)" }}
            >
              Approvals couldn&rsquo;t load — the rest of your dashboard
              still works.
            </div>
          }
        >
          <Suspense fallback={<PanelSkeleton label="Loading approvals" />}>
            <ClientApprovalsBody />
          </Suspense>
        </ErrorBoundary>
      )}

      {activeTab === "map" && (
        <Suspense fallback={<PanelSkeleton label="Loading account map" />}>
          <AccountMapBody />
        </Suspense>
      )}

      {activeTab === "overview" && (<>
        {tenantId ? (
          <Suspense fallback={<PanelSkeleton label="Loading your program" />}>
            <ClientProgramSnapshot tenantId={tenantId} />
          </Suspense>
        ) : null}

        {tenantId ? (
          <div className="spark-card p-5 sm:p-6">
            <ConsumersPerWeekTrend tenantId={tenantId} />
          </div>
        ) : null}

      {torch ? (
        <DashboardProgramSwitch program={program} onChange={choose} />
      ) : null}

      {counts.approvals > 0 ||
      counts.recapsDue > 0 ||
      counts.alertsUnread > 0 ? (
        <div className="spark-card spark-stat-band w-full flex flex-col gap-2">
          <span className="spark-kpi-delta is-attention">Needs you</span>
          <div className="flex flex-col sm:flex-row gap-2">
            {counts.approvals > 0 ? (
              <button
                type="button"
                onClick={() => setApprovalsOpen(true)}
                className="flex-1 flex items-center justify-between text-left gap-3 rounded-xl px-3 py-2 hover:bg-base-300/40 transition"
              >
                <span className="flex items-baseline gap-2 min-w-0">
                  <span className="spark-kpi-value spark-kpi-value-sm is-orange">
                    <CountReel value={counts.approvals} />
                  </span>
                  <span className="spark-kpi-label truncate">
                    approval{counts.approvals === 1 ? "" : "s"}
                  </span>
                </span>
                <span className="spark-kpi-delta is-attention shrink-0 text-[11px]">
                  Review →
                </span>
              </button>
            ) : null}
            {counts.recapsDue > 0 ? (
              <button
                type="button"
                onClick={() => navigate("/recaps/list")}
                className="flex-1 flex items-center justify-between text-left gap-3 rounded-xl px-3 py-2 hover:bg-base-300/40 transition"
              >
                <span className="flex items-baseline gap-2 min-w-0">
                  <span className="spark-kpi-value spark-kpi-value-sm is-orange">
                    <CountReel value={counts.recapsDue} />
                  </span>
                  <span className="spark-kpi-label truncate">recaps due</span>
                </span>
                <span className="spark-kpi-delta is-attention shrink-0 text-[11px]">
                  Recaps →
                </span>
              </button>
            ) : null}
            {counts.alertsUnread > 0 ? (
              <button
                type="button"
                onClick={() => navigate("/inbox")}
                className="flex-1 flex items-center justify-between text-left gap-3 rounded-xl px-3 py-2 hover:bg-base-300/40 transition"
              >
                <span className="flex items-baseline gap-2 min-w-0">
                  <span className="spark-kpi-value spark-kpi-value-sm is-orange">
                    <CountReel value={counts.alertsUnread} />
                  </span>
                  <span className="spark-kpi-label truncate">unread</span>
                </span>
                <span className="spark-kpi-delta is-attention shrink-0 text-[11px]">
                  Inbox →
                </span>
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {program === "field" ? null : (
        <Suspense fallback={<PanelSkeleton label="Loading the month ahead" />}>
          <WeekAheadPanel
            tenantId={tenantId ?? null}
            horizonDays={horizonDays}
            onHorizonDays={setHorizonDays}
            dateWindow={dateWindow}
            torch={torch}
          />
        </Suspense>
      )}

      {tenantId ? <WeeklyNarrationCard tenantId={tenantId} forClient /> : null}

      </>)}

      {activeTab === "performance" && (
        <section id="client-performance" className="space-y-4">
          <Suspense fallback={<DashboardSkeleton />}>
            <InsightsBody embedded omitNarration />
          </Suspense>
        </section>
      )}
      </>)}

      <SparkSheet
        open={approvalsOpen}
        onOpenChange={setApprovalsOpen}
        title="Approvals"
        eyebrow="NEEDS YOU"
      >
        <div className="p-4">
          <ErrorBoundary
            fallback={
              <SparkEmptyState
                title="Approvals couldn't load"
                body="The rest of your dashboard still works."
              />
            }
          >
            <Suspense fallback={<PanelSkeleton label="Loading approvals" />}>
              <ClientApprovalsBody />
            </Suspense>
          </ErrorBoundary>
        </div>
      </SparkSheet>
    </div>
  );
};

export default function SparkClientDashboard() {
  return (
    <Layout>
      <Suspense fallback={<DashboardSkeleton />}>
        <ClientInner />
      </Suspense>
    </Layout>
  );
}
