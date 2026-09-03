/**
 * Per-tenant client dashboard — focused view for brand stakeholders.
 *
 * Lives at /client-dashboard (and /client). Where the admin
 * /dashboard surfaces everything (RMM workload, queues, SLA
 * breaches, internal notes), this view answers only the questions
 * a brand client asks:
 *
 *   1. What's happening this week?
 *   2. How complete is the program (recap fill rate)?
 *   3. What do I need to look at right now?
 *   4. Where are my BAs on the ground?
 *
 * Week-ahead + completion use the slim ClientWeekAheadQuery (date +
 * filed count + retailer name over a 90d→+7d window). Sidebar badge
 * counts come from useSidebarCounts. Approvals / map tabs lazy-load
 * their bodies like AccountMapBody.
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
import AskAiButton from "@/components/ai/AskAiButton";

const AccountMapBody = lazy(() =>
  import("@/components/pages/map/SparkAccountMap").then((m) => ({
    default: m.AccountMapBody,
  })),
);

const ApprovalsBody = lazy(() =>
  import("@/components/pages/approvals/SparkApprovals").then((m) => ({
    default: m.ApprovalsBody,
  })),
);

type TabKey = "overview" | "approvals" | "map";

// Read the active tab from the URL hash so deep-links (e.g.
// /client-dashboard#approvals) land on the right tab and the back
// button works between tabs. Defaults to overview for empty/unknown.
const readTabFromHash = (): TabKey => {
  if (typeof window === "undefined") return "overview";
  const h = (window.location.hash || "").replace(/^#/, "").toLowerCase();
  if (h === "approvals" || h === "map") return h;
  return "overview";
};

type DayBucket = {
  key: string; // YYYY-MM-DD
  label: string; // "Mon May 26"
  count: number;
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

// ────────────────────────────────────────────────────────────
// Tile components
// ────────────────────────────────────────────────────────────

const Tile: React.FC<{
  label: string;
  value: string | number;
  sub?: string;
  tone?: "lime" | "sky" | "orange" | "muted";
  onClick?: () => void;
}> = ({ label, value, sub, tone = "lime", onClick }) => {
  const colorMap = {
    lime: "var(--spark-lime)",
    sky: "var(--spark-sky)",
    orange: "var(--spark-orange, #ef5a2a)",
    muted: "rgba(255,255,255,0.55)",
  } as const;
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className="spark-card text-left p-5 disabled:cursor-default"
      style={{
        cursor: onClick ? "pointer" : "default",
        background: "var(--spark-card-bg, rgba(255,255,255,0.02))",
        borderRadius: 16,
        transition: "background 120ms",
      }}
    >
      <p
        className="mono text-[10px]"
        style={{
          letterSpacing: "0.18em",
          color: "rgba(255,255,255,0.45)",
        }}
      >
        {label.toUpperCase()}
      </p>
      <p
        className="display text-3xl font-bold mt-2"
        style={{
          letterSpacing: "-0.03em",
          color: colorMap[tone],
        }}
      >
        {value}
      </p>
      {sub && (
        <p
          className="text-[12px] mt-1"
          style={{ color: "rgba(255,255,255,0.55)" }}
        >
          {sub}
        </p>
      )}
    </button>
  );
};

const ClientInner: React.FC = () => {
  const navigate = useNavigate();
  const { tenantId } = useAuthStore();
  const counts = useSidebarCounts();

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

  // Slim week-ahead window: 90d back (completion %) → +7d forward.
  // Intentionally NOT RequestsQuery first:2000 — that pulls products,
  // openShifts, nested location trees the Today page never renders.
  const dateWindow = useMemo(() => {
    const today = startOfDay(new Date());
    const start = new Date(today);
    start.setDate(today.getDate() - 90);
    const end = new Date(today);
    end.setDate(today.getDate() + 7);
    return { startDate: isoDay(start), endDate: isoDay(end) };
  }, []);

  const data = useLazyLoadQuery<ClientWeekAheadQueryType>(
    ClientWeekAheadQuery,
    {
      first: 200,
      filters: tenantId
        ? {
            tenantId,
            startDate: dateWindow.startDate,
            endDate: dateWindow.endDate,
          }
        : null,
    },
    { fetchPolicy: "store-or-network" },
  );

  // 7-day forward bucket. Today + next 6 days.
  const weekAhead: DayBucket[] = useMemo(() => {
    const buckets: DayBucket[] = [];
    const today = startOfDay(new Date());
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      buckets.push({ key: dayKey(d), label: fmtDayLabel(d), count: 0 });
    }
    const byKey = new Map(buckets.map((b) => [b.key, b]));
    const rows =
      data?.requests?.edges
        ?.map((e) => e?.node)
        ?.filter((n): n is NonNullable<typeof n> => Boolean(n)) ?? [];
    for (const r of rows) {
      if (!r.date) continue;
      // r.date is YYYY-MM-DD — parsing as local works because the
      // bucket keys are local dates too.
      const [y, mo, d] = r.date.split("-").map(Number);
      if (!y || !mo || !d) continue;
      const k = dayKey(new Date(y, mo - 1, d));
      const slot = byKey.get(k);
      if (slot) slot.count += 1;
    }
    return buckets;
  }, [data]);

  // Recap-completion %: past-dated requests with filed content
  // (recapsFiledCount already excludes empty clock-out shells).
  const completionPct = useMemo(() => {
    const rows =
      data?.requests?.edges
        ?.map((e) => e?.node)
        ?.filter((n): n is NonNullable<typeof n> => Boolean(n)) ?? [];
    let pastEvents = 0;
    let withRecaps = 0;
    const now = startOfDay(new Date()).getTime();
    for (const r of rows) {
      if (!r.date) continue;
      const [y, mo, d] = r.date.split("-").map(Number);
      if (!y || !mo || !d) continue;
      const ms = new Date(y, mo - 1, d).getTime();
      if (!Number.isFinite(ms) || ms > now) continue;
      pastEvents += 1;
      if ((r.recapsFiledCount ?? 0) > 0) withRecaps += 1;
    }
    if (pastEvents === 0) return null;
    return Math.round((withRecaps / pastEvents) * 100);
  }, [data]);

  // Top retailers in the next 7 days (count of scheduled requests
  // grouped by retailer.name). Empty when retailer FK isn't
  // populated.
  const topRetailers = useMemo(() => {
    const rows =
      data?.requests?.edges
        ?.map((e) => e?.node)
        ?.filter((n): n is NonNullable<typeof n> => Boolean(n)) ?? [];
    const map = new Map<string, number>();
    const today = startOfDay(new Date());
    const sevenAhead = new Date(today);
    sevenAhead.setDate(today.getDate() + 7);
    for (const r of rows) {
      if (!r.date) continue;
      const [y, mo, d] = r.date.split("-").map(Number);
      if (!y || !mo || !d) continue;
      const ms = new Date(y, mo - 1, d).getTime();
      if (!Number.isFinite(ms)) continue;
      if (ms < today.getTime() || ms >= sevenAhead.getTime()) continue;
      const name = r.retailer?.name ?? "—";
      map.set(name, (map.get(name) ?? 0) + 1);
    }
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));
  }, [data]);

  const maxWeekCount = Math.max(1, ...weekAhead.map((b) => b.count));
  const totalThisWeek = weekAhead.reduce((s, b) => s + b.count, 0);

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <p
            className="mono text-[10px]"
            style={{
              letterSpacing: "0.18em",
              color: "rgba(255,255,255,0.45)",
            }}
          >
            YOUR PROGRAM · LAST 7 DAYS FORWARD
          </p>
          <h1
            className="display text-4xl font-bold mt-2"
            style={{ letterSpacing: "-0.04em" }}
          >
            Today
          </h1>
          <p
            className="mt-2"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            Due recaps and this week&apos;s program.
          </p>
        </div>
        {/* Ask AI about this client's own program — scoped to the client's
            own tenant (useAuthStore().tenantId), the same tenant id every
            per-tenant surface resolves. */}
        <AskAiButton tenantId={tenantId} />
      </div>

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
                  ? "2px solid var(--spark-lime)"
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
          <ApprovalsBody />
        </Suspense>
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

      {/* Top tiles */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Tile
          label="This week"
          value={totalThisWeek}
          sub={`${weekAhead.filter((b) => b.count > 0).length} active days`}
          onClick={() => navigate("/requests/list")}
        />
        <Tile
          label="Recap completion"
          value={completionPct == null ? "—" : `${completionPct}%`}
          sub={
            counts.recapsDue > 0
              ? `${counts.recapsDue} still open · filed = photos/metrics`
              : "Filed content · all caught up"
          }
          tone={completionPct != null && completionPct < 80 ? "orange" : "lime"}
          onClick={() => navigate("/recaps/list")}
        />
        <Tile
          label="Needs review"
          value={counts.approvals}
          sub={
            counts.approvalsSlaBreach > 0
              ? `${counts.approvalsSlaBreach} past SLA`
              : counts.approvals === 0
                ? "Nothing pending"
                : "Awaiting your approval"
          }
          tone={counts.approvalsSlaBreach > 0 ? "orange" : "sky"}
          onClick={() => navigate("/my-approvals")}
        />
        <Tile
          label="Done · last 30d"
          value={counts.done30d}
          sub="Completed events"
          tone="muted"
          onClick={() => navigate("/requests/list")}
        />
      </div>

      <div
        className="spark-card p-5 flex items-center justify-between flex-wrap gap-3"
        style={{ borderRadius: 16 }}
      >
        <div>
          <p
            className="mono text-[10px]"
            style={{
              letterSpacing: "0.18em",
              color: "rgba(255,255,255,0.45)",
            }}
          >
            DEEP ANALYTICS
          </p>
          <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.7)" }}>
            KPIs, map, sentiment, and BA leaderboard live on Insights — kept off
            Today so this page stays light.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/insights")}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold"
          style={{
            background: "rgba(197,245,70,0.12)",
            color: "var(--spark-lime)",
            border: "1px solid rgba(197,245,70,0.35)",
          }}
        >
          Full insights →
        </button>
      </div>

      {/* Week-ahead bars */}
      <div className="spark-card p-5">
        <p
          className="mono text-[10px] mb-3"
          style={{
            letterSpacing: "0.18em",
            color: "rgba(255,255,255,0.45)",
          }}
        >
          7-DAY FORWARD · {totalThisWeek} EVENTS
        </p>
        <div className="grid grid-cols-7 gap-2 items-end">
          {weekAhead.map((b) => {
            const heightPct = (b.count / maxWeekCount) * 100;
            return (
              <div
                key={b.key}
                className="flex flex-col items-stretch gap-2"
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
                        ? "0 0 12px rgba(197,245,70,0.20)"
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
              </div>
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
            TOP RETAILERS · NEXT 7 DAYS
          </p>
          {topRetailers.length === 0 ? (
            <p
              className="text-[13px]"
              style={{ color: "rgba(255,255,255,0.45)" }}
            >
              Nothing scheduled in the next week.
            </p>
          ) : (
            <ul className="space-y-2">
              {topRetailers.map((row) => (
                <li
                  key={row.name}
                  className="flex items-center justify-between"
                >
                  <span className="text-sm truncate">{row.name}</span>
                  <span
                    className="mono text-[10px] px-2 py-1 rounded-full"
                    style={{
                      letterSpacing: "0.14em",
                      color: "var(--spark-lime)",
                      background: "rgba(197,245,70,0.08)",
                      border: "1px solid rgba(197,245,70,0.25)",
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
              📒 Recaps
            </button>
            <button
              onClick={() => navigate("/requests/list")}
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
              onClick={() => navigate("/today")}
              className="px-3 py-2.5 rounded-xl text-sm font-semibold text-left"
              style={{
                background: "transparent",
                color: "var(--spark-text)",
                border: "1px solid var(--spark-border)",
              }}
            >
              🗺 On the ground
            </button>
            <button
              onClick={() => navigate("/reports")}
              className="px-3 py-2.5 rounded-xl text-sm font-semibold text-left"
              style={{
                background: "transparent",
                color: "var(--spark-text)",
                border: "1px solid var(--spark-border)",
              }}
            >
              📊 Reports
            </button>
          </div>
        </div>
      </div>

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
