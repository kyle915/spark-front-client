import { Suspense } from "react";
import Layout from "@/layout/Layout";
import { useAuthStore } from "@/store/authStore";
import useSparkRole from "@/hooks/useSparkRole";
import useSidebarCounts from "@/hooks/useSidebarCounts";
import AttentionEngine from "./AttentionEngine";
import AskAiButton from "@/components/ai/AskAiButton";
import ClockSummaryCard from "@/components/dashboard/ClockSummaryCard";
import { InsightsBody } from "@/components/pages/insights/SparkInsights";
import DashboardProgramSwitch from "@/field/DashboardProgramSwitch";
import { isTorchTenant } from "@/field/torch";
import { useDashboardProgram } from "@/field/useDashboardProgram";
import { DashboardSkeleton } from "@/layout/PageSkeletons";
import { useNavigate } from "react-router";
import {
  BrandComparePanel,
  BrandViewSwitch,
} from "@/components/brandGroup/BrandCompare";
import { useBrandView } from "@/components/brandGroup/useBrandView";

/**
 * Compact priority-glance card: shows pending approvals (with SLA
 * breach call-out), upcoming events in the next 14d, and unread
 * alerts. Each tile is clickable and routes to the relevant page.
 *
 * Sourced from useSidebarCounts so tracker / approvals / recaps-due
 * share the sidebar's server scalars — no extra 2,000-row fetch.
 */
const TodaysSnapshot: React.FC = () => {
  const navigate = useNavigate();
  const counts = useSidebarCounts();
  const tiles: Array<{
    label: string;
    value: number;
    sub?: string;
    tone: "lime" | "orange" | "sky" | "gold" | "muted";
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
      tone: "muted",
      to: "/alerts",
      hide: counts.alertsUnread === 0,
    },
    {
      label: "Active requests",
      value: counts.tracker,
      tone: "muted",
      to: "/requests/list",
    },
  ];
  const visible = tiles.filter((t) => !t.hide);
  if (visible.length === 0) return null;
  const n = visible.length;
  const gridCols =
    n <= 1
      ? "grid-cols-1"
      : n === 2
        ? "grid-cols-2"
        : n === 3
          ? "grid-cols-2 lg:grid-cols-3"
          : "grid-cols-2 lg:grid-cols-4";
  return (
    <div className="spark-card p-4 lg:p-5" style={{ borderRadius: 18 }}>
      <div className={`grid ${gridCols} gap-3`}>
        {visible.map((t) => {
          const color =
            t.label === "Recaps due" && t.value > 0
              ? "var(--spark-orange)"
              : "var(--spark-text)";
          return (
            <button
              key={t.label}
              type="button"
              onClick={() => navigate(t.to)}
              className="text-left p-1 transition"
              style={{ background: "transparent", border: "none" }}
            >
              <p
                className="text-sm mb-1"
                style={{ color: "rgba(255,255,255,0.55)" }}
              >
                {t.label}
              </p>
              <p
                className="tab-num text-2xl lg:text-3xl font-bold leading-none"
                style={{ color }}
              >
                {t.value.toLocaleString()}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
};

/**
 * Ops home — due recaps, clock, what needs you, then program
 * performance (pace / KPIs / map) on the same page. Legacy
 * /insights redirects here.
 */

const slugToName = (slug: string | null | undefined): string => {
  if (!slug) return "—";
  const parts = slug.split("-").filter(Boolean);
  const drop = new Set(["ighn", "ig", "ign"]);
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

function DashboardInner() {
  const { tenantId, tenantMeta, tenantSlug } = useAuthStore();
  const torch = isTorchTenant(tenantSlug, tenantMeta?.requestUrlName);
  const { program, choose } = useDashboardProgram(torch);
  const { isClient, isAdmin } = useSparkRole();
  const { view, choose: chooseView } = useBrandView();
  const comparing = view === "compare" && !!tenantId;
  const tenantDisplay = slugToName(tenantMeta?.requestUrlName);

  const linkedSheetUrl = tenantId
    ? (() => {
        try {
          return localStorage.getItem(`@spark.linkedSheet.url/${tenantId}`) ?? "";
        } catch {
          return "";
        }
      })()
    : "";

  return (
    <div className="space-y-6 lg:space-y-8 max-w-7xl">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1
            className="display text-2xl lg:text-3xl font-bold leading-[1.1]"
            style={{ letterSpacing: "-0.03em" }}
          >
            Dashboard
          </h1>
          <div className="mt-2">
            <AskAiButton
              tenantId={tenantId}
              tenantName={tenantDisplay}
              variant="text"
            />
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <BrandViewSwitch tenantId={tenantId} view={view} onChange={chooseView} />
          {torch && !comparing ? (
            <DashboardProgramSwitch program={program} onChange={choose} />
          ) : null}
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
          {comparing ? null : (
          <a
            href="#performance"
            className="px-3 py-2 rounded-xl text-sm font-medium"
            style={{
              background: "transparent",
              color: "rgba(255,255,255,0.7)",
              border: "1px solid var(--spark-border)",
              textDecoration: "none",
            }}
          >
            Performance ↓
          </a>
          )}
        </div>
      </div>

      {comparing && tenantId ? (
        <BrandComparePanel tenantId={tenantId} canManageAccess={isAdmin} />
      ) : (
      <>
      {program === "field" ? null : (
        <>
          <Suspense fallback={null}>
            <TodaysSnapshot />
          </Suspense>

          {!isClient && (
            <Suspense fallback={null}>
              <ClockSummaryCard />
            </Suspense>
          )}

          <Suspense fallback={null}>
            <AttentionEngine />
          </Suspense>
        </>
      )}

      <Suspense fallback={<DashboardSkeleton />}>
        <InsightsBody embedded />
      </Suspense>
      </>
      )}
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
