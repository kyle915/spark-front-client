import { Suspense } from "react";
import Layout from "@/layout/Layout";
import { useAuthStore } from "@/store/authStore";
import useSparkRole from "@/hooks/useSparkRole";
import useSidebarCounts from "@/hooks/useSidebarCounts";
import AttentionEngine from "./AttentionEngine";
import ActiveTenantAskAi from "@/components/ai/ActiveTenantAskAi";
import AskAiButton from "@/components/ai/AskAiButton";
import ClockSummaryCard from "@/components/dashboard/ClockSummaryCard";
import { InsightsBody } from "@/components/pages/insights/SparkInsights";
import DashboardProgramSwitch from "@/field/DashboardProgramSwitch";
import { isTorchTenant } from "@/field/torch";
import { useDashboardProgram } from "@/field/useDashboardProgram";
import { DashboardSkeleton } from "@/layout/PageSkeletons";
import { SparkKpiLockup } from "@/shared/SparkStatBlocks";
import { attentionSnapshotKpis } from "@/shared/sparkStat";
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
  const tiles = attentionSnapshotKpis(counts);
  if (tiles.length === 0) return null;
  const n = tiles.length;
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
        {tiles.map((t) => (
          <button
            key={t.label}
            type="button"
            onClick={() => navigate(t.to)}
            className="text-left p-1 transition"
            style={{ background: "transparent", border: "none" }}
          >
            <SparkKpiLockup {...t} size="lg" />
          </button>
        ))}
      </div>
    </div>
  );
};

/**
 * Ops home — due recaps, clock, what needs you, then program
 * performance (pace / KPIs / map) on the same page. Legacy
 * /insights redirects here.
 */

function DashboardInner() {
  const { tenantId, tenantMeta, tenantSlug } = useAuthStore();
  const torch = isTorchTenant(tenantSlug, tenantMeta?.requestUrlName);
  const { program, choose } = useDashboardProgram(torch);
  const { isClient, isAdmin } = useSparkRole();
  const { view, choose: chooseView } = useBrandView();
  const comparing = view === "compare" && !!tenantId;

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
            <Suspense
              fallback={<AskAiButton tenantId={tenantId} variant="text" />}
            >
              <ActiveTenantAskAi variant="text" />
            </Suspense>
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
