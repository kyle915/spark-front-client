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

import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useLazyLoadQuery } from "react-relay/hooks";
import Layout from "@/layout/Layout";
import { DashboardSkeleton } from "@/layout/PageSkeletons";
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
  onOpenApprovals: () => void;
  onOpenPerformance: () => void;
}> = ({ tenantId, horizonDays, onHorizonDays, dateWindow, onOpenApprovals, onOpenPerformance }) => {
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
      <div className="spark-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <p
            className="mono text-[10px]"
            style={{
              letterSpacing: "0.18em",
              color: "rgba(255,255,255,0.45)",
            }}
          >
            {horizonDays}-DAY FORWARD · {totalThisWeek} EVENTS
          </p>
          <div className="flex items-center gap-1">
            {([7, 30, 90] as AheadHorizon[]).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => onHorizonDays(d)}
                className="mono text-[9px] px-2 py-1 rounded-lg"
                style={{
                  letterSpacing: "0.12em",
                  color:
                    horizonDays === d
                      ? "#0a0a0a"
                      : "rgba(255,255,255,0.55)",
                  background:
                    horizonDays === d
                      ? "var(--spark-lime)"
                      : "transparent",
                  border: "1px solid var(--spark-border)",
                }}
              >
                {d}D
              </button>
            ))}
            <button
              type="button"
              onClick={() =>
                navigate(`/requests/list?when=${trackerWhen}`)
              }
              className="mono text-[9px] px-2 py-1 rounded-lg ml-1"
              style={{
                letterSpacing: "0.12em",
                color: "var(--spark-lime)",
                border: "1px solid rgba(242,243,238,0.35)",
                background: "transparent",
              }}
            >
              TRACKER →
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
            const heightPct = (b.count / maxWeekCount) * 100;
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
                  className="rounded-md self-stretch"
                  style={{
                    background:
                      b.count > 0
                        ? "var(--spark-lime)"
                        : "rgba(255,255,255,0.06)",
                    height: Math.max(8, heightPct) + "px",
                    minHeight: 8,
                    boxShadow:
                      b.count > 0
                        ? "0 0 12px rgba(242,243,238,0.20)"
                        : "none",
                  }}
                  title={`${b.count} event${b.count === 1 ? "" : "s"}`}
                />
                <div className="text-center">
                  <p
                    className="tab-num text-sm font-bold"
                    style={{
                      color:
                        b.count > 0
                          ? "var(--spark-text)"
                          : "rgba(255,255,255,0.35)",
                    }}
                  >
                    {b.count}
                  </p>
                  <p
                    className="mono text-[9px]"
                    style={{
                      letterSpacing: "0.12em",
                      color: "rgba(255,255,255,0.45)",
                    }}
                  >
                    {b.label.toUpperCase()}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Top retailers + quick links */}
      <div className="grid lg:grid-cols-2 gap-3">
        <div className="spark-card p-5">
          <p
            className="mono text-[10px] mb-3"
            style={{
              letterSpacing: "0.18em",
              color: "rgba(255,255,255,0.45)",
            }}
          >
            {`TOP RETAILERS · NEXT ${horizonDays} DAYS`}
          </p>
          {topRetailers.length === 0 ? (
            <p
              className="text-[13px]"
              style={{ color: "rgba(255,255,255,0.45)" }}
            >
              Nothing scheduled in this window.
            </p>
          ) : (
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
                        ? { color: "rgba(255,255,255,0.45)" }
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
                        ? "rgba(255,255,255,0.45)"
                        : "var(--spark-lime)",
                      background: row.quiet
                        ? "transparent"
                        : "rgba(242,243,238,0.08)",
                      border: row.quiet
                        ? "1px solid rgba(255,255,255,0.12)"
                        : "1px solid rgba(242,243,238,0.25)",
                    }}
                  >
                    {row.count} {row.count === 1 ? "EVENT" : "EVENTS"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="spark-card p-5">
          <p
            className="mono text-[10px] mb-3"
            style={{
              letterSpacing: "0.18em",
              color: "rgba(255,255,255,0.45)",
            }}
          >
            QUICK LINKS
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => navigate("/recaps/list")}
              className="px-3 py-2.5 rounded-xl text-sm font-semibold text-left"
              style={{
                background: "transparent",
                color: "var(--spark-text)",
                border: "1px solid var(--spark-border)",
              }}
            >
              Recaps
            </button>
            <button
              onClick={() =>
                navigate(`/requests/list?when=${trackerWhen}`)
              }
              className="px-3 py-2.5 rounded-xl text-sm font-semibold text-left"
              style={{
                background: "transparent",
                color: "var(--spark-text)",
                border: "1px solid var(--spark-border)",
              }}
            >
              Master tracker
            </button>
            <button
              onClick={onOpenApprovals}
              className="px-3 py-2.5 rounded-xl text-sm font-semibold text-left"
              style={{
                background: "transparent",
                color: "var(--spark-text)",
                border: "1px solid var(--spark-border)",
              }}
            >
              Approvals
            </button>
            <button
              onClick={onOpenPerformance}
              className="px-3 py-2.5 rounded-xl text-sm font-semibold text-left"
              style={{
                background: "transparent",
                color: "var(--spark-text)",
                border: "1px solid var(--spark-border)",
              }}
            >
              Performance
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

const ClientInner: React.FC = () => {
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
    <div className="space-y-6 max-w-7xl spark-fade-in">
      <div className="flex items-start gap-3">
        <TenantLogo
          variant="header"
          tone="dark"
          name={tenantMeta?.requestUrlName}
          requestUrlName={tenantMeta?.requestUrlName}
          tenantSlug={tenantSlug}
          image={tenantMeta?.logo}
        />
        <div className="min-w-0 flex-1">
          <SparkPageHeader
            eyebrow="YOUR PROGRAM · MONTH AHEAD"
            title="Home"
            support="What's ahead this month. Performance lives on its own tab."
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
                  : "rgba(255,255,255,0.55)",
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
              style={{ color: "rgba(255,255,255,0.55)" }}
            >
              Approvals couldn&rsquo;t load — the rest of your dashboard
              still works.
            </div>
          }
        >
          <Suspense
            fallback={
              <div
                className="spark-card p-8 text-center text-sm"
                style={{ color: "rgba(255,255,255,0.55)" }}
              >
                Loading approvals…
              </div>
            }
          >
            <ClientApprovalsBody />
          </Suspense>
        </ErrorBoundary>
      )}

      {activeTab === "map" && (
        <Suspense
          fallback={
            <div
              className="spark-card p-8 text-center text-sm"
              style={{ color: "rgba(255,255,255,0.55)" }}
            >
              Loading account map…
            </div>
          }
        >
          <AccountMapBody />
        </Suspense>
      )}

      {activeTab === "overview" && (<>

      {torch ? (
        <DashboardProgramSwitch program={program} onChange={choose} />
      ) : null}

      {program === "field" ? null : (
        <Suspense
          fallback={
            <div
              className="spark-card p-5 text-sm"
              style={{ color: "rgba(255,255,255,0.45)" }}
            >
              Loading the month ahead…
            </div>
          }
        >
          <WeekAheadPanel
            tenantId={tenantId ?? null}
            horizonDays={horizonDays}
            onHorizonDays={setHorizonDays}
            dateWindow={dateWindow}
            torch={torch}
            onOpenApprovals={() => switchTab("approvals")}
            onOpenPerformance={() => switchTab("performance")}
          />
        </Suspense>
      )}

      {tenantId ? <WeeklyNarrationCard tenantId={tenantId} /> : null}

      </>)}

      {activeTab === "performance" && (
        <section id="client-performance" className="space-y-4">
          <Suspense fallback={<DashboardSkeleton />}>
            <InsightsBody embedded omitNarration />
          </Suspense>
        </section>
      )}
      </>)}
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
